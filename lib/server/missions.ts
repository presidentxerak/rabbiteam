/**
 * Détection automatique des missions du Lapin au fil des events
 * Slack / Notion / Kanban, + kudos. Lecture service role uniquement :
 * les missions actives sont invisibles côté client (RLS).
 */
import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { postDM, postEphemeral } from "@/lib/slack/client";
import type { GameMissionRow, IslandRow, PlayerRow } from "./db-types";

const KUDO_EMOJIS = new Set(["raised_hands", "carrot", "purple_heart"]);
const KUDOS_PER_DAY_CAP = 3;

interface ActiveMissionCtx {
  gameId: string;
  rabbit: PlayerRow;
  missions: GameMissionRow[];
}

/** Charge la partie active + missions pending du Lapin pour une île. */
async function activeMissions(islandId: string): Promise<ActiveMissionCtx | null> {
  const admin = createSupabaseAdminClient();
  const { data: game } = await admin
    .from("games")
    .select("id")
    .eq("island_id", islandId)
    .in("status", ["active", "voting"])
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!game) return null;
  const { data: secret } = await admin
    .from("game_secrets")
    .select("rabbit_player_id")
    .eq("game_id", game.id)
    .maybeSingle<{ rabbit_player_id: string }>();
  if (!secret) return null;
  const { data: rabbit } = await admin
    .from("players")
    .select("*")
    .eq("id", secret.rabbit_player_id)
    .single<PlayerRow>();
  if (!rabbit) return null;
  const { data: missions } = await admin
    .from("game_missions")
    .select("id, game_id, mission_id, status, proof, missions(slug, tool, difficulty, brief_md, detection, params)")
    .eq("game_id", game.id)
    .eq("status", "pending");
  return {
    gameId: game.id,
    rabbit,
    missions: (missions ?? []) as unknown as GameMissionRow[],
  };
}

async function completeMission(
  gm: GameMissionRow,
  rabbit: PlayerRow,
  token: string,
  proof: Record<string, unknown>,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data: updated } = await admin
    .from("game_missions")
    .update({ status: "done", proof, completed_at: new Date().toISOString() })
    .eq("id", gm.id)
    .eq("status", "pending") // idempotence : déjà done → no-op
    .select("id");
  if (!updated || updated.length === 0) return;
  await postDM(
    token,
    rabbit.slack_user_id,
    "🕶️ Mission accomplished. Did anyone notice?",
  );
}

/** Avance un compteur dans proof.progress ; complète quand count atteint. */
async function bumpProgress(
  gm: GameMissionRow,
  rabbit: PlayerRow,
  token: string,
  key: string,
  marker: string,
  target: number,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const proof = (gm.proof ?? {}) as { progress?: string[] };
  const progress = new Set(proof.progress ?? []);
  if (progress.has(marker)) return; // déjà compté (idempotent)
  progress.add(marker);
  const list = [...progress];
  if (list.length >= target) {
    await completeMission(gm, rabbit, token, { [key]: list });
  } else {
    await admin.from("game_missions").update({ proof: { progress: list } }).eq("id", gm.id);
    await postDM(token, rabbit.slack_user_id, `🥕 Mission in progress: ${list.length}/${target}. Stay discreet.`);
  }
}

// ============ Slack : reaction_added ============

export async function handleReaction(opts: {
  island: IslandRow;
  token: string;
  reactorSlackId: string;
  targetSlackId: string | null;
  reaction: string;
  channel: string | null;
  messageTs: string | null;
}): Promise<void> {
  const { island, token, reactorSlackId, targetSlackId, reaction } = opts;
  const admin = createSupabaseAdminClient();

  const { data: reactor } = await admin
    .from("players")
    .select("*")
    .eq("island_id", island.id)
    .eq("slack_user_id", reactorSlackId)
    .maybeSingle<PlayerRow>();
  if (!reactor) return;

  // --- Kudos (🙌 🥕 💜 sur le message d'un collègue), throttle 3/jour ---
  if (KUDO_EMOJIS.has(reaction) && targetSlackId && targetSlackId !== reactorSlackId) {
    const today = new Date().toISOString().slice(0, 10);
    const { count } = await admin
      .from("island_events")
      .select("id", { count: "exact", head: true })
      .eq("island_id", island.id)
      .eq("type", "kudo")
      .eq("actor_player_id", reactor.id)
      .gte("created_at", today + "T00:00:00Z");
    if ((count ?? 0) < KUDOS_PER_DAY_CAP) {
      await admin.from("island_events").insert({
        island_id: island.id,
        type: "kudo",
        actor_player_id: reactor.id,
        payload: { emoji: reaction },
      });
    }
  }

  // --- Missions auto du Lapin basées sur les réactions ---
  const ctx = await activeMissions(island.id);
  if (!ctx || ctx.rabbit.slack_user_id !== reactorSlackId) return;
  for (const gm of ctx.missions) {
    const def = gm.missions;
    if (!def || def.detection !== "auto" || def.tool !== "slack") continue;
    const params = def.params as { emoji?: string; count?: number };
    if (!params.emoji || params.emoji !== reaction) continue;
    const target = params.count ?? 1;
    const marker = `${opts.channel}:${opts.messageTs}`;
    await bumpProgress(gm, ctx.rabbit, token, "reactions", marker, target);
  }
}

