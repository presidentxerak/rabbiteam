/** Résolution organisation/île/joueur depuis les identifiants Slack. */
import "server-only";
import { createSupabaseAdminClient, getSlackToken } from "@/lib/supabase/admin";
import type { IslandRow, PlayerRow } from "./db-types";

export interface SlackCtx {
  orgId: string;
  island: IslandRow;
  token: string;
}

export async function resolveSlackCtx(teamId: string): Promise<SlackCtx | null> {
  const admin = createSupabaseAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("id")
    .eq("slack_team_id", teamId)
    .maybeSingle<{ id: string }>();
  if (!org) return null;
  const { data: island } = await admin
    .from("islands")
    .select("*")
    .eq("org_id", org.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<IslandRow>();
  if (!island) return null;
  const token = await getSlackToken(org.id);
  if (!token) return null;
  return { orgId: org.id, island, token };
}

export async function resolvePlayer(
  islandId: string,
  slackUserId: string,
): Promise<PlayerRow | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("players")
    .select("*")
    .eq("island_id", islandId)
    .eq("slack_user_id", slackUserId)
    .maybeSingle<PlayerRow>();
  return data;
}

/** Marque un event Slack comme traité. false = déjà vu (retry Slack) → skip. */
export async function claimSlackEvent(eventId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("slack_events_processed")
    .upsert({ event_id: eventId }, { onConflict: "event_id", ignoreDuplicates: true })
    .select("event_id");
  return (data ?? []).length > 0;
}
