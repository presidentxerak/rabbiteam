/**
 * Orchestrateur de la Saison du Lapin : exécute les décisions du moteur pur
 * (lib/game-engine.ts) contre Supabase + Slack.
 *
 * IDEMPOTENCE : chaque action commence par claimAction() - un insert dans
 * dispatch_log avec on conflict do nothing. Si la ligne existe déjà, l'action
 * a déjà tourné aujourd'hui pour cette île : on s'arrête net. Un cron rejoué
 * ne produit jamais deux fois le même effet.
 */
import "server-only";
import { createSupabaseAdminClient, getSlackToken } from "@/lib/supabase/admin";
import {
  canStartSeason,
  isRabbitAsleep,
  mondayOfWeek,
  pickMissions,
  scoreSeason,
  selectRabbit,
  shouldCancelSeason,
  type MissionLite,
  type VoteLite,
} from "@/lib/game-engine";
import { randomSeed } from "@/lib/prng";
import { localTime } from "./time";
import { generateClues } from "./clues";
import { narrateClue } from "@/lib/agent/gamemaster";
import {
  announceDrop,
  grantItemToIsland,
  grantRandomItem,
  grantSeasonMilestones,
} from "./rewards";
import { broadcastToIsland } from "./realtime";
import { postDM, postMessage, scheduleMessage } from "@/lib/slack/client";
import {
  actions as actionsBlock,
  button,
  clueBlocks,
  context as contextBlock,
  linkButton,
  rabbitMissionsDM,
  seasonOpenBlocks,
  section,
  standupReminderBlocks,
  votingOpenBlocks,
} from "@/lib/slack/blocks";
import type { GameRow, IslandRow, PlayerRow } from "./db-types";

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://rabbiteam.app";

// ============ Idempotence ============

/** Locale de l'organisation (pour la narration Game Master). Défaut: en. */
async function islandLocale(orgId: string): Promise<"fr" | "en"> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("organizations")
    .select("locale")
    .eq("id", orgId)
    .maybeSingle<{ locale: "fr" | "en" }>();
  return data?.locale ?? "en";
}

export async function claimAction(islandId: string, action: string, day: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("dispatch_log")
    .upsert(
      { island_id: islandId, action, day },
      { onConflict: "island_id,action,day", ignoreDuplicates: true },
    )
    .select("island_id");
  if (error) {
    console.error(`[dispatch] claim ${action} failed:`, error.message);
    return false;
  }
  return (data ?? []).length > 0;
}

// ============ Contexte d'île ============

export interface IslandCtx {
  island: IslandRow;
  orgId: string;
  plan: "free" | "team" | "company";
  token: string;
}

export async function loadIslandCtx(island: IslandRow): Promise<IslandCtx | null> {
  const admin = createSupabaseAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("id, plan")
    .eq("id", island.org_id)
    .single<{ id: string; plan: "free" | "team" | "company" }>();
  if (!org) return null;
  const token = await getSlackToken(org.id);
  if (!token) return null;
  return { island, orgId: org.id, plan: org.plan, token };
}

async function activePlayers(islandId: string): Promise<PlayerRow[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("players")
    .select("*")
    .eq("island_id", islandId)
    .eq("is_active", true);
  return (data ?? []) as PlayerRow[];
}

async function currentGame(islandId: string, weekStart: string): Promise<GameRow | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("games")
    .select("*")
    .eq("island_id", islandId)
    .eq("week_start", weekStart)
    .maybeSingle<GameRow>();
  return data;
}

async function rabbitOf(gameId: string): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("game_secrets")
    .select("rabbit_player_id")
    .eq("game_id", gameId)
    .maybeSingle<{ rabbit_player_id: string }>();
  return data?.rabbit_player_id ?? null;
}

// ============ LUNDI 09:00 - startSeason ============

