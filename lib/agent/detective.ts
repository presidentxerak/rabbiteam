/**
 * Detective Agent — `/rabbiteam detective <question>`.
 *
 * Un agent Claude qui enquête AVEC le joueur via tool use. Boucle agentique
 * manuelle : Claude appelle des outils, on les exécute (service role), on
 * reboucle jusqu'à end_turn, puis on poste la réponse dans Slack.
 *
 * 🔒 Argument de sécurité central, dans le thème « agents » du hackathon :
 * les outils de l'agent ne peuvent PHYSIQUEMENT pas lire l'identité du Lapin.
 * Ils ne renvoient que ce que la RLS exposerait déjà à un membre de l'île —
 * indices PUBLIÉS, roster, traits 3D publics des lapins. Jamais game_secrets,
 * jamais game_missions. Même l'agent IA ne peut pas tricher : le secret est
 * gardé par Postgres, pas par un prompt.
 */
import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { deriveRabbit } from "@/lib/rabbit-traits";
import { AGENT_MODEL, getAnthropic } from "./client";
import type { PlayerRow } from "@/lib/server/db-types";

const EAR_LABELS: Record<string, string> = {
  straight: "straight",
  lop: "lop (floppy)",
  one_folded: "one folded",
  short: "short",
  giant: "giant",
  twisted: "twisted",
};

const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_published_clues",
    description:
      "Returns the clues that have been PUBLICLY published so far this season (ordinal + text). " +
      "Use this to ground every deduction. Never invent clues.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_players",
    description:
      "Returns the active players of the island: display name, first letter, name length, and a seniority bucket (senior/recent). " +
      "Use this to cross-reference clues that talk about names or how long someone has been on the island.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_rabbit_traits",
    description:
      "Returns each active player's PUBLIC 3D avatar traits (ear style, cheeks, eye style) — the same ones everyone can see walking on the island. " +
      "Use this to cross-reference clues that describe the Rabbit's avatar.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
];

const SYSTEM_PROMPT = `You are the Detective Agent for Rabbiteam's "Rabbit Season" — a weekly social-deduction game inside Slack.

Your job: help the player figure out who the secret Rabbit is, this week, on their island.

Hard rules:
- You do NOT know who the Rabbit is, and you have no way to find out. The Rabbit's identity is protected at the database level (Row Level Security); your tools physically cannot read it. Never claim to know for certain — reason from evidence only.
- Ground EVERY claim in the published clues (get_published_clues) cross-referenced with the roster (get_players) and the public avatar traits (get_rabbit_traits). Call the tools you need before answering.
- Narrow down the suspects and explain your reasoning briefly. If the clues still leave several candidates, say so — never single out one person without evidence.
- Be playful and concise (this is a fun team game, answered in Slack). 3-6 short sentences max. Use light emoji.
- Reply in the same language as the player's question (French or English).

When you have reasoned enough, give your shortlist and the single most useful next observation the player could make.`;

async function execTool(name: string, islandId: string, gameId: string): Promise<string> {
  const admin = createSupabaseAdminClient();
  const now = new Date();

  if (name === "get_published_clues") {
    const { data } = await admin
      .from("clues")
      .select("ordinal, content")
      .eq("game_id", gameId)
      .not("revealed_at", "is", null)
      .order("ordinal");
    const clues = (data ?? []) as { ordinal: number; content: string }[];
    if (clues.length === 0) return "No clue has been published yet this season.";
    return clues.map((c) => `Clue #${c.ordinal}: ${c.content}`).join("\n");
  }

  if (name === "get_players") {
    const { data } = await admin
      .from("players")
      .select("display_name, created_at")
      .eq("island_id", islandId)
      .eq("is_active", true);
    const players = (data ?? []) as { display_name: string; created_at: string }[];
    const weeks = players.map(
      (p) => (now.getTime() - new Date(p.created_at).getTime()) / (7 * 86400000),
    );
    const median = [...weeks].sort((a, b) => a - b)[Math.floor(weeks.length / 2)] ?? 0;
    return players
      .map((p, i) => {
        const name = p.display_name;
        const senior = (weeks[i] ?? 0) >= median ? "senior" : "recent";
        return `${name} — starts with "${name.trim()[0]?.toUpperCase() ?? "?"}", ${name.replace(/\s/g, "").length} letters, ${senior}`;
      })
      .join("\n");
  }

  if (name === "get_rabbit_traits") {
    const { data } = await admin
      .from("players")
      .select("display_name, avatar_seed")
      .eq("island_id", islandId)
      .eq("is_active", true);
    const players = (data ?? []) as Pick<PlayerRow, "display_name" | "avatar_seed">[];
    return players
      .map((p) => {
        const t = deriveRabbit(p.avatar_seed);
        return `${p.display_name}: ears ${EAR_LABELS[t.earStyle] ?? t.earStyle}, cheeks ${t.cheeks}, eyes ${t.eyeStyle}`;
      })
      .join("\n");
  }

  return "Unknown tool.";
}

/**
 * Lance l'enquête. Retourne le texte de réponse (à poster dans Slack), ou
 * null si l'agent n'est pas configuré / aucune saison en cours / refus.
 */
export async function runDetective(opts: {
  islandId: string;
  question: string;
}): Promise<string | null> {
  const client = getAnthropic();
  if (!client) return null;

  const admin = createSupabaseAdminClient();
  const { data: game } = await admin
    .from("games")
    .select("id")
    .eq("island_id", opts.islandId)
    .in("status", ["active", "voting"])
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!game) return "🐰 No Rabbit Season is running right now — the Detective rests until Monday 9am.";

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: opts.question.trim() || "Who could the Rabbit be so far?" },
  ];

  // Boucle agentique manuelle (≤ 6 tours : 3 outils + marge).
  for (let turn = 0; turn < 6; turn++) {
    const res = await client.messages.create({
      model: AGENT_MODEL,
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    });

    if (res.stop_reason === "refusal") {
      return "🕵️ The Detective declines to investigate that one. Try another angle?";
    }

    if (res.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: res.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const block of res.content) {
        if (block.type === "tool_use") {
          const out = await execTool(block.name, opts.islandId, game.id);
          results.push({ type: "tool_result", tool_use_id: block.id, content: out });
        }
      }
      messages.push({ role: "user", content: results });
      continue;
    }

    if (res.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: res.content });
      continue;
    }

    // end_turn (ou autre) : on extrait le texte final.
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return text || "🕵️ The trail went cold — ask me again with a sharper question.";
  }

  return "🕵️ I've gathered the clues but need a sharper question to point somewhere useful.";
}
