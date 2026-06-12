/**
 * Game Master Agent - donne une voix narrative au jeu.
 *
 * Principe « Claude propose, le code contrôle » : les indices factuels sont
 * générés par le moteur pur (lib/server/clues.ts) qui GARANTIT qu'ils laissent
 * assez de candidats (isClueSafe). Le Game Master ne fait que les RÉÉCRIRE de
 * façon plus vivante, sans ajouter ni retirer le moindre fait - la garantie
 * d'équilibrage reste celle du moteur, pas du modèle. En cas d'échec ou
 * d'absence de clé, on retombe sur le texte factuel original.
 */
import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { AGENT_MODEL, getAnthropic } from "./client";

function extractText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join(" ")
    .trim();
}

/**
 * Réécrit un indice factuel de façon plus ludique, en conservant EXACTEMENT
 * les mêmes faits (mêmes attributs cités). Retourne l'original si l'agent
 * n'est pas configuré ou échoue.
 */
export async function narrateClue(factualClue: string, locale: "fr" | "en"): Promise<string> {
  const client = getAnthropic();
  if (!client) return factualClue;

  const lang = locale === "fr" ? "French" : "English";
  try {
    const res = await client.messages.create({
      model: AGENT_MODEL,
      max_tokens: 300,
      output_config: { effort: "low" },
      system:
        "You are the Game Master of Rabbiteam's Rabbit Season - a playful, slightly theatrical narrator for a Slack social-deduction game. " +
        "You rewrite a factual clue to make it more fun and atmospheric. " +
        "ABSOLUTE RULE: keep every concrete fact EXACTLY as given - do not add, remove, soften, or invent any detail (no new attributes, names, numbers, or hints). " +
        "Same facts, livelier voice. One or two short sentences. Light emoji ok. " +
        `Reply ONLY with the rewritten clue, in ${lang}.`,
      messages: [{ role: "user", content: factualClue }],
    });
    if (res.stop_reason === "refusal") return factualClue;
    return extractText(res.content) || factualClue;
  } catch (e) {
    console.error("[gamemaster] narrateClue failed:", e);
    return factualClue;
  }
}

/** Narre une stat de Carte de Révélation (pur cosmétique). Fallback = original. */
export async function narrateRevealStat(rawStat: string, locale: "fr" | "en"): Promise<string> {
  const client = getAnthropic();
  if (!client) return rawStat;
  const lang = locale === "fr" ? "French" : "English";
  try {
    const res = await client.messages.create({
      model: AGENT_MODEL,
      max_tokens: 200,
      output_config: { effort: "low" },
      system:
        "You are the Game Master of Rabbiteam. Turn this end-of-season stat into one punchy, celebratory line. " +
        "Keep the numbers exactly as given. One sentence. " +
        `Reply ONLY with the line, in ${lang}.`,
      messages: [{ role: "user", content: rawStat }],
    });
    if (res.stop_reason === "refusal") return rawStat;
    return extractText(res.content) || rawStat;
  } catch (e) {
    console.error("[gamemaster] narrateRevealStat failed:", e);
    return rawStat;
  }
}
