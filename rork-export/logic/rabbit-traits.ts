/**
 * seed → traits du lapin. Le lapin n'est jamais stocké, il est calculé.
 *
 * ⚠️ RÈGLE ABSOLUE : chaque tirage consomme le PRNG dans un ORDRE FIXE.
 * Ne jamais réordonner, insérer ou supprimer un tirage : ça changerait
 * tous les lapins existants. Pour ajouter un trait, l'ajouter À LA FIN.
 */
import { mulberry32, pickWeighted, toSeed32, type Weighted } from "./prng";

export type EarStyle = "straight" | "lop" | "one_folded" | "short" | "giant" | "twisted";
export type EyeStyle = "round" | "star" | "sleepy" | "sparkly" | "happy" | "monocle_wink" | "hypno";
export type CheekStyle = "pink" | "peach" | "freckles" | "none";
export type TailStyle = "pompom" | "heart" | "tiny";

export interface RabbitTraits {
  bodyColor: string;
  bellyColor: string;
  earStyle: EarStyle;
  earInner: string;
  eyeStyle: EyeStyle;
  cheeks: CheekStyle;
  tailStyle: TailStyle;
  sizeJitter: number;
}

// 14 pastels kawaii
export const BODY_PALETTE: Weighted<string>[] = [
  { value: "#F7F4EF", weight: 10 }, // crème
  { value: "#EBD8C3", weight: 9 }, // beige sable
  { value: "#D9C7F2", weight: 8 }, // lavande
  { value: "#F6C6D8", weight: 8 }, // rose dragée
  { value: "#C8E6F5", weight: 8 }, // bleu ciel
  { value: "#CDEBD3", weight: 8 }, // menthe
  { value: "#F5E3B3", weight: 7 }, // vanille
  { value: "#E8B89B", weight: 7 }, // abricot
  { value: "#BFC9D9", weight: 6 }, // gris bleuté
  { value: "#F2A9A0", weight: 5 }, // corail doux
  { value: "#B79BD9", weight: 4 }, // violet
  { value: "#9FD8CB", weight: 4 }, // turquoise pâle
  { value: "#8E7C6D", weight: 3 }, // chocolat au lait
  { value: "#52465E", weight: 2 }, // nuit (rare)
];

// 8 couleurs de ventre
export const BELLY_PALETTE: Weighted<string>[] = [
  { value: "#FFFDF8", weight: 10 },
  { value: "#FBF0E1", weight: 8 },
  { value: "#FCE8EE", weight: 7 },
  { value: "#EAF6FB", weight: 6 },
  { value: "#EDF8EF", weight: 6 },
  { value: "#FFF3CF", weight: 5 },
  { value: "#F3EAFB", weight: 4 },
  { value: "#FFE3D6", weight: 3 },
];

// 6 styles d'oreilles
export const EAR_STYLES: Weighted<EarStyle>[] = [
  { value: "straight", weight: 10 },
  { value: "lop", weight: 7 },
  { value: "one_folded", weight: 6 },
  { value: "short", weight: 5 },
  { value: "giant", weight: 3 },
  { value: "twisted", weight: 2 },
];

// 6 intérieurs d'oreilles
export const INNER_PALETTE: Weighted<string>[] = [
  { value: "#FCD7E2", weight: 10 },
  { value: "#FFE9D6", weight: 7 },
  { value: "#F6E6F9", weight: 6 },
  { value: "#E4F2F9", weight: 5 },
  { value: "#FFF4DA", weight: 4 },
  { value: "#E9F7EC", weight: 3 },
];

// 7 styles d'yeux
export const EYE_STYLES: Weighted<EyeStyle>[] = [
  { value: "round", weight: 10 },
  { value: "happy", weight: 8 },
  { value: "sleepy", weight: 6 },
  { value: "sparkly", weight: 5 },
  { value: "star", weight: 4 },
  { value: "monocle_wink", weight: 2 },
  { value: "hypno", weight: 1 }, // rare
];

// 4 styles de joues
export const CHEEK_STYLES: Weighted<CheekStyle>[] = [
  { value: "pink", weight: 10 },
  { value: "peach", weight: 6 },
  { value: "freckles", weight: 4 },
  { value: "none", weight: 3 },
];

// 3 styles de queue
export const TAIL_STYLES: Weighted<TailStyle>[] = [
  { value: "pompom", weight: 10 },
  { value: "heart", weight: 3 },
  { value: "tiny", weight: 4 },
];

export function deriveRabbit(seed: number | string | bigint): RabbitTraits {
  const rng = mulberry32(toSeed32(seed));
  return {
    bodyColor: pickWeighted(rng, BODY_PALETTE),
    bellyColor: pickWeighted(rng, BELLY_PALETTE),
    earStyle: pickWeighted(rng, EAR_STYLES),
    earInner: pickWeighted(rng, INNER_PALETTE),
    eyeStyle: pickWeighted(rng, EYE_STYLES),
    cheeks: pickWeighted(rng, CHEEK_STYLES),
    tailStyle: pickWeighted(rng, TAIL_STYLES),
    sizeJitter: 0.92 + rng() * 0.16,
  };
}