export async function startSeason(ctx: IslandCtx, day: string): Promise<void> {
  if (!(await claimAction(ctx.island.id, "start_season", day))) return;
  const admin = createSupabaseAdminClient();
  const weekStart = mondayOfWeek(new Date(day + "T12:00:00Z"));

  // Idempotence renforcée : une partie existe déjà cette semaine → stop.
  if (await currentGame(ctx.island.id, weekStart)) return;

  const players = await activePlayers(ctx.island.id);

  // Garde-fou : < 4 joueurs actifs → saison annulée proprement.
  if (shouldCancelSeason(players.length)) {
    await admin.from("games").insert({
      island_id: ctx.island.id,
      week_start: weekStart,
      status: "cancelled",
    });
    await postMessage(
      ctx.token,
      ctx.island.slack_channel_id,
      "🐰 The Rabbit is waiting for reinforcements: you need at least 4 active players to launch a season. Invite the team with `/rabbiteam setup`!",
    );
    return;
  }

  // Limite de plan (free : 1 saison/mois) - upsell doux, pas de partie.
  const monthStart = weekStart.slice(0, 8) + "01";
  const { count: seasonsThisMonth } = await admin
    .from("games")
    .select("id", { count: "exact", head: true })
    .eq("island_id", ctx.island.id)
    .neq("status", "cancelled")
    .gte("week_start", monthStart);
  if (!canStartSeason(ctx.plan, seasonsThisMonth ?? 0)) {
    await postMessage(
      ctx.token,
      ctx.island.slack_channel_id,
      "🐰 Your monthly season is already played (Free plan). Upgrade to Team for a Rabbit Season every week → " +
        `${APP_URL()}/#pricing`,
    );
    return;
  }

  // --- Sélection du Lapin (pondérée, exclusion des 2 dernières saisons) ---
  const { data: recentGames } = await admin
    .from("games")
    .select("id")
    .eq("island_id", ctx.island.id)
    .eq("status", "revealed")
    .order("week_start", { ascending: false })
    .limit(2);
  const recentIds = (recentGames ?? []).map((g) => g.id as string);
  let recentRabbits: string[] = [];
  if (recentIds.length > 0) {
    const { data: secrets } = await admin
      .from("game_secrets")
      .select("rabbit_player_id")
      .in("game_id", recentIds);
    recentRabbits = (secrets ?? []).map((s) => s.rabbit_player_id as string);
  }

  const prevMonday = new Date(weekStart + "T00:00:00Z");
  prevMonday.setUTCDate(prevMonday.getUTCDate() - 7);
  const { data: lastWeekStandups } = await admin
    .from("standups")
    .select("player_id")
    .eq("island_id", ctx.island.id)
    .gte("day", prevMonday.toISOString().slice(0, 10))
    .lt("day", weekStart);
  const standupCounts = new Map<string, number>();
  for (const s of lastWeekStandups ?? []) {
    const pid = s.player_id as string;
    standupCounts.set(pid, (standupCounts.get(pid) ?? 0) + 1);
  }

  const rabbitId = selectRabbit(
    players.map((p) => ({
      id: p.id,
      isActive: p.is_active,
      standupsLastWeek: standupCounts.get(p.id) ?? 0,
    })),
    recentRabbits,
    Math.random,
  );
  if (!rabbitId) {
    await admin.from("games").insert({
      island_id: ctx.island.id,
      week_start: weekStart,
      status: "cancelled",
    });
    await postMessage(
      ctx.token,
      ctx.island.slack_channel_id,
      "🐰 No one dropped an intention last week - the Rabbit stays in the burrow. Do your standups, the season resumes next Monday!",
    );
    return;
  }

  // --- Tirage des missions (1 facile, 1 moyenne, 1 difficile, sans répétition 8 sem.) ---
  const { data: bank } = await admin.from("missions").select("id, slug, tool, difficulty");
  const eightWeeksAgo = new Date(weekStart + "T00:00:00Z");
  eightWeeksAgo.setUTCDate(eightWeeksAgo.getUTCDate() - 7 * 8);
  const { data: recentGameRows } = await admin
    .from("games")
    .select("id")
    .eq("island_id", ctx.island.id)
    .gte("week_start", eightWeeksAgo.toISOString().slice(0, 10));
  const recentGameIds = (recentGameRows ?? []).map((g) => g.id as string);
  let recentMissionIds: string[] = [];
  if (recentGameIds.length > 0) {
    const { data: rm } = await admin
      .from("game_missions")
      .select("mission_id")
      .in("game_id", recentGameIds);
    recentMissionIds = (rm ?? []).map((r) => r.mission_id as string);
  }
  const missions = pickMissions(
    (bank ?? []) as MissionLite[],
    recentMissionIds,
    Math.random,
  );
  if (!missions) {
    console.error(`[season] island ${ctx.island.id}: mission pool exhausted`);
    return;
  }

  // --- Création de la partie + secret + missions + indices ---
  const { data: game, error: gameErr } = await admin
    .from("games")
    .insert({ island_id: ctx.island.id, week_start: weekStart, status: "active" })
    .select("*")
    .single<GameRow>();
  if (gameErr || !game) return;

  await admin.from("game_secrets").insert({ game_id: game.id, rabbit_player_id: rabbitId });

  const { data: gm } = await admin
    .from("game_missions")
    .insert(missions.map((m) => ({ game_id: game.id, mission_id: m.id })))
    .select("id, mission_id");

  const rabbit = players.find((p) => p.id === rabbitId);
  const clues = generateClues(
    rabbit!,
    players,
    missions.map((m) => m.tool),
  );
  // Game Master Agent : réécrit chaque indice de façon plus vivante SANS
  // changer les faits (la sûreté ≥ candidats vient du moteur, pas du modèle).
  // Sans clé IA, narrateClue renvoie l'indice factuel inchangé.
  const locale = await islandLocale(ctx.orgId);
  const narratedClues = await Promise.all(
    clues.map(async (c) => ({ ...c, content: await narrateClue(c.content, locale) })),
  );
  await admin.from("clues").insert(narratedClues.map((c) => ({ ...c, game_id: game.id })));

  // --- DM secret au Lapin ---
  const { data: missionDetails } = await admin
    .from("missions")
    .select("id, brief_md, difficulty, detection")
    .in("id", missions.map((m) => m.id));
  const dmMissions = (gm ?? []).map((row) => {
    const detail = (missionDetails ?? []).find((m) => m.id === row.mission_id);
    return {
      gameMissionId: row.id as string,
      briefMd: (detail?.brief_md as string) ?? "",
      difficulty: (detail?.difficulty as number) ?? 1,
      detection: (detail?.detection as string) ?? "honor",
    };
  });
  if (rabbit) {
    await postDM(ctx.token, rabbit.slack_user_id, "🤫 C'est toi.", rabbitMissionsDM(dmMissions));
  }

  // --- Annonce publique ---
  const { count: seasonsPlayed } = await admin
    .from("games")
    .select("id", { count: "exact", head: true })
    .eq("island_id", ctx.island.id)
    .neq("status", "cancelled");
  await postMessage(
    ctx.token,
    ctx.island.slack_channel_id,
    `🐰 Season #${seasonsPlayed ?? 1} is open. The Rabbit is among you.`,
    seasonOpenBlocks(seasonsPlayed ?? 1),
  );
}

