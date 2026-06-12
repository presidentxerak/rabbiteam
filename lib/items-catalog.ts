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
  { slug: "beach_hat", name: "Bob de plage", slot: "head", rarity: "common", params: { shape: "bucket", color: "#F5E0B7", band: "#FF8C7A" }, unlockHint: "Streak de standups" },
  { slug: "party_hat", name: "Chapeau de fête", slot: "head", rarity: "common", params: { shape: "cone", color: "#F6C6D8", dots: "#FFFFFF" }, unlockHint: "Streak de standups" },
  { slug: "beret", name: "Béret", slot: "head", rarity: "common", params: { shape: "beret", color: "#52465E" }, unlockHint: "Streak de standups" },
  { slug: "headphones", name: "Casque audio", slot: "head", rarity: "uncommon", params: { shape: "headphones", color: "#7ED6DF", pad: "#52465E" }, unlockHint: "Streak de 5 jours" },
  { slug: "propeller_cap", name: "Casquette à hélice", slot: "head", rarity: "uncommon", params: { shape: "propeller", color: "#C8E6F5", propeller: "#FF8C7A" }, unlockHint: "Streak de 5 jours" },
  { slug: "flower_crown", name: "Couronne de fleurs", slot: "head", rarity: "rare", params: { shape: "flower_crown", colors: ["#F6C6D8", "#FFF3CF", "#CDEBD3"] }, unlockHint: "Victoire des Détectives" },
  { slug: "golden_crown", name: "Couronne dorée", slot: "head", rarity: "epic", params: { shape: "crown", color: "#F2C14E", gems: "#FF8C7A" }, unlockHint: "Palier de saisons jouées" },
  { slug: "halo", name: "Halo", slot: "head", rarity: "legendary", params: { shape: "halo", color: "#FFE9A0", glow: true }, unlockHint: "??? (très rare)" },

  // ============ FACE (6) ============
  { slug: "round_glasses", name: "Lunettes rondes", slot: "face", rarity: "common", params: { shape: "round", color: "#52465E" }, unlockHint: "Streak de standups" },
  { slug: "sunglasses", name: "Lunettes de soleil", slot: "face", rarity: "common", params: { shape: "square", color: "#2F2A38" }, unlockHint: "Streak de standups" },
  { slug: "heart_sunglasses", name: "Lunettes cœur", slot: "face", rarity: "uncommon", params: { shape: "heart", color: "#F2A9A0" }, unlockHint: "Streak de 5 jours" },
  { slug: "dive_mask", name: "Masque de plongée", slot: "face", rarity: "uncommon", params: { shape: "dive", color: "#7ED6DF", strap: "#52465E" }, unlockHint: "Victoire d'équipe" },
  { slug: "monocle", name: "Monocle", slot: "face", rarity: "rare", params: { shape: "monocle", color: "#F2C14E" }, unlockHint: "Victoire des Détectives" },
  { slug: "pirate_patch", name: "Cache-œil de pirate", slot: "face", rarity: "rare", params: { shape: "patch", color: "#2F2A38" }, unlockHint: "Victoire du Lapin" },

  // ============ NECK (6) ============
  { slug: "bow_tie", name: "Nœud papillon", slot: "neck", rarity: "common", params: { shape: "bow", color: "#FF8C7A" }, unlockHint: "Streak de standups" },
  { slug: "striped_scarf", name: "Écharpe rayée", slot: "neck", rarity: "common", params: { shape: "scarf", colors: ["#C8E6F5", "#FFFDF8"] }, unlockHint: "Streak de standups" },
  { slug: "bell_collar", name: "Collier à clochette", slot: "neck", rarity: "uncommon", params: { shape: "bell", color: "#D9C7F2", bell: "#F2C14E" }, unlockHint: "Streak de 5 jours" },
  { slug: "flower_lei", name: "Collier de fleurs", slot: "neck", rarity: "uncommon", params: { shape: "lei", colors: ["#F6C6D8", "#FFF3CF", "#CDEBD3"] }, unlockHint: "Victoire d'équipe" },
  { slug: "pearl_necklace", name: "Collier de perles", slot: "neck", rarity: "rare", params: { shape: "pearls", color: "#FFFDF8" }, unlockHint: "Victoire des Détectives" },
  { slug: "cape", name: "Cape", slot: "neck", rarity: "epic", params: { shape: "cape", color: "#B79BD9", lining: "#FFF3CF" }, unlockHint: "Palier de saisons jouées" },

  // ============ HAND (8) ============
  { slug: "carrot_classic", name: "Carotte classique", slot: "hand", rarity: "common", params: { shape: "carrot", color: "#FF8C42", leaf: "#7BC47F" }, unlockHint: "Premier standup" },
  { slug: "coffee_mug", name: "Tasse de café", slot: "hand", rarity: "common", params: { shape: "mug", color: "#FFFDF8", drink: "#6B4F3A" }, unlockHint: "Streak de standups" },
  { slug: "ice_cream", name: "Glace", slot: "hand", rarity: "common", params: { shape: "icecream", scoop: "#F6C6D8", cone: "#EBD8C3" }, unlockHint: "Streak de standups" },
  { slug: "mini_laptop", name: "Ordinateur mini", slot: "hand", rarity: "uncommon", params: { shape: "laptop", color: "#BFC9D9", screen: "#C8E6F5" }, unlockHint: "Streak de 5 jours" },
  { slug: "beach_racket", name: "Raquette de plage", slot: "hand", rarity: "uncommon", params: { shape: "racket", color: "#FF8C7A", grip: "#EBD8C3" }, unlockHint: "Victoire d'équipe" },
  { slug: "magnifier", name: "Loupe de détective", slot: "hand", rarity: "rare", params: { shape: "magnifier", color: "#F2C14E", glass: "#C8E6F5" }, unlockHint: "Victoire des Détectives" },
  { slug: "bubble_wand", name: "Baguette à bulles", slot: "hand", rarity: "rare", params: { shape: "wand", color: "#D9C7F2", bubbles: "#C8E6F5" }, unlockHint: "Victoire du Lapin" },
  { slug: "golden_carrot", name: "Carotte Dorée", slot: "hand", rarity: "legendary", params: { shape: "carrot", color: "#F2C14E", leaf: "#FFE9A0", glow: true }, unlockHint: "Parrainage validé — pour toute l'île 🥕✨" },

  // ============ AURA (6) ============
  { slug: "sparkles", name: "Étincelles", slot: "aura", rarity: "common", params: { kind: "sparkles", color: "#FFF3CF", count: 8 }, unlockHint: "Streak de standups" },
  { slug: "fireflies", name: "Lucioles", slot: "aura", rarity: "uncommon", params: { kind: "fireflies", color: "#FFE9A0", count: 10 }, unlockHint: "Streak de 5 jours" },
  { slug: "petal_particles", name: "Pétales", slot: "aura", rarity: "rare", params: { kind: "petals", color: "#F6C6D8", count: 12 }, unlockHint: "Victoire du Lapin" },
  { slug: "rain_cloud", name: "Petit nuage pluvieux", slot: "aura", rarity: "rare", params: { kind: "cloud", color: "#BFC9D9", drops: "#7ED6DF" }, unlockHint: "??? comique" },
  { slug: "stars", name: "Étoiles", slot: "aura", rarity: "epic", params: { kind: "stars", color: "#FFE9A0", count: 6 }, unlockHint: "Palier de saisons jouées" },
  { slug: "rainbow", name: "Arc-en-ciel", slot: "aura", rarity: "legendary", params: { kind: "rainbow", colors: ["#F2A9A0", "#FFE9A0", "#CDEBD3", "#C8E6F5", "#D9C7F2"] }, unlockHint: "??? (très rare)" },

  // ============ ISLAND (8) — améliorations visibles par tous ============
  { slug: "house_garland", name: "Guirlande sur la maison", slot: "island", rarity: "common", params: { kind: "garland", colors: ["#F6C6D8", "#FFF3CF", "#C8E6F5"] }, unlockHint: "Victoire des Détectives" },
  { slug: "campfire", name: "Feu de camp", slot: "island", rarity: "common", params: { kind: "campfire", flame: "#FF8C42", wood: "#6B4F3A" }, unlockHint: "4 saisons jouées" },
  { slug: "giant_buoy", name: "Bouée géante", slot: "island", rarity: "uncommon", params: { kind: "buoy", colors: ["#FF8C7A", "#FFFDF8"] }, unlockHint: "Victoire d'équipe" },
  { slug: "hammock", name: "Hamac", slot: "island", rarity: "uncommon", params: { kind: "hammock", color: "#CDEBD3" }, unlockHint: "12 saisons jouées" },
  { slug: "pontoon", name: "Ponton", slot: "island", rarity: "rare", params: { kind: "pontoon", color: "#EBD8C3" }, unlockHint: "24 saisons jouées" },
  { slug: "beach_swing", name: "Balançoire de plage", slot: "island", rarity: "rare", params: { kind: "swing", color: "#F5E0B7", rope: "#EBD8C3" }, unlockHint: "Victoire d'équipe" },
  { slug: "mini_lighthouse", name: "Phare miniature", slot: "island", rarity: "epic", params: { kind: "lighthouse", colors: ["#FF8C7A", "#FFFDF8"], light: "#FFE9A0" }, unlockHint: "24 saisons jouées" },
  { slug: "golden_palm", name: "Palmier doré", slot: "island", rarity: "legendary", params: { kind: "golden_palm", color: "#F2C14E" }, unlockHint: "Parrainage validé 🥕✨" },
];

/** Items droppables par palier de streak, par rareté. */
export function itemsByRarity(rarity: ItemRarity): ItemDef[] {
  return ITEMS_CATALOG.filter((i) => i.rarity === rarity && i.slot !== "island");
}
