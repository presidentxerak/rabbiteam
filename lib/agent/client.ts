/**
 * Client Anthropic partagé (serveur uniquement) pour les agents Rabbiteam.
 * Tout est optionnel : si ANTHROPIC_API_KEY est absente, isAgentEnabled()
 * renvoie false et chaque appelant retombe sur son comportement non-IA.
 * L'app reste donc 100% fonctionnelle sans clé.
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Modèle par défaut : le plus capable de la famille Opus (cf. claude-api).
export const AGENT_MODEL = "claude-opus-4-8";

let cached: Anthropic | null = null;

export function isAgentEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function getAnthropic(): Anthropic | null {
  if (!isAgentEnabled()) return null;
  if (!cached) cached = new Anthropic();
  return cached;
}
