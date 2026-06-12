import { describe, expect, it } from "vitest";
import {
  canAddPlayer,
  canStartSeason,
  dueActions,
  isClueSafe,
  isRabbitAsleep,
  mondayOfWeek,
  pickMissions,
  scoreSeason,
  selectRabbit,
  shouldCancelSeason,
  standupReward,
  streakDropRarity,
  streakSurvives,
  tallyVotes,
  type MissionLite,
  type PlayerLite,
} from "@/lib/game-engine";
import { mulberry32, pickWeighted, toSeed32 } from "@/lib/prng";
import { deriveRabbit } from "@/lib/rabbit-traits";
import { buildIsland, DECOR_CAP } from "@/lib/island-builder";
import { MISSIONS_BANK } from "@/lib/missions-bank";
import { verifySlackSignature } from "@/lib/slack/verify";
import { createHmac } from "node:crypto";

const players = (n: number, standups = 3): PlayerLite[] =>
  Array.from({ length: n }).map((_, i) => ({
    id: `p${i}`,
    isActive: true,
    standupsLastWeek: standups,
  }));

describe("selectRabbit", () => {
  it("exclut les Lapins des 2 dernières saisons", () => {
    const pool = players(6);
    for (let s = 0; s < 200; s++) {
      const rng = mulberry32(s);
      const rabbit = selectRabbit(pool, ["p0", "p1"], rng);
      expect(rabbit).not.toBe("p0");
      expect(rabbit).not.toBe("p1");
    }
  });

  it("exclut les joueurs sans standup la semaine passée", () => {
    const pool: PlayerLite[] = [
      { id: "actif", isActive: true, standupsLastWeek: 4 },
      { id: "fantome", isActive: true, standupsLastWeek: 0 },
    ];
    for (let s = 0; s < 50; s++) {
      expect(selectRabbit(pool, [], mulberry32(s))).toBe("actif");
    }
  });

  it("relâche l'exclusion plutôt que d'annuler quand le vivier est vide", () => {
    const pool = players(2);
    const rabbit = selectRabbit(pool, ["p0", "p1"], mulberry32(7));
    expect(rabbit === "p0" || rabbit === "p1").toBe(true);
  });

  it("retourne null si personne n'est éligible", () => {
    expect(selectRabbit(players(4, 0), [], mulberry32(1))).toBeNull();
    expect(selectRabbit([], [], mulberry32(1))).toBeNull();
  });

  it("est pondéré : plus de standups → sélection plus fréquente", () => {
    const pool: PlayerLite[] = [
      { id: "assidu", isActive: true, standupsLastWeek: 5 },
      { id: "discret", isActive: true, standupsLastWeek: 1 },
    ];
    let assidu = 0;
    for (let s = 0; s < 2000; s++) {
      if (selectRabbit(pool, [], mulberry32(s)) === "assidu") assidu++;
    }
    expect(assidu).toBeGreaterThan(1200); // ≈ 6/8 attendu
  });
});

describe("pickMissions", () => {
  const bank: MissionLite[] = MISSIONS_BANK.map((m, i) => ({
    id: `m${i}`,
    slug: m.slug,
    tool: m.tool,
    difficulty: m.difficulty,
  }));

  it("tire 1 facile, 1 moyenne, 1 difficile", () => {
    const picked = pickMissions(bank, [], mulberry32(42));
    expect(picked).not.toBeNull();
    expect(picked!.map((m) => m.difficulty)).toEqual([1, 2, 3]);
  });

  it("varie les outils quand c'est possible", () => {
    for (let s = 0; s < 100; s++) {
      const picked = pickMissions(bank, [], mulberry32(s));
      const tools = picked!.map((m) => m.tool).filter((t) => t !== "any");
      expect(new Set(tools).size).toBe(tools.length);
    }
  });

  it("ne répète jamais une mission récente", () => {
    const recent = bank.slice(0, 30).map((m) => m.id);
    for (let s = 0; s < 50; s++) {
      const picked = pickMissions(bank, recent, mulberry32(s));
      for (const m of picked!) expect(recent).not.toContain(m.id);
    }
  });

  it("retourne null si la banque est épuisée pour une difficulté", () => {
    const onlyEasy = bank.filter((m) => m.difficulty === 1);
    expect(pickMissions(onlyEasy, [], mulberry32(1))).toBeNull();
  });
});