// ============ Jours ouvrés 09:30 - rappel standup ============

export async function standupReminder(ctx: IslandCtx, day: string): Promise<void> {
  if (!(await claimAction(ctx.island.id, "standup_reminder", day))) return;
  const admin = createSupabaseAdminClient();
  // Pas de spam : si tout le monde a déjà posté, silence.
  const players = await activePlayers(ctx.island.id);
  const { data: done } = await admin
    .from("standups")
    .select("player_id")
    .eq("island_id", ctx.island.id)
    .eq("day", day);
  const doneSet = new Set((done ?? []).map((s) => s.player_id as string));
  if (players.every((p) => doneSet.has(p.id))) return;
  await postMessage(
    ctx.token,
    ctx.island.slack_channel_id,
    "☀️ Today's standup - 30 seconds, carrots on the line.",
    standupReminderBlocks(),
  );
}

// ============ MAR 10:00 / MER 10:00 / JEU 15:00 - indices ============

export async function releaseClue(ctx: IslandCtx, day: string, ordinal: 1 | 2 | 3): Promise<void> {
  if (!(await claimAction(ctx.island.id, `release_clue_${ordinal}`, day))) return;
  const admin = createSupabaseAdminClient();
  const weekStart = mondayOfWeek(new Date(day + "T12:00:00Z"));
  const game = await currentGame(ctx.island.id, weekStart);
  if (!game || game.status !== "active") return;

  const { data: clue } = await admin
    .from("clues")
    .select("*")
    .eq("game_id", game.id)
    .eq("ordinal", ordinal)
    .maybeSingle<{ ordinal: number; content: string; tier: "free" | "paid"; price: number; revealed_at: string | null }>();
  if (!clue || clue.revealed_at) return;

  if (clue.tier === "free") {
    await admin
      .from("clues")
      .update({ revealed_at: new Date().toISOString() })
      .eq("game_id", game.id)
      .eq("ordinal", ordinal);
    const extra =
      ordinal === 3
        ? "\n\n🕵️ Tomorrow 11am: the vote. Did the Rabbit complete its missions?"
        : "";
    await postMessage(
      ctx.token,
      ctx.island.slack_channel_id,
      `🔍 Clue #${ordinal} - ${clue.content}${extra}`,
      clueBlocks(ordinal, clue.content + extra, 0),
    );
  } else {
    // Paid clue: don't publish the content, just announce availability.
    await postMessage(
      ctx.token,
      ctx.island.slack_channel_id,
      `🔍 A clue is available at the burrow (${clue.price} 🥕). /rabbiteam clue`,
      clueBlocks(ordinal, null, clue.price),
    );
  }
}

