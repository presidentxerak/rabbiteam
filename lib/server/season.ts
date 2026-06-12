/**
 * Orchestrateur de la Saison du Lapin : exécute les décisions du moteur pur
 * (lib/game-engine.ts) contre Supabase + Slack.
 *
 * IDEMPOTENCE : chaque action commence par claimAction() — un insert dans
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
import { generateClues } from "./clues";
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

// ============ LUNDI 09:00 — startSeason ============

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
      "🐰 Le Lapin attend des renforts : il faut au moins 4 joueurs actifs pour lancer une saison. Invitez l'équipe avec `/rabbiteam setup` !",
    );
    return;
  }

  // Limite de plan (free : 1 saison/mois) — upsell doux, pas de partie.
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
      "🐰 Votre saison mensuelle est déjà jouée (plan Free). Passez au plan Team pour une Saison du Lapin chaque semaine → " +
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
      "🐰 Personne n'a posé d'intention la semaine passée — le Lapin reste au terrier. Faites vos standups, la saison reprend lundi prochain !",
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
  await admin.from("clues").insert(clues.map((c) => ({ ...c, game_id: game.id })));

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
    `🐰 Saison #${seasonsPlayed ?? 1} ouverte. Le Lapin est parmi vous.`,
    seasonOpenBlocks(seasonsPlayed ?? 1),
  );
}

// ============ Jours ouvrés 09:30 — rappel standup ============

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
    "☀️ Standup du jour — 30 secondes, des carottes à la clé.",
    standupReminderBlocks(),
  );
}

// ============ MAR 10:00 / MER 10:00 / JEU 15:00 — indices ============

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
        ? "\n\n🕵️ Demain 11h : le vote. Le Lapin a-t-il accompli ses missions ?"
        : "";
    await postMessage(
      ctx.token,
      ctx.island.slack_channel_id,
      `🔍 Indice n°${ordinal} — ${clue.content}${extra}`,
      clueBlocks(ordinal, clue.content + extra, 0),
    );
  } else {
    // Indice payant : pas de publication du contenu, annonce de disponibilité.
    await postMessage(
      ctx.token,
      ctx.island.slack_channel_id,
      `🔍 Un indice est disponible au terrier (${clue.price} 🥕). /rabbiteam indice`,
      clueBlocks(ordinal, null, clue.price),
    );
  }
}

// ============ JEU 17:00 — garde-fou Lapin endormi ============

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
      "😴 Le Lapin s'est endormi dans son terrier. Saison blanche — rendez-vous lundi pour une nouvelle saison. 🐰",
    );
  }
}

// ============ VEN 11:00 — ouverture du vote ============

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
    "🗳️ Le terrier est ouvert : qui est le Lapin ? Vote jusqu'à 16h.",
    votingOpenBlocks(`${APP_URL()}/island/${ctx.island.slug}`),
  );
  await broadcastToIsland(ctx.island.id, "voting_open", { gameId: game.id });
}

// ============ VEN 15:30 — rappel non-votants ============

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
    `⏰ Dernière demi-heure pour voter : ${mentions} — \`/rabbiteam vote\``,
  );
}

// ============ VEN 16:00 — clôture & score ============

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
    "🗳️ Les votes sont clos. Dépouillement en cours… Révélation à 16h30. 🐰",
  );
}

// ============ VEN 16:30 — révélation ============

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
    if (rare) await announceDrop(ctx.token, ctx.island.slack_channel_id, rabbit.display_name, rare, "victoire du Lapin 🐰");
  } else if (result === "detectives_win") {
    const detectives = players.filter((p) => p.id !== rabbitId);
    const lucky = detectives[Math.floor(Math.random() * detectives.length)];
    if (lucky) {
      const rare = await grantRandomItem(lucky, "rare", "detectives_win");
      if (rare) await announceDrop(ctx.token, ctx.island.slack_channel_id, lucky.display_name, rare, "victoire des Détectives 🔍");
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
  await postMessage(ctx.token, ctx.island.slack_channel_id, "🥁 Les votes sont comptés…");
  const accusedText = topSuspect
    ? `L'équipe désigne : *${topSuspect.display_name}* (${topCount} voix)`
    : "Aucune majorité ne se dégage… le doute plane.";
  await scheduleMessage(ctx.token, ctx.island.slack_channel_id, nowS + 30, accusedText);

  const verdictText =
    result === "rabbit_win"
      ? `🐰 *Le Lapin s'est échappé !* C'était *${rabbit?.display_name ?? "?"}*. Missions accomplies sous vos yeux.`
      : result === "detectives_win"
        ? `🔍 *Démasqué !* Le Lapin était bien *${rabbit?.display_name ?? "?"}*. Bravo les détectives.`
        : `😶 *Match nul.* Le Lapin (*${rabbit?.display_name ?? "?"}*) a échappé au vote… mais s'est trop caché. Pas de butin.`;
  const cardUrl = `${APP_URL()}/api/og/reveal/${game.id}`;
  const islandUrl = `${APP_URL()}/i/${ctx.island.slug}`;
  await scheduleMessage(ctx.token, ctx.island.slack_channel_id, nowS + 60, verdictText, [
    section(verdictText),
    { type: "image", image_url: cardUrl, alt_text: "Carte de Révélation Rabbiteam" },
    actionsBlock(
      linkButton("Voir la cérémonie 🏝️", `${APP_URL()}/island/${ctx.island.slug}`),
      linkButton("Partager 📤", islandUrl),
    ),
    contextBlock(`Votre équipe résisterait au Lapin ? ${islandUrl}`),
  ]);
  await scheduleMessage(
    ctx.token,
    ctx.island.slack_channel_id,
    nowS + 90,
    "Prochaine saison lundi 9h. 🐰",
  );

  // --- Cérémonie 3D en Realtime ---
  await broadcastToIsland(ctx.island.id, "reveal", {
    gameId: game.id,
    result,
    rabbitPlayerId: rabbitId,
    accusedPlayerId: topSuspect?.id ?? null,
  });
}
