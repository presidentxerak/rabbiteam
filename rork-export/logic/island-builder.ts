/**
 * (islandSeed, events[]) → SceneDescriptor.
 * Fonction PURE et déterministe : aucun rendu serveur, aucun état 3D en base.
 * L'île est entièrement reconstruite côté client à partir du seed et du
 * journal d'événements (island_events). Même entrée → même île, partout.
 */
import { hashSeed, mulberry32, toSeed32 } from "./prng";

export interface IslandEventLite {
  type: string;
  /** id stable de l'événement (sert de seed de position). */
  id: string | number;
}

export type DecorationKind =
  | "flower"
  | "lantern"
  | "shell"
  | "pebble"
  | "rabbit_statue" // victoire du Lapin
  | "magnifier_monument" // victoire des Détectives
  | "golden_palm" // parrainage Carotte Dorée
  | "sapling" // nouveau membre
  | "massif"; // fusion d'anciennes décorations (cap de perf)

export interface Decoration {
  kind: DecorationKind;
  /** Position polaire sur l'île : angle [0,2π), rayon [0,1] normalisé. */
  angle: number;
  radius: number;
  scale: number;
  hueShift: number;
  /** Pour les massifs : nombre d'éléments fusionnés. */
  merged?: number;
}

export interface PalmDescriptor {
  angle: number;
  radius: number;
  lean: number;
  height: number;
  golden?: boolean;
}

export interface BushDescriptor {
  angle: number;
  radius: number;
  scale: number;
}

export interface SceneDescriptor {
  palms: PalmDescriptor[];
  bushes: BushDescriptor[];
  decorations: Decoration[];
  /** Slugs d'items 'island' débloqués (guirlande, bouée géante, feu de camp…). */
  islandItems: string[];
  stats: { totalEvents: number; mergedCount: number };
}

export const DECOR_CAP = 300;

const EVENT_DECOR: Record<string, DecorationKind> = {
  standup: "flower",
  kudo: "shell",
  notion_page: "lantern",
  sprint_done: "pebble",
  member_joined: "sapling",
  season_rabbit_win: "rabbit_statue",
  season_detective_win: "magnifier_monument",
  referral: "golden_palm",
};

/** Les monuments ne fusionnent jamais dans les massifs. */
const PERMANENT: ReadonlySet<DecorationKind> = new Set([
  "rabbit_statue",
  "magnifier_monument",
  "golden_palm",
]);

export function buildIsland(
  islandSeed: number | string | bigint,
  events: readonly IslandEventLite[],
  islandItems: readonly string[] = [],
): SceneDescriptor {
  const baseRng = mulberry32(toSeed32(islandSeed));

  // ---- Végétation fixe dérivée du seed (2-3 palmiers, 3-5 buissons) ----
  const palmCount = 2 + Math.floor(baseRng() * 2);
  const palms: PalmDescriptor[] = [];
  for (let i = 0; i < palmCount; i++) {
    palms.push({
      angle: baseRng() * Math.PI * 2,
      radius: 0.55 + baseRng() * 0.3,
      lean: 0.1 + baseRng() * 0.25,
      height: 1.6 + baseRng() * 0.8,
    });
  }
  const bushCount = 3 + Math.floor(baseRng() * 3);
  const bushes: BushDescriptor[] = [];
  for (let i = 0; i < bushCount; i++) {
    bushes.push({
      angle: baseRng() * Math.PI * 2,
      radius: 0.35 + baseRng() * 0.45,
      scale: 0.5 + baseRng() * 0.5,
    });
  }

  // ---- Croissance événementielle ----
  const all: Decoration[] = [];
  for (const ev of events) {
    const kind = EVENT_DECOR[ev.type];
    if (!kind) continue;
    // Position seedée par l'id d'événement : stable même si la liste grandit.
    const rng = mulberry32(hashSeed(`${ev.type}:${ev.id}`));
    all.push({
      kind,
      angle: rng() * Math.PI * 2,
      radius: kind === "rabbit_statue" || kind === "magnifier_monument"
        ? 0.25 + rng() * 0.15 // monuments près de la maison
        : 0.3 + rng() * 0.6,
      scale: 0.7 + rng() * 0.6,
      hueShift: rng() * 0.15 - 0.075,
    });
  }

  // ---- Cap de perf : au-delà de DECOR_CAP, les plus anciennes décorations
  //      ordinaires fusionnent en "massifs" (1 massif ≈ 20 éléments) ----
  const permanent = all.filter((d) => PERMANENT.has(d.kind));
  const ordinary = all.filter((d) => !PERMANENT.has(d.kind));
  let decorations: Decoration[];
  let mergedCount = 0;

  const budget = DECOR_CAP - permanent.length;
  if (ordinary.length <= budget) {
    decorations = [...permanent, ...ordinary];
  } else {
    // Les massifs comptent dans le budget : on cherche le point fixe où
    // kept + massifs == budget (les massifs absorbent ~20 éléments chacun).
    let massifCount = 1;
    for (let i = 0; i < 10; i++) {
      const next = Math.max(1, Math.ceil((ordinary.length - (budget - massifCount)) / 20));
      if (next === massifCount) break;
      massifCount = next;
    }
    const keptCount = Math.max(0, budget - massifCount);
    const overflow = ordinary.length - keptCount;
    const toMerge = ordinary.slice(0, overflow);
    const kept = ordinary.slice(overflow);
    mergedCount = toMerge.length;
    const massifs: Decoration[] = [];
    for (let i = 0; i < massifCount; i++) {
      const rng = mulberry32(hashSeed(`massif:${islandSeed}:${i}`));
      massifs.push({
        kind: "massif",
        angle: rng() * Math.PI * 2,
        radius: 0.4 + rng() * 0.45,
        scale: 1 + Math.min(toMerge.length / 40, 1.5),
        hueShift: 0,
        merged: Math.min(20, toMerge.length - i * 20),
      });
    }
    decorations = [...permanent, ...massifs, ...kept];
  }

  return {
    palms,
    bushes,
    decorations,
    islandItems: [...islandItems],
    stats: { totalEvents: events.length, mergedCount },
  };
}