// ============ JEU 17:00 - garde-fou Lapin endormi ============

export async function checkSleepingRabbit(ctx: IslandCtx, day: string): Promise<void> {
  if (!(await claimAction(ctx.island.id, "check_sleeping_rabbit", day))) return;
  const admin = createSupabaseAdminClient();
  const weekStart = mondayOfWeek(new Date(day + "T12:00:00Z"));
  const game = await currentGame(ctx.island.id, weekStart);
  if (!game || game.status !== "active") return;
  const rabbitId = await rabbitOf(game.id);
  if (!rabbitId) return;

  // Activité = au moins un événement d'île dont il est l'acteur depuis lundi
  // (standup, kudo donné, mission auto détectée…).
  const { count } = await admin
    .from("island_events")
    .select("id", { count: "exact", head: true })
    .eq("island_id", ctx.island.id)
    .eq("actor_player_id", rabbitId)
    .gte("created_at", weekStart + "T00:00:00Z");

  if (isRabbitAsleep(count ?? 0)) {
    await admin.from("games").update({ status: "cancelled" }).eq("id", game.id);
    // Sans le griller : message neutre, aucune mention du joueur.
    await postMessage(
      ctx.token,
      ctx.island.slack_channel_id,
      "😴 The Rabbit fell asleep in its burrow. Blank season - see you Monday for a fresh one. 🐰",
    );
  }
}

// ============ VEN 11:00 - ouverture du vote ============