// ============ Slack : message (missions "mot à placer", threads) ============

export async function handleMessage(opts: {
  island: IslandRow;
  token: string;
  authorSlackId: string;
  text: string;
  channel: string;
  ts: string;
  threadTs: string | null;
}): Promise<void> {
  const { island, token, authorSlackId, text } = opts;
  const ctx = await activeMissions(island.id);
  if (!ctx || ctx.rabbit.slack_user_id !== authorSlackId) return;

  const lower = text.toLowerCase();
  for (const gm of ctx.missions) {
    const def = gm.missions;
    if (!def || def.detection !== "auto" || def.tool !== "slack") continue;
    const params = def.params as { word?: string; count?: number; kind?: string };

    if (params.word && lower.includes(params.word.toLowerCase())) {
      const target = params.count ?? 1;
      await bumpProgress(gm, ctx.rabbit, token, "messages", `${opts.channel}:${opts.ts}`, target);
    }
    if (params.kind === "thread_reply" && opts.threadTs && opts.threadTs !== opts.ts) {
      const target = params.count ?? 3;
      await bumpProgress(gm, ctx.rabbit, token, "threads", `${opts.channel}:${opts.threadTs}`, target);
    }
  }
}

// ============ Bouton "J'ai accompli cette mission" (missions honor) ============

export async function handleMissionDoneButton(opts: {
  gameMissionId: string;
  clickerSlackId: string;
  token: string;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data: gm } = await admin
    .from("game_missions")
    .select("id, game_id, status, proof, missions(detection)")
    .eq("id", opts.gameMissionId)
    .maybeSingle<{ id: string; game_id: string; status: string; missions: { detection: string } | null }>();
  if (!gm || gm.status !== "pending") return;
  if (gm.missions?.detection !== "honor") return;

  // Seul le Lapin de cette partie peut cocher (le bouton vit dans son DM,
  // mais on vérifie quand même côté serveur).
  const { data: secret } = await admin
    .from("game_secrets")
    .select("rabbit_player_id")
    .eq("game_id", gm.game_id)
    .maybeSingle<{ rabbit_player_id: string }>();
  if (!secret) return;
  const { data: rabbit } = await admin
    .from("players")
    .select("*")
    .eq("id", secret.rabbit_player_id)
    .single<PlayerRow>();
  if (!rabbit || rabbit.slack_user_id !== opts.clickerSlackId) return;

  await admin
    .from("game_missions")
    .update({ status: "done", proof: { honor: true }, completed_at: new Date().toISOString() })
    .eq("id", gm.id)
    .eq("status", "pending");
  await postDM(opts.token, rabbit.slack_user_id, "✅ Mission checked off. Rabbit's honor. 🐰");
}

// ============ Notion : page publiée ============

export async function handleNotionPage(islandId: string, token: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin.from("island_events").insert({
    island_id: islandId,
    type: "notion_page",
    payload: {},
  });
  await completeNotionPageMissions(islandId, token);
}

/**
 * Complète les missions Notion auto (`page_created`) du Lapin actif, si une
 * saison est en cours. Réutilisé par le webhook ET par la sync par jeton.
 */
export async function completeNotionPageMissions(islandId: string, token: string): Promise<void> {
  const ctx = await activeMissions(islandId);
  if (!ctx) return;
  for (const gm of ctx.missions) {
    const def = gm.missions;
    if (!def || def.detection !== "auto" || def.tool !== "notion") continue;
    const params = def.params as { kind?: string };
    if (params.kind === "page_created") {
      // Sans mapping fiable page→joueur, la création de page complète la
      // mission au bénéfice du doute (la page est visible par l'équipe).
      await completeMission(gm, ctx.rabbit, token, { kind: "notion_page" });
    }
  }
}

// ============ Kanban (Linear) : ticket terminé ============

export async function handleIssueCompleted(islandId: string, token: string): Promise<void> {
  const ctx = await activeMissions(islandId);
  if (!ctx) return;
  for (const gm of ctx.missions) {
    const def = gm.missions;
    if (!def || def.detection !== "auto" || def.tool !== "kanban") continue;
    const params = def.params as { kind?: string; count?: number };
    if (params.kind !== "issue_completed") continue;
    const target = params.count ?? 1;
    await bumpProgress(gm, ctx.rabbit, token, "issues", `issue:${Date.now()}`, target);
  }
}
