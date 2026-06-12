/**
 * Génération des indices de la semaine.
 * Règles : jamais de données de standup (anti-meta) ; un indice doit laisser
 * ≥3 candidats le mardi (gratuit) et ≥2 pour l'indice payant du mercredi.
 * Les gabarits ne s'appuient que sur des faits observables par tous :
 * ancienneté, lettres du prénom, traits du lapin (avatar public), outil
 * d'une mission en cours.
 */
import "server-only";
import { deriveRabbit } from "@/lib/rabbit-traits";
import { isClueSafe } from "@/lib/game-engine";
import type { PlayerRow } from "./db-types";

interface ClueTemplate {
  /** Renvoie le texte si applicable au Lapin, sinon null. */
  build: (rabbit: PlayerRow, all: PlayerRow[], missionTools: string[]) => string | null;
  /** Combien de joueurs actifs correspondent à l'indice ? */
  candidates: (rabbit: PlayerRow, all: PlayerRow[], missionTools: string[]) => number;
}

const EAR_LABELS: Record<string, string> = {
  straight: "droites",
  lop: "tombantes",
  one_folded: "avec une oreille pliée",
  short: "courtes",
  giant: "géantes",
  twisted: "vrillées",
};

function firstLetter(name: string): string {
  return (name.trim()[0] ?? "?").toUpperCase();
}

function seniorityWeeks(p: PlayerRow, now: Date): number {
  return Math.floor((now.getTime() - new Date(p.created_at).getTime()) / (7 * 86400000));
}

const TEMPLATES: ClueTemplate[] = [
  {
    // Trait visible du lapin 3D : pousse les joueurs à observer l'île 🏝️
    build: (rabbit) => {
      const ears = deriveRabbit(rabbit.avatar_seed).earStyle;
      return `Le lapin (l'avatar !) du Lapin a les oreilles ${EAR_LABELS[ears] ?? ears}.`;
    },
    candidates: (rabbit, all) => {
      const ears = deriveRabbit(rabbit.avatar_seed).earStyle;
      return all.filter((p) => deriveRabbit(p.avatar_seed).earStyle === ears).length;
    },
  },
  {
    build: (_rabbit, _all, tools) => {
      const real = tools.filter((t) => t !== "any");
      const t = real[0];
      if (!t) return null;
      const label = t === "slack" ? "Slack" : t === "notion" ? "Notion" : "le Kanban";
      return `Au moins une des missions du Lapin se joue dans ${label}.`;
    },
    // Indice sur les missions, pas sur une personne : tout le monde reste candidat.
    candidates: (_rabbit, all) => all.length,
  },
  {
    build: (rabbit, all, _tools) => {
      const letter = firstLetter(rabbit.display_name);
      const sharing = all.filter((p) => firstLetter(p.display_name) === letter).length;
      if (sharing < 2) return null; // isolerait une personne
      return `Le prénom du Lapin commence par une lettre entre ${letter < "M" ? "A et M" : "N et Z"}.`;
    },
    candidates: (rabbit, all) => {
      const half = firstLetter(rabbit.display_name) < "M";
      return all.filter((p) => (firstLetter(p.display_name) < "M") === half).length;
    },
  },
  {
    build: (rabbit, all) => {
      const even = rabbit.display_name.replace(/\s/g, "").length % 2 === 0;
      void all;
      return `Le nom du Lapin compte un nombre ${even ? "pair" : "impair"} de lettres.`;
    },
    candidates: (rabbit, all) => {
      const even = rabbit.display_name.replace(/\s/g, "").length % 2 === 0;
      return all.filter((p) => (p.display_name.replace(/\s/g, "").length % 2 === 0) === even).length;
    },
  },
  {
    build: (rabbit, all) => {
      const now = new Date();
      const weeks = seniorityWeeks(rabbit, now);
      const median = medianSeniority(all, now);
      return weeks >= median
        ? `Le Lapin fait partie des membres les plus anciens de l'île.`
        : `Le Lapin a rejoint l'île plutôt récemment.`;
    },
    candidates: (rabbit, all) => {
      const now = new Date();
      const senior = seniorityWeeks(rabbit, now) >= medianSeniority(all, now);
      return all.filter((p) => (seniorityWeeks(p, now) >= medianSeniority(all, now)) === senior).length;
    },
  },
  {
    build: (rabbit) => {
      const cheeks = deriveRabbit(rabbit.avatar_seed).cheeks;
      return cheeks === "none"
        ? "Le lapin du Lapin n'a pas de joues colorées. Regardez-les bien se promener…"
        : "Le lapin du Lapin a les joues colorées. Ouvrez l'œil sur l'île…";
    },
    candidates: (rabbit, all) => {
      const none = deriveRabbit(rabbit.avatar_seed).cheeks === "none";
      return all.filter((p) => (deriveRabbit(p.avatar_seed).cheeks === "none") === none).length;
    },
  },
];

function medianSeniority(all: PlayerRow[], now: Date): number {
  const sorted = all.map((p) => seniorityWeeks(p, now)).sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/**
 * Génère les indices de la saison (1 gratuit mardi, 1 payant mercredi,
 * 1 gratuit jeudi) en respectant les seuils de candidats. Déterministe à
 * entrées égales : on parcourt les gabarits dans l'ordre.
 */
export function generateClues(
  rabbit: PlayerRow,
  activePlayers: PlayerRow[],
  missionTools: string[],
): { ordinal: number; content: string; tier: "free" | "paid"; price: number }[] {
  const picked: { ordinal: number; content: string; tier: "free" | "paid"; price: number }[] = [];
  const used = new Set<number>();

  const pick = (minCandidates: number): string => {
    for (let i = 0; i < TEMPLATES.length; i++) {
      if (used.has(i)) continue;
      const tpl = TEMPLATES[i];
      if (!tpl) continue;
      const text = tpl.build(rabbit, activePlayers, missionTools);
      if (!text) continue;
      if (!isClueSafe(tpl.candidates(rabbit, activePlayers, missionTools), minCandidates)) continue;
      used.add(i);
      return text;
    }
    // Repli sûr : ne désigne personne.
    return "Le Lapin est plus proche que vous ne le pensez. C'est tout pour aujourd'hui. 🐰";
  };

  picked.push({ ordinal: 1, content: pick(3), tier: "free", price: 0 });
  picked.push({ ordinal: 2, content: pick(2), tier: "paid", price: 30 });
  picked.push({ ordinal: 3, content: pick(3), tier: "free", price: 0 });
  return picked;
}
