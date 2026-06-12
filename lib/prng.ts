/**
 * PRNG déterministe (mulberry32) + hash de seed.
 * Tout le visuel du jeu (lapins, île, positions) dérive de ces fonctions :
 * même seed → même résultat, sur tous les clients, pour toujours.
 */

export function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash 32 bits stable d'une chaîne (xmur3) - pour dériver des sous-seeds. */
export function hashSeed(input: string): number {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** Réduit un bigint (avatar_seed / island seed, reçu en string ou number) en seed 32 bits. */
export function toSeed32(seed: number | string | bigint): number {
  if (typeof seed === "number" && Number.isSafeInteger(seed)) {
    return seed >>> 0 ^ (Math.floor(seed / 4294967296) >>> 0);
  }
  return hashSeed(String(seed));
}

/** Génère un seed aléatoire positif qui tient dans un bigint Postgres. */
export function randomSeed(): number {
  return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
}

export interface Weighted<T> {
  value: T;
  weight: number;
}

/** Tirage pondéré : consomme exactement UN appel du PRNG (ordre stable). */
export function pickWeighted<T>(rng: () => number, table: readonly Weighted<T>[]): T {
  const total = table.reduce((s, e) => s + e.weight, 0);
  let r = rng() * total;
  for (const entry of table) {
    r -= entry.weight;
    if (r < 0) return entry.value;
  }
  const last = table[table.length - 1];
  if (!last) throw new Error("pickWeighted: empty table");
  return last.value;
}

/** Tirage uniforme dans un tableau : consomme exactement UN appel du PRNG. */
export function pickOne<T>(rng: () => number, arr: readonly T[]): T {
  const v = arr[Math.floor(rng() * arr.length)];
  if (v === undefined) throw new Error("pickOne: empty array");
  return v;
}