export async function openVoting(ctx: IslandCtx, day: string): Promise<void> {
  if (!(await claimAction(ctx.island.id, "open_voting", day))) return;
  const admin = createSupabaseAdminClient();
  const weekStart = mondayOfWeek(new Date(day + "T12:00:00Z"));
  const game = await currentGame(ctx.island.id, weekStart);
  if (!game || game.status !== "active") return;
  await admin.from("games").update({ status: "voting" }).eq("id", game.id);
  await postMessage(
    ctx.token,
    ctx.island.slack_channel_id,
    "🗳️ The burrow is open: who is the Rabbit? Vote until 4pm.",
    votingOpenBlocks(`${APP_URL()}/island/${ctx.island.slug}`),
  );
  await broadcastToIsland(ctx.island.id, "voting_open", { gameId: game.id });
}

// ============ VEN 15:30 - rappel non-votants ============

export async function voteReminder(ctx: IslandCtx, day: string): Promise<void> {
  if (!(await claimAction(ctx.island.id, "vote_reminder", day))) return;
  const admin = createSupabaseAdminClient();
  const weekStart = mondayOfWeek(new Date(day + "T12:00:00Z"));
  const game = await currentGame(ctx.island.id, weekStart);
  if (!game || game.status !== "voting") return;
  const players = await activePlayers(ctx.island.id);
  const { data: votes } = await admin.from("votes").select("voter_id").eq("game_id", game.id);
  const voted = new Set((votes ?? []).map((v) => v.voter_id as string));
  const missing = players.filter((p) => !voted.has(p.id));
  if (missing.length === 0) return;
  const mentions = missing.map((p) => `<@${p.slack_user_id}>`).join(" ");
  await postMessage(
    ctx.token,
    ctx.island.slack_channel_id,
    `⏰ Last half hour to vote: ${mentions} - \`/rabbiteam vote\``,
  );
}

// ============ VEN 16:00 - clôture & score ============

export async function closeAndScore(ctx: IslandCtx, day: string): Promise<void> {
  if (!(await claimAction(ctx.island.id, "close_and_score", day))) return;
  const admin = createSupabaseAdminClient();
  const weekStart = mondayOfWeek(new Date(day + "T12:00:00Z"));
  const game = await currentGame(ctx.island.id, weekStart);
  if (!game || game.status !== "voting") return;
  const rabbitId = await rabbitOf(game.id);
  if (!rabbitId) return;

  const { data: votes } = await admin
    .from("votes")
    .select("voter_id, suspect_id")
    .eq("game_id", game.id);
  const { count: missionsDone } = await admin
    .from("game_missions")
    .select("id", { count: "exact", head: true })
    .eq("game_id", game.id)
    .eq("status", "done");

  const { result } = scoreSeason({
    rabbitPlayerId: rabbitId,
    votes: ((votes ?? []) as { voter_id: string; suspect_id: string }[]).map(
      (v): VoteLite => ({ voterId: v.voter_id, suspectId: v.suspect_id }),
    ),
    missionsDone: missionsDone ?? 0,
  });

  // Le résultat est posé mais le status reste 'voting' jusqu'à la révélation
  // de 16h30 (les votes restent secrets, RLS oblige).
  await admin.from("games").update({ result }).eq("id", game.id);
  await postMessage(
    ctx.token,
    ctx.island.slack_channel_id,
    "🗳️ Voting is closed. Counting the ballots… Reveal at 4:30pm. 🐰",
  );
}

// ============ VEN 16:30 - révélation ============

