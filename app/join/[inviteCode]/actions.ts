"use server";

/**
 * Lien magique : à la première visite web, on lie le joueur Slack à un
 * compte Supabase (session anonyme) — son lapin devient le sien.
 */
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkReferralActivation } from "@/lib/server/referrals";
import { joinQuerySchema } from "@/lib/zod-schemas";

export async function linkPlayer(
  inviteCode: string,
  slackUserIdRaw: string,
): Promise<{ ok: boolean; slug?: string; error?: string }> {
  const parsed = joinQuerySchema.safeParse({ u: slackUserIdRaw });
  if (!parsed.success) return { ok: false, error: "bad_request" };
  const slackUserId = parsed.data.u;

  // Session de l'utilisateur courant (créée côté client, signInAnonymously).
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "no_session" };

  const admin = createSupabaseAdminClient();
  const { data: island } = await admin
    .from("islands")
    .select("id, slug, org_id")
    .eq("invite_code", inviteCode)
    .maybeSingle<{ id: string; slug: string; org_id: string }>();
  if (!island) return { ok: false, error: "island_not_found" };

  const { data: player } = await admin
    .from("players")
    .select("id, auth_user_id")
    .eq("island_id", island.id)
    .eq("slack_user_id", slackUserId)
    .maybeSingle<{ id: string; auth_user_id: string | null }>();
  if (!player) return { ok: false, error: "player_not_found" };

  if (player.auth_user_id && player.auth_user_id !== user.id) {
    // Le lapin appartient déjà à quelqu'un d'autre : on ne vole pas un lapin.
    return { ok: false, error: "already_linked" };
  }
  if (!player.auth_user_id) {
    await admin.from("players").update({ auth_user_id: user.id }).eq("id", player.id);
  }

  // Le seuil de parrainage (5 joueurs actifs) peut être atteint ici.
  await checkReferralActivation(island.org_id).catch(() => undefined);

  return { ok: true, slug: island.slug };
}
