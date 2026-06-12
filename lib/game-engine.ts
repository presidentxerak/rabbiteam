/**
 * Moteur de jeu de la Saison du Lapin.
 *
 * 100% PUR : aucune I/O, aucune date implicite, aucun accès base.
 * Toutes les fonctions reçoivent leurs entrées et un PRNG injectable,
 * et sont couvertes par tests/game-engine.test.ts.
 * Les handlers (cron, Slack) appliquent les décisions retournées ici.
 */

// ============ Types d'entrée (projections minimales des lignes SQL) ============

export interface PlayerLite {
  id: string;
  isActive: boolean;
  /** Nombre de standups postés la semaine précédente. */
  standupsLastWeek: number;
}

export interface MissionLite {
  id: string;
  slug: string;
  tool: "slack" | "notion" | "kanban" | "any";
  difficulty: 1 | 2 | 3;
}

export interface VoteLite {
  voterId: string;
  suspectId: string;
}

export type SeasonResult = "rabbit_win" | "detectives_win" | "draw";

// ============ Constantes d'équilibrage ============

export const MIN_ACTIVE_PLAYERS = 4;
export const RABBIT_EXCLUSION_SEASONS = 2; // pas 2 fois Lapin en 2 saisons
export const MISSION_NO_REPEAT_WEEKS = 8;
export const MISSIONS_REQUIRED_FOR_WIN = 2;
export const MIN_CLUE_CANDIDATES_TUESDAY = 3;
export const MIN_CLUE_CANDIDATES_PAID = 2;
export const PAID_CLUE_PRICE = 30;

export const STANDUP_BASE_CARROTS = 10;
export const STREAK_BONUS_STEP = 2; // +2 🥕 par jour de streak, plafonné
export const STREAK_BONUS_CAP = 10;

// ============ Sélection du Lapin ============

/**
 * Tirage pondéré parmi les joueurs actifs ayant ≥1 standup la semaine passée,
 * en excluant les Lapins des dernières saisons. Pondération = 1 + standups
 * (un joueur présent a plus de chances, sans jamais exclure les discrets).
 * Retourne null si aucun candidat.
 */
export function selectRabbit(
  players: readonly PlayerLite[],
  recentRabbitIds: readonly string[],
  rng: () => number,
): string | null {
  const excluded = new Set(recentRabbitIds);
  let candidates = players.filter(
    (p) => p.isActive && p.standupsLastWeek >= 1 && !excluded.has(p.id),
  );
  // Si l'exclusion vide le vivier (petite équipe), on la relâche plutôt que d'annuler.
  if (candidates.length === 0) {
    candidates = players.filter((p) => p.isActive && p.standupsLastWeek >= 1);
  }
  if (candidates.length === 0) return null;
  const total = candidates.reduce((s, p) => s + 1 + p.standupsLastWeek, 0);
  let r = rng() * total;
  for (const p of candidates) {
    r -= 1 + p.standupsLastWeek;
    if (r < 0) return p.id;
  }
  return candidates[candidates.length - 1]?.id ?? null;
}

// ============ Tirage des missions ============

/**
 * 3 missions : 1 facile, 1 moyenne, 1 difficile ; outils variés ;
 * jamais une mission jouée dans les MISSION_NO_REPEAT_WEEKS dernières semaines.
 * Retourne null si la banque ne permet pas un tirage complet.
 */
export function pickMissions(
  bank: readonly MissionLite[],
  recentMissionIds: readonly string[],
  rng: () => number,
): [MissionLite, MissionLite, MissionLite] | null {
  const recent = new Set(recentMissionIds);
  const fresh = bank.filter((m) => !recent.has(m.id));
  const picked: MissionLite[] = [];
  const usedTools = new Set<string>();

  for (const difficulty of [1, 2, 3] as const) {
    const pool = fresh.filter((m) => m.difficulty === difficulty && !picked.includes(m));
    if (pool.length === 0) return null;
    // Priorité aux outils pas encore couverts ('any' compte comme joker).
    const varied = pool.filter((m) => m.tool === "any" || !usedTools.has(m.tool));
    const source = varied.length > 0 ? varied : pool;
    const m = source[Math.floor(rng() * source.length)];
    if (!m) return null;
    picked.push(m);
    if (m.tool !== "any") usedTools.add(m.tool);
  }
  return picked as [MissionLite, MissionLite, MissionLite];
}