describe("tallyVotes & scoreSeason", () => {
  it("majorité correcte → Détectives gagnent", () => {
    const { result } = scoreSeason({
      rabbitPlayerId: "rab",
      votes: [
        { voterId: "a", suspectId: "rab" },
        { voterId: "b", suspectId: "rab" },
        { voterId: "c", suspectId: "x" },
      ],
      missionsDone: 3,
    });
    expect(result).toBe("detectives_win");
  });

  it("égalité = pas de démasquage", () => {
    const tally = tallyVotes([
      { voterId: "a", suspectId: "rab" },
      { voterId: "b", suspectId: "x" },
    ]);
    expect(tally.topSuspectId).toBeNull();
  });

  it("échappe + ≥2 missions → Lapin gagne", () => {
    const { result } = scoreSeason({
      rabbitPlayerId: "rab",
      votes: [
        { voterId: "a", suspectId: "x" },
        { voterId: "b", suspectId: "x" },
      ],
      missionsDone: 2,
    });
    expect(result).toBe("rabbit_win");
  });

  it("échappe mais <2 missions → match nul (anti-passivité)", () => {
    const { result } = scoreSeason({
      rabbitPlayerId: "rab",
      votes: [{ voterId: "a", suspectId: "x" }],
      missionsDone: 1,
    });
    expect(result).toBe("draw");
  });

  it("aucun vote → le Lapin n'est pas démasqué", () => {
    const { result } = scoreSeason({ rabbitPlayerId: "rab", votes: [], missionsDone: 2 });
    expect(result).toBe("rabbit_win");
  });
});

describe("garde-fous", () => {
  it("< 4 joueurs actifs → saison annulée", () => {
    expect(shouldCancelSeason(3)).toBe(true);
    expect(shouldCancelSeason(4)).toBe(false);
  });

  it("Lapin sans activité → endormi", () => {
    expect(isRabbitAsleep(0)).toBe(true);
    expect(isRabbitAsleep(1)).toBe(false);
  });

  it("un indice doit laisser assez de candidats", () => {
    expect(isClueSafe(3, 3)).toBe(true);
    expect(isClueSafe(2, 3)).toBe(false);
  });
});

describe("carottes & streaks", () => {
  it("standup de base = 10 🥕, bonus croissant plafonné", () => {
    expect(standupReward(0)).toEqual({ carrots: 10, newStreak: 1 });
    expect(standupReward(1)).toEqual({ carrots: 12, newStreak: 2 });
    expect(standupReward(20).carrots).toBe(20); // 10 + cap 10
  });

  it("le streak survit au week-end (vendredi → lundi)", () => {
    expect(streakSurvives("2026-06-05", "2026-06-08")).toBe(true); // ven → lun
    expect(streakSurvives("2026-06-04", "2026-06-08")).toBe(false); // jeu → lun
    expect(streakSurvives("2026-06-08", "2026-06-09")).toBe(true); // lun → mar
    expect(streakSurvives(null, "2026-06-09")).toBe(false);
  });

  it("paliers de drops : 3 common, 5 uncommon, ×10 rare", () => {
    expect(streakDropRarity(3)).toBe("common");
    expect(streakDropRarity(5)).toBe("uncommon");
    expect(streakDropRarity(10)).toBe("rare");
    expect(streakDropRarity(20)).toBe("rare");
    expect(streakDropRarity(4)).toBeNull();
  });
});

describe("dueActions (dispatcher)", () => {
  it("lundi 9h00 → start_season", () => {
    expect(dueActions(1, 9, 0)).toContain("start_season");
  });
  it("jours ouvrés 9h30 → rappel standup ; pas le week-end", () => {
    for (const d of [1, 2, 3, 4, 5]) expect(dueActions(d, 9, 30)).toContain("standup_reminder");
    expect(dueActions(6, 9, 30)).toEqual([]);
    expect(dueActions(0, 9, 30)).toEqual([]);
  });
  it("la semaine du Lapin est complète", () => {
    expect(dueActions(2, 10, 0)).toContain("release_clue_1");
    expect(dueActions(3, 10, 0)).toContain("release_paid_clue");
    expect(dueActions(4, 15, 0)).toContain("release_clue_3");
    expect(dueActions(4, 17, 0)).toContain("check_sleeping_rabbit");
    expect(dueActions(5, 11, 0)).toContain("open_voting");
    expect(dueActions(5, 15, 30)).toContain("vote_reminder");
    expect(dueActions(5, 16, 0)).toContain("close_and_score");
    expect(dueActions(5, 16, 30)).toContain("reveal");
  });
  it("aucune action en dehors des créneaux", () => {
    expect(dueActions(1, 14, 0)).toEqual([]);
    expect(dueActions(0, 9, 0)).toEqual([]);
  });
});

describe("mondayOfWeek", () => {
  it("retourne le lundi de la semaine", () => {
    expect(mondayOfWeek(new Date("2026-06-12T10:00:00Z"))).toBe("2026-06-08"); // vendredi
    expect(mondayOfWeek(new Date("2026-06-08T00:00:00Z"))).toBe("2026-06-08"); // lundi
    expect(mondayOfWeek(new Date("2026-06-14T23:00:00Z"))).toBe("2026-06-08"); // dimanche
  });
});

describe("limites de plan", () => {
  it("free : 1 saison/mois, 8 joueurs", () => {
    expect(canStartSeason("free", 0)).toBe(true);
    expect(canStartSeason("free", 1)).toBe(false);
    expect(canStartSeason("team", 12)).toBe(true);
    expect(canAddPlayer("free", 8)).toBe(false);
    expect(canAddPlayer("team", 500)).toBe(true);
  });
});