export async function reveal(ctx: IslandCtx, day: string): Promise<void> {
  if (!(await claimAction(ctx.island.id, "reveal", day))) return;
  const admin = createSupabaseAdminClient();
  const weekStart = mondayOfWeek(new Date(day + "T12:00:00Z"));
  const game = await currentGame(ctx.island.id, weekStart);
  if (!game || game.status !== "voting" || !game.result) return;
  const rabbitId = await rabbitOf(game.id);
  if (!rabbitId) return;

  const players = await activePlayers(ctx.island.id);
  const rabbit = players.find((p) => p.id === rabbitId);
  const { data: votes } = await admin
    .from("votes")
    .select("voter_id, suspect_id")
    .eq("game_id", game.id);
  const tallyMap = new Map<string, number>();
  for (const v of votes ?? []) {
    tallyMap.set(v.suspect_id as string, (tallyMap.get(v.suspect_id as string) ?? 0) + 1);
  }
  let topSuspect: PlayerRow | undefined;
  let topCount = 0;
  for (const [sid, c] of tallyMap) {
    if (c > topCount) {
      topCount = c;
      topSuspect = players.find((p) => p.id === sid);
    }
  }

  // status → revealed : les votes et missions deviennent lisibles (RLS).
  await admin.from("games").update({ status: "revealed" }).eq("id", game.id);

  // --- Butin & événement d'île ---
  const result = game.result;
  if (result === "rabbit_win" && rabbit) {
    const rare = await grantRandomItem(rabbit, "rare", "rabbit_win");
    for (const p of players) {
      if (p.id !== rabbit.id) await grantRandomItem(p, "common", "rabbit_win_consolation");
    }
    await admin.from("island_events").insert({
      island_id: ctx.island.id,
      type: "season_rabbit_win",
      actor_player_id: rabbit.id,
      payload: { game_id: game.id },
    });
    if (rare) await announceDrop(ctx.token, ctx.island.slack_channel_id, rabbit.display_name, rare, "Rabbit victory 🐰");
  } else if (result === "detectives_win") {
    const detectives = players.filter((p) => p.id !== rabbitId);
    const lucky = detectives[Math.floor(Math.random() * detectives.length)];
    if (lucky) {
      const rare = await grantRandomItem(lucky, "rare", "detectives_win");
      if (rare) await announceDrop(ctx.token, ctx.island.slack_channel_id, lucky.display_name, rare, "Detectives' victory 🔍");
    }
    await grantItemToIsland(ctx.island.id, "house_garland");
    await admin.from("island_events").insert({
      island_id: ctx.island.id,
      type: "season_detective_win",
      payload: { game_id: game.id },
    });
  }

  // Paliers de saisons (4/12/24)
  const { count: seasonsPlayed } = await admin
    .from("games")
    .select("id", { count: "exact", head: true })
    .eq("island_id", ctx.island.id)
    .eq("status", "revealed");
  await grantSeasonMilestones(ctx.island.id, seasonsPlayed ?? 0);

  // --- Séquence dramatique en 3 messages espacés de 30 s ---
  const nowS = Math.floor(Date.now() / 1000);
  await postMessage(ctx.token, ctx.island.slack_channel_id, "🥁 The votes are in…");
  const accusedText = topSuspect
    ? `The team points at: *${topSuspect.display_name}* (${topCount} votes)`
    : "No majority emerges… doubt lingers.";
  await scheduleMessage(ctx.token, ctx.island.slack_channel_id, nowS + 30, accusedText);

  const verdictText =
    result === "rabbit_win"
      ? `🐰 *The Rabbit escaped!* It was *${rabbit?.display_name ?? "?"}*. Missions pulled off right under your noses.`
      : result === "detectives_win"
        ? `🔍 *Unmasked!* The Rabbit was indeed *${rabbit?.display_name ?? "?"}*. Well done, detectives.`
        : `😶 *Draw.* The Rabbit (*${rabbit?.display_name ?? "?"}*) escaped the vote… but hid too much. No loot.`;
  const cardUrl = `${APP_URL()}/api/og/reveal/${game.id}`;
  const islandUrl = `${APP_URL()}/i/${ctx.island.slug}`;
  await scheduleMessage(ctx.token, ctx.island.slack_channel_id, nowS + 60, verdictText, [
    section(verdictText),
    { type: "image", image_url: cardUrl, alt_text: "Rabbiteam Reveal Card" },
    actionsBlock(
      linkButton("Watch the ceremony 🏝️", `${APP_URL()}/island/${ctx.island.slug}`),
      linkButton("Share 📤", islandUrl),
    ),
    contextBlock(`Would your team survive the Rabbit? ${islandUrl}`),
  ]);
  await scheduleMessage(
    ctx.token,
    ctx.island.slack_channel_id,
    nowS + 90,
    "Next season Monday 9am. 🐰",
  );

  // --- Cérémonie 3D en Realtime ---
  await broadcastToIsland(ctx.island.id, "reveal", {
    gameId: game.id,
    result,
    rabbitPlayerId: rabbitId,
    accusedPlayerId: topSuspect?.id ?? null,
  });
}