// ============ Garde-fous ============

/** < 4 joueurs actifs → saison annulée proprement lundi 9h. */
export function shouldCancelSeason(activePlayerCount: number): boolean {
  return activePlayerCount < MIN_ACTIVE_PLAYERS;
}

/** Lapin absent (0 message Slack depuis lundi) → saison blanche jeudi, sans le griller. */
export function isRabbitAsleep(rabbitMessagesSinceMonday: number): boolean {
  return rabbitMessagesSinceMonday === 0;
}

/**
 * Anti-fuite : un indice n'est publiable que s'il laisse assez de candidats.
 * (≥3 le mardi, ≥2 pour l'indice payant). Les indices ne s'appuient JAMAIS
 * sur les données de standup - vérifié à la génération, pas ici.
 */
export function isClueSafe(matchingCandidates: number, minCandidates: number): boolean {
  return matchingCandidates >= minCandidates;
}

// ============ Vote & scoring ============

export interface VoteTally {
  /** Suspect majoritaire, ou null en cas d'égalité / aucun vote. */
  topSuspectId: string | null;
  counts: Map<string, number>;
  totalVotes: number;
}

export function tallyVotes(votes: readonly VoteLite[]): VoteTally {
  const counts = new Map<string, number>();
  for (const v of votes) {
    counts.set(v.suspectId, (counts.get(v.suspectId) ?? 0) + 1);
  }
  let top: string | null = null;
  let topCount = 0;
  let tied = false;
  for (const [suspect, count] of counts) {
    if (count > topCount) {
      top = suspect;
      topCount = count;
      tied = false;
    } else if (count === topCount) {
      tied = true;
    }
  }
  return {
    topSuspectId: tied || top === null ? null : top,
    counts,
    totalVotes: votes.length,
  };
}

/**
 * Verdict du vendredi 16h :
 * - Détectives gagnent si la majorité désigne le Lapin (égalité = pas de démasquage).
 * - Lapin gagne s'il échappe au vote ET ≥ 2 missions accomplies.
 * - Match nul s'il échappe mais < 2 missions (règle anti-passivité).
 */
export function scoreSeason(input: {
  rabbitPlayerId: string;
  votes: readonly VoteLite[];
  missionsDone: number;
}): { result: SeasonResult; tally: VoteTally } {
  const tally = tallyVotes(input.votes);
  if (tally.topSuspectId === input.rabbitPlayerId) {
    return { result: "detectives_win", tally };
  }
  if (input.missionsDone >= MISSIONS_REQUIRED_FOR_WIN) {
    return { result: "rabbit_win", tally };
  }
  return { result: "draw", tally };
}

// ============ Carottes & streaks ============

/**
 * Récompense d'un standup. streakBefore = streak AVANT ce standup.
 * Le streak continue si le dernier standup date du jour ouvré précédent.
 */
export function standupReward(streakBefore: number): { carrots: number; newStreak: number } {
  const newStreak = streakBefore + 1;
  const bonus = Math.min((newStreak - 1) * STREAK_BONUS_STEP, STREAK_BONUS_CAP);
  return { carrots: STANDUP_BASE_CARROTS + bonus, newStreak };
}

/**
 * Le streak survit-il entre lastStandup et today ? (jours ouvrés : un standup
 * vendredi suivi d'un standup lundi conserve le streak).
 * Les deux dates sont des "YYYY-MM-DD".
 */