describe("PRNG & lapins", () => {
  it("mulberry32 est déterministe", () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    for (let i = 0; i < 10; i++) expect(a()).toBe(b());
  });

  it("deriveRabbit est stable pour un seed donné (contrat : ne jamais changer)", () => {
    const r1 = deriveRabbit(424242);
    const r2 = deriveRabbit(424242);
    expect(r1).toEqual(r2);
    expect(r1.sizeJitter).toBeGreaterThanOrEqual(0.92);
    expect(r1.sizeJitter).toBeLessThanOrEqual(1.08);
  });

  it("accepte les seeds bigint sérialisés en string (Postgres)", () => {
    expect(deriveRabbit("9007199254740993")).toEqual(deriveRabbit("9007199254740993"));
    expect(toSeed32("123")).toBe(toSeed32("123"));
  });

  it("pickWeighted respecte approximativement les poids", () => {
    const table = [
      { value: "common", weight: 90 },
      { value: "rare", weight: 10 },
    ];
    let rare = 0;
    const rng = mulberry32(7);
    for (let i = 0; i < 5000; i++) if (pickWeighted(rng, table) === "rare") rare++;
    expect(rare).toBeGreaterThan(300);
    expect(rare).toBeLessThan(800);
  });
});

describe("island-builder", () => {
  it("est déterministe : même seed + mêmes events → même île", () => {
    const events = Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      type: i % 3 === 0 ? "standup" : i % 3 === 1 ? "kudo" : "notion_page",
    }));
    expect(buildIsland(987654321, events)).toEqual(buildIsland(987654321, events));
  });

  it("respecte le cap de décorations en fusionnant en massifs", () => {
    const events = Array.from({ length: 600 }).map((_, i) => ({ id: i, type: "standup" }));
    const scene = buildIsland(1, events);
    expect(scene.decorations.length).toBeLessThanOrEqual(DECOR_CAP);
    expect(scene.stats.mergedCount).toBeGreaterThan(0);
    expect(scene.decorations.some((d) => d.kind === "massif")).toBe(true);
  });

  it("les monuments ne fusionnent jamais", () => {
    const events = [
      ...Array.from({ length: 500 }).map((_, i) => ({ id: i, type: "standup" })),
      { id: 9999, type: "season_rabbit_win" },
    ];
    const scene = buildIsland(1, events);
    expect(scene.decorations.some((d) => d.kind === "rabbit_statue")).toBe(true);
  });

  it("génère 2-3 palmiers et 3-5 buissons", () => {
    for (let s = 0; s < 30; s++) {
      const scene = buildIsland(s, []);
      expect(scene.palms.length).toBeGreaterThanOrEqual(2);
      expect(scene.palms.length).toBeLessThanOrEqual(3);
      expect(scene.bushes.length).toBeGreaterThanOrEqual(3);
      expect(scene.bushes.length).toBeLessThanOrEqual(5);
    }
  });
});

describe("vérification HMAC Slack", () => {
  const secret = "test_signing_secret";
  const body = "payload=%7B%22type%22%3A%22block_actions%22%7D";

  function sign(ts: string, b: string): string {
    return `v0=${createHmac("sha256", secret).update(`v0:${ts}:${b}`).digest("hex")}`;
  }

  it("accepte une signature valide", () => {
    const now = Date.now();
    const ts = String(Math.floor(now / 1000));
    expect(
      verifySlackSignature({
        signingSecret: secret,
        body,
        timestamp: ts,
        signature: sign(ts, body),
        nowMs: now,
      }),
    ).toBe(true);
  });

  it("rejette une signature falsifiée", () => {
    const now = Date.now();
    const ts = String(Math.floor(now / 1000));
    expect(
      verifySlackSignature({
        signingSecret: secret,
        body,
        timestamp: ts,
        signature: sign(ts, body + "x"),
        nowMs: now,
      }),
    ).toBe(false);
  });

  it("rejette un replay de plus de 5 minutes", () => {
    const now = Date.now();
    const oldTs = String(Math.floor(now / 1000) - 600);
    expect(
      verifySlackSignature({
        signingSecret: secret,
        body,
        timestamp: oldTs,
        signature: sign(oldTs, body),
        nowMs: now,
      }),
    ).toBe(false);
  });

  it("rejette les en-têtes manquants", () => {
    expect(
      verifySlackSignature({ signingSecret: secret, body, timestamp: null, signature: null }),
    ).toBe(false);
  });
});

describe("banque de missions", () => {
  it("contient 60 missions avec les 3 difficultés par outil principal", () => {
    expect(MISSIONS_BANK.length).toBe(60);
    for (const tool of ["slack", "notion", "kanban", "any"] as const) {
      for (const d of [1, 2, 3] as const) {
        expect(
          MISSIONS_BANK.some((m) => m.tool === tool && m.difficulty === d),
        ).toBe(true);
      }
    }
  });

  it("tous les slugs sont uniques", () => {
    const slugs = MISSIONS_BANK.map((m) => m.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