// ============ MODE DÉMO — démarrer une saison MAINTENANT ============
//
// Bypasse l'agenda (lundi 9h) et tous les garde-fous (≥4 joueurs, ≥1 standup,
// limite de plan) pour une démo en direct. Peuple l'île de joueurs de démo
// si besoin, tire un Lapin, publie les 3 indices immédiatement, marque 2
// missions accomplies (pour qu'une victoire du Lapin soit possible), et ouvre
// directement le vote. Rejouable : repart d'une saison neuve à chaque appel.

const DEMO_NAMES = ["Margaux", "Théo", "Léa", "Sam", "Inès", "Noah", "Yuki", "Oli"];

export async function runDemoSeason(ctx: IslandCtx): Promise<string> {
  if (!ctx.island.slack_channel_id) {
    return "Run `/rabbiteam setup #channel` first so I know where to post.";
  }
  const admin = createSupabaseAdminClient();
  const today = localTime(new Date(), ctx.island.timezone).day;
  const weekStart = mondayOfWeek(new Date(today + "T12:00:00Z"));

  // 1. Roster : au moins 6 joueurs actifs (sème des joueurs de démo au besoin).
  let players = await activePlayers(ctx.island.id);
  if (players.length < 6) {
    const need = 6 - players.length;
    const rows = DEMO_NAMES.slice(0, need).map((name, i) => ({
      island_id: ctx.island.id,
      slack_user_id: `demo_${Date.now()}_${i}`,
      display_name: name,
      avatar_seed: randomSeed(),
      is_active: true,
    }));
    const { data: inserted } = await admin.from("players").insert(rows).select("id");
    // Événements pour faire vivre l'île (nouveaux membres + un peu d'activité).
    for (const p of inserted ?? []) {
      await admin.from("island_events").insert({
        island_id: ctx.island.id,
        type: "member_joined",
        actor_player_id: p.id as string,
      });
    }
    for (let i = 0; i < 12; i++) {
      await admin.from("island_events").insert({
        island_id: ctx.island.id,
        type: i % 3 === 0 ? "kudo" : i % 3 === 1 ? "notion_page" : "standup",
      });
    }
    players = await activePlayers(ctx.island.id);
  }

  // 2. Repart à neuf : supprime toute saison de la semaine (cascade) + le log.
  await admin.from("games").delete().eq("island_id", ctx.island.id).eq("week_start", weekStart);
  await admin.from("dispatch_log").delete().eq("island_id", ctx.island.id).eq("day", today);

  // 3. Tire un Lapin (aléatoire, sans exigence de standup pour la démo).
  const rabbit = players[Math.floor(Math.random() * players.length)];
  if (!rabbit) return "No active players to run a demo. Run `/rabbiteam setup #channel` first.";

  // 4. Crée la saison directement en statut 'voting' (jouable tout de suite).
  const { data: game, error: gErr } = await admin
    .from("games")
    .insert({ island_id: ctx.island.id, week_start: weekStart, status: "voting" })
    .select("*")
    .single<GameRow>();
  if (gErr || !game) return `Demo failed to create the season (${gErr?.code ?? "?"}).`;
  await admin.from("game_secrets").insert({ game_id: game.id, rabbit_player_id: rabbit.id });

  // 5. Missions (1 facile/moyenne/difficile) ; 2 marquées accomplies.
  const { data: bank } = await admin
    .from("missions")
    .select("id, slug, tool, difficulty, brief_md, detection");
  const missions = pickMissions((bank ?? []) as MissionLite[], [], Math.random);
  if (!missions) return "Demo failed: mission bank empty (re-run the seed SQL).";
  const { data: gm } = await admin
    .from("game_missions")
    .insert(missions.map((m) => ({ game_id: game.id, mission_id: m.id })))
    .select("id");
  const doneIds = (gm ?? []).slice(0, 2).map((r) => r.id as string);
  if (doneIds.length) {
    await admin
      .from("game_missions")
      .update({ status: "done", proof: { demo: true }, completed_at: new Date().toISOString() })
      .in("id", doneIds);
  }

  // 6. Indices : générés, narrés (Game Master si clé IA), publiés immédiatement.
  const locale = await islandLocale(ctx.orgId);
  const clues = generateClues(rabbit, players, missions.map((m) => m.tool));
  const narrated = await Promise.all(
    clues.map(async (c) => ({ ...c, content: await narrateClue(c.content, locale) })),
  );
  const nowIso = new Date().toISOString();
  await admin
    .from("clues")
    .insert(narrated.map((c) => ({ ...c, game_id: game.id, revealed_at: nowIso })));

  // 7. DM secret au Lapin si c'est un vrai utilisateur Slack.
  if (!rabbit.slack_user_id.startsWith("demo_")) {
    const byId = new Map((bank ?? []).map((b) => [b.id as string, b]));
    const dm = (gm ?? []).map((row, i) => {
      const m = missions[i];
      const def = m ? byId.get(m.id) : undefined;
      return {
        gameMissionId: row.id as string,
        briefMd: (def?.brief_md as string) ?? "Slip something subtle into the team's tools.",
        difficulty: (def?.difficulty as number) ?? 1,
        detection: (def?.detection as string) ?? "honor",
      };
    });
    await postDM(ctx.token, rabbit.slack_user_id, "🤫 (demo) You are the Rabbit.", rabbitMissionsDM(dm));
  }

  // 8. Annonces publiques + indices + ouverture du vote en Realtime.
  await postMessage(
    ctx.token,
    ctx.island.slack_channel_id,
    "🎬 *Demo season is live!* The Rabbit is among you, 3 clues are out, voting is open.",
    [
      section("🎬 *Demo season is live!* The Rabbit is among you."),
      contextBlock(
        "Try `/rabbiteam clue` to read the clues, `/rabbiteam detective <question>` to investigate with the AI, `/rabbiteam vote` to vote, then `/rabbiteam reveal` for the dramatic finale.",
      ),
    ],
  );
  for (const c of narrated) {
    await postMessage(ctx.token, ctx.island.slack_channel_id, `🔍 Clue #${c.ordinal} - ${c.content}`);
  }
  await postMessage(
    ctx.token,
    ctx.island.slack_channel_id,
    "🗳️ Voting is open.",
    votingOpenBlocks(`${APP_URL()}/island/${ctx.island.slug}`),
  );
  await broadcastToIsland(ctx.island.id, "voting_open", { gameId: game.id });

  return "🎬 Demo season started: clues published, voting open. Use `/rabbiteam vote` then `/rabbiteam reveal`.";
}

/** Démo : force la clôture + la révélation immédiatement (la séquence dramatique reste étalée). */
export async function runDemoReveal(ctx: IslandCtx): Promise<string> {
  const day = localTime(new Date(), ctx.island.timezone).day;
  // Nettoie le verrou d'idempotence pour autoriser close+reveal maintenant.
  const admin = createSupabaseAdminClient();
  await admin
    .from("dispatch_log")
    .delete()
    .eq("island_id", ctx.island.id)
    .in("action", ["close_and_score", "reveal"])
    .eq("day", day);
  await closeAndScore(ctx, day);
  await reveal(ctx, day);
  return "🎭 Revealing… watch the channel and the island for the ceremony.";
}