export function streakSurvives(lastStandupDay: string | null, today: string): boolean {
  if (!lastStandupDay) return false;
  const last = new Date(lastStandupDay + "T00:00:00Z");
  const now = new Date(today + "T00:00:00Z");
  const diffDays = Math.round((now.getTime() - last.getTime()) / 86400000);
  if (diffDays <= 0) return false; // même jour ou incohérent : géré en amont (upsert)
  if (diffDays === 1) return true;
  // vendredi (5) → lundi (1) = 3 jours ; on tolère aussi le week-end + férié simple non.
  return diffDays <= 3 && last.getUTCDay() === 5 && now.getUTCDay() === 1;
}

/** Paliers de drop d'items par streak. Retourne la rareté due ce jour, ou null. */
export function streakDropRarity(streak: number): "common" | "uncommon" | "rare" | null {
  if (streak === 3) return "common";
  if (streak === 5) return "uncommon";
  if (streak > 0 && streak % 10 === 0) return "rare";
  return null;
}

// ============ Planification (dispatcher horaire) ============

export type CronAction =
  | "start_season"
  | "standup_reminder"
  | "release_clue_1"
  | "release_paid_clue"
  | "release_clue_3"
  | "check_sleeping_rabbit"
  | "open_voting"
  | "vote_reminder"
  | "close_and_score"
  | "reveal";

/**
 * Actions dues pour une île à un instant local donné.
 * weekday : 0=dimanche … 6=samedi (convention JS). Le cron tourne à :00 et :30.
 * IDEMPOTENCE : chaque action revérifie l'état en base avant d'agir -
 * cette fonction dit seulement ce qui est PLANIFIÉ à cette heure.
 */
export function dueActions(weekday: number, hour: number, minute: number): CronAction[] {
  const actions: CronAction[] = [];
  const slot = minute < 30 ? 0 : 30;
  const isWorkday = weekday >= 1 && weekday <= 5;

  if (weekday === 1 && hour === 9 && slot === 0) actions.push("start_season");
  if (isWorkday && hour === 9 && slot === 30) actions.push("standup_reminder");
  if (weekday === 2 && hour === 10 && slot === 0) actions.push("release_clue_1");
  if (weekday === 3 && hour === 10 && slot === 0) actions.push("release_paid_clue");
  if (weekday === 4 && hour === 15 && slot === 0) actions.push("release_clue_3");
  if (weekday === 4 && hour === 17 && slot === 0) actions.push("check_sleeping_rabbit");
  if (weekday === 5 && hour === 11 && slot === 0) actions.push("open_voting");
  if (weekday === 5 && hour === 15 && slot === 30) actions.push("vote_reminder");
  if (weekday === 5 && hour === 16 && slot === 0) actions.push("close_and_score");
  if (weekday === 5 && hour === 16 && slot === 30) actions.push("reveal");
  return actions;
}

/** "YYYY-MM-DD" du lundi de la semaine contenant `date` (en UTC). */
export function mondayOfWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const delta = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

// ============ Limites de plan (Phase 5) ============

export type Plan = "free" | "team" | "company";

export const PLAN_LIMITS: Record<Plan, { maxPlayers: number | null; seasonsPerMonth: number | null }> = {
  free: { maxPlayers: 8, seasonsPerMonth: 1 },
  team: { maxPlayers: null, seasonsPerMonth: null },
  company: { maxPlayers: null, seasonsPerMonth: null },
};

/** startSeason refuse si free et déjà 1 saison ce mois-ci. */
export function canStartSeason(plan: Plan, seasonsThisMonth: number): boolean {
  const limit = PLAN_LIMITS[plan].seasonsPerMonth;
  return limit === null || seasonsThisMonth < limit;
}

export function canAddPlayer(plan: Plan, currentPlayers: number): boolean {
  const limit = PLAN_LIMITS[plan].maxPlayers;
  return limit === null || currentPlayers < limit;
}
