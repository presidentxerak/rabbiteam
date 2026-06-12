/**
 * Parrainage "Carotte Dorée" : récompense quand l'organisation filleule
 * atteint 5 joueurs actifs (anti-fraude : rien à l'installation seule).
 * Récompense collective : Carotte Dorée legendary pour TOUS les joueurs
 * des deux îles + palmier doré (slot island).
 */
import "server-only";
import { createSupabaseAdminClient, getSlackToken } from "@/lib/supabase/admin";
import { grantItemToIsland, grantItemToPlayer } from "./rewards";
import { postMessage } from "@/lib/slack/client";
import type { IslandRow, PlayerRow } from "./db-types";

export const REFERRAL_ACTIVATION_THRESHOLD = 5;

/** À appeler quand un joueur rejoint une île : vérifie le seuil du parrainage. */
export async function checkReferralActivation(referredOrgId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data: referral } = await admin
    .from("referrals")
    .select("id, referrer_island_id, status")
    .eq("referred_org_id", referredOrgId)
    .eq("status", "pending")
    .maybeSingle<{ id: string; referrer_island_id: string; status: string }>();
  if (!referral) return;

  const { data: islands } = await admin
    .from("islands")
    .select("*")
    .eq("org_id", referredOrgId);
  const referred = ((islands ?? []) as IslandRow[])[0];
  if (!referred) return;

  const { count } = await admin
    .from("players")
    .select("id", { count: "exact", head: true })
    .eq("island_id", referred.id)
    .eq("is_active", true);
  if ((count ?? 0) < REFERRAL_ACTIVATION_THRESHOLD) return;

  // Verrou idempotent : pending → rewarded en une transition conditionnelle.
  const { data: locked } = await admin
    .from("referrals")
    .update({ status: "rewarded" })
    .eq("id", referral.id)
    .eq("status", "pending")
    .select("id");
  if (!locked || locked.length === 0) return;

  const { data: referrer } = await admin
    .from("islands")
    .select("*")
    .eq("id", referral.referrer_island_id)
    .single<IslandRow>();

  for (const island of [referrer, referred]) {
    if (!island) continue;
    const { data: players } = await admin
      .from("players")
      .select("*")
      .eq("island_id", island.id)
      .eq("is_active", true);
    for (const p of (players ?? []) as PlayerRow[]) {
      await grantItemToPlayer(p.id, "golden_carrot", "referral");
    }
    await grantItemToIsland(island.id, "golden_palm");
    await admin.from("island_events").insert({
      island_id: island.id,
      type: "referral",
      payload: {},
    });
    const { data: org } = await admin
      .from("islands")
      .select("org_id")
      .eq("id", island.id)
      .single<{ org_id: string }>();
    const token = org ? await getSlackToken(org.org_id) : null;
    if (token) {
      await postMessage(
        token,
        island.slack_channel_id,
        "🥕✨ *GOLDEN CARROT!* A referral just landed: the whole island receives the Golden Carrot (legendary) and a golden palm grows on the beach. Thank you, rabbits.",
      );
    }
  }
}
