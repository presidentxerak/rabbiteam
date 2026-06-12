/**
 * Catalogue des items 3D (~42 au lancement). Source de vérité TypeScript ;
 * le seed SQL est généré depuis ce fichier (scripts/generate-seed.ts).
 * `params` décrit couleurs/dimensions/ancrage : le composant React du slot
 * lit params et construit la géométrie. Ajouter un item = 1 entrée ici
 * (+ éventuellement 1 petit composant si la forme est inédite).
 */

export type ItemSlot = "head" | "face" | "neck" | "hand" | "aura" | "island";
export type ItemRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface ItemDef {
  slug: string;
  name: string;
  slot: ItemSlot;
  rarity: ItemRarity;
  params: Record<string, unknown>;
  unlockHint: string;
}

export const ITEMS_CATALOG: ItemDef[] = [
  // ============ HEAD (8) ============
  { slug: "beach_hat", name: "Beach hat", slot: "head", rarity: "common", params: { shape: "bucket", color: "#F5E0B7", band: "#FF8C7A" }, unlockHint: "Standup streak" },
  { slug: "party_hat", name: "Party hat", slot: "head", rarity: "common", params: { shape: "cone", color: "#F6C6D8", dots: "#FFFFFF" }, unlockHint: "Standup streak" },
  { slug: "beret", name: "Beret", slot: "head", rarity: "common", params: { shape: "beret", color: "#52465E" }, unlockHint: "Standup streak" },
  { slug: "headphones", name: "Headphones", slot: "head", rarity: "uncommon", params: { shape: "headphones", color: "#7ED6DF", pad: "#52465E" }, unlockHint: "5-day streak" },
  { slug: "propeller_cap", name: "Propeller cap", slot: "head", rarity: "uncommon", params: { shape: "propeller", color: "#C8E6F5", propeller: "#FF8C7A" }, unlockHint: "5-day streak" },
  { slug: "flower_crown", name: "Flower crown", slot: "head", rarity: "rare", params: { shape: "flower_crown", colors: ["#F6C6D8", "#FFF3CF", "#CDEBD3"] }, unlockHint: "Detectives' victory" },
  { slug: "golden_crown", name: "Golden crown", slot: "head", rarity: "epic", params: { shape: "crown", color: "#F2C14E", gems: "#FF8C7A" }, unlockHint: "Seasons-played milestone" },
  { slug: "halo", name: "Halo", slot: "head", rarity: "legendary", params: { shape: "halo", color: "#FFE9A0", glow: true }, unlockHint: "??? (very rare)" },

  // ============ FACE (6) ============
  { slug: "round_glasses", name: "Round glasses", slot: "face", rarity: "common", params: { shape: "round", color: "#52465E" }, unlockHint: "Standup streak" },
  { slug: "sunglasses", name: "Sunglasses", slot: "face", rarity: "common", params: { shape: "square", color: "#2F2A38" }, unlockHint: "Standup streak" },
  { slug: "heart_sunglasses", name: "Heart sunglasses", slot: "face", rarity: "uncommon", params: { shape: "heart", color: "#F2A9A0" }, unlockHint: "5-day streak" },
  { slug: "dive_mask", name: "Diving mask", slot: "face", rarity: "uncommon", params: { shape: "dive", color: "#7ED6DF", strap: "#52465E" }, unlockHint: "Team victory" },
  { slug: "monocle", name: "Monocle", slot: "face", rarity: "rare", params: { shape: "monocle", color: "#F2C14E" }, unlockHint: "Detectives' victory" },
  { slug: "pirate_patch", name: "Pirate eye patch", slot: "face", rarity: "rare", params: { shape: "patch", color: "#2F2A38" }, unlockHint: "Rabbit victory" },

  // ============ NECK (6) ============
  { slug: "bow_tie", name: "Bow tie", slot: "neck", rarity: "common", params: { shape: "bow", color: "#FF8C7A" }, unlockHint: "Standup streak" },
  { slug: "striped_scarf", name: "Striped scarf", slot: "neck", rarity: "common", params: { shape: "scarf", colors: ["#C8E6F5", "#FFFDF8"] }, unlockHint: "Standup streak" },
  { slug: "bell_collar", name: "Bell collar", slot: "neck", rarity: "uncommon", params: { shape: "bell", color: "#D9C7F2", bell: "#F2C14E" }, unlockHint: "5-day streak" },
  { slug: "flower_lei", name: "Flower lei", slot: "neck", rarity: "uncommon", params: { shape: "lei", colors: ["#F6C6D8", "#FFF3CF", "#CDEBD3"] }, unlockHint: "Team victory" },
  { slug: "pearl_necklace", name: "Pearl necklace", slot: "neck", rarity: "rare", params: { shape: "pearls", color: "#FFFDF8" }, unlockHint: "Detectives' victory" },
  { slug: "cape", name: "Cape", slot: "neck", rarity: "epic", params: { shape: "cape", color: "#B79BD9", lining: "#FFF3CF" }, unlockHint: "Seasons-played milestone" },

  // ============ HAND (8) ============
  { slug: "carrot_classic", name: "Classic carrot", slot: "hand", rarity: "common", params: { shape: "carrot", color: "#FF8C42", leaf: "#7BC47F" }, unlockHint: "First standup" },
  { slug: "coffee_mug", name: "Coffee mug", slot: "hand", rarity: "common", params: { shape: "mug", color: "#FFFDF8", drink: "#6B4F3A" }, unlockHint: "Standup streak" },
  { slug: "ice_cream", name: "Ice cream", slot: "hand", rarity: "common", params: { shape: "icecream", scoop: "#F6C6D8", cone: "#EBD8C3" }, unlockHint: "Standup streak" },
  { slug: "mini_laptop", name: "Mini laptop", slot: "hand", rarity: "uncommon", params: { shape: "laptop", color: "#BFC9D9", screen: "#C8E6F5" }, unlockHint: "5-day streak" },
  { slug: "beach_racket", name: "Beach paddle", slot: "hand", rarity: "uncommon", params: { shape: "racket", color: "#FF8C7A", grip: "#EBD8C3" }, unlockHint: "Team victory" },
  { slug: "magnifier", name: "Detective's magnifier", slot: "hand", rarity: "rare", params: { shape: "magnifier", color: "#F2C14E", glass: "#C8E6F5" }, unlockHint: "Detectives' victory" },
  { slug: "bubble_wand", name: "Bubble wand", slot: "hand", rarity: "rare", params: { shape: "wand", color: "#D9C7F2", bubbles: "#C8E6F5" }, unlockHint: "Rabbit victory" },
  { slug: "golden_carrot", name: "Golden Carrot", slot: "hand", rarity: "legendary", params: { shape: "carrot", color: "#F2C14E", leaf: "#FFE9A0", glow: true }, unlockHint: "Validated referral — for the whole island 🥕✨" },

  // ============ AURA (6) ============
  { slug: "sparkles", name: "Sparkles", slot: "aura", rarity: "common", params: { kind: "sparkles", color: "#FFF3CF", count: 8 }, unlockHint: "Standup streak" },
  { slug: "fireflies", name: "Fireflies", slot: "aura", rarity: "uncommon", params: { kind: "fireflies", color: "#FFE9A0", count: 10 }, unlockHint: "5-day streak" },
  { slug: "petal_particles", name: "Petals", slot: "aura", rarity: "rare", params: { kind: "petals", color: "#F6C6D8", count: 12 }, unlockHint: "Rabbit victory" },
  { slug: "rain_cloud", name: "Tiny rain cloud", slot: "aura", rarity: "rare", params: { kind: "cloud", color: "#BFC9D9", drops: "#7ED6DF" }, unlockHint: "??? (funny)" },
  { slug: "stars", name: "Stars", slot: "aura", rarity: "epic", params: { kind: "stars", color: "#FFE9A0", count: 6 }, unlockHint: "Seasons-played milestone" },
  { slug: "rainbow", name: "Rainbow", slot: "aura", rarity: "legendary", params: { kind: "rainbow", colors: ["#F2A9A0", "#FFE9A0", "#CDEBD3", "#C8E6F5", "#D9C7F2"] }, unlockHint: "??? (very rare)" },

  // ============ ISLAND (8) — upgrades visible to everyone ============
  { slug: "house_garland", name: "House garland", slot: "island", rarity: "common", params: { kind: "garland", colors: ["#F6C6D8", "#FFF3CF", "#C8E6F5"] }, unlockHint: "Detectives' victory" },
  { slug: "campfire", name: "Campfire", slot: "island", rarity: "common", params: { kind: "campfire", flame: "#FF8C42", wood: "#6B4F3A" }, unlockHint: "4 seasons played" },
  { slug: "giant_buoy", name: "Giant buoy", slot: "island", rarity: "uncommon", params: { kind: "buoy", colors: ["#FF8C7A", "#FFFDF8"] }, unlockHint: "Team victory" },
  { slug: "hammock", name: "Hammock", slot: "island", rarity: "uncommon", params: { kind: "hammock", color: "#CDEBD3" }, unlockHint: "12 seasons played" },
  { slug: "pontoon", name: "Pontoon", slot: "island", rarity: "rare", params: { kind: "pontoon", color: "#EBD8C3" }, unlockHint: "24 seasons played" },
  { slug: "beach_swing", name: "Beach swing", slot: "island", rarity: "rare", params: { kind: "swing", color: "#F5E0B7", rope: "#EBD8C3" }, unlockHint: "Team victory" },
  { slug: "mini_lighthouse", name: "Mini lighthouse", slot: "island", rarity: "epic", params: { kind: "lighthouse", colors: ["#FF8C7A", "#FFFDF8"], light: "#FFE9A0" }, unlockHint: "24 seasons played" },
  { slug: "golden_palm", name: "Golden palm", slot: "island", rarity: "legendary", params: { kind: "golden_palm", color: "#F2C14E" }, unlockHint: "Validated referral 🥕✨" },
];

/** Items droppables par palier de streak, par rareté. */
export function itemsByRarity(rarity: ItemRarity): ItemDef[] {
  return ITEMS_CATALOG.filter((i) => i.rarity === rarity && i.slot !== "island");
}
