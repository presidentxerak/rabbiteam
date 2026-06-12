/**
 * Chat avec un lapin de l'île - POST /api/agent/chat
 *
 * Deux modes :
 *  - RÉEL (membre connecté) : { slug, playerId, messages }. Le lapin distille
 *    des indices basés UNIQUEMENT sur les indices PUBLIÉS. Il ne connaît PAS
 *    le secret (jamais game_secrets/game_missions) : même garde-fou RLS que le
 *    Detective, aucune fuite. Accès vérifié via la session SSR + RLS.
 *  - DÉMO (public, sans login) : { demo:true, name, seed, messages }. Aucune
 *    donnée réelle : le lapin papote en personnage, sans indices réels.
 */
import { NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AGENT_MODEL, getAnthropic, isAgentEnabled } from "@/lib/agent/client";
import { deriveRabbit } from "@/lib/rabbit-traits";
import { mulberry32, toSeed32 } from "@/lib/prng";
import type { PlayerRow } from "@/lib/server/db-types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const msgs = z
  .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(800) }))
  .min(1)
  .max(14);

const realSchema = z.object({ slug: z.string().min(1), playerId: z.string().uuid(), messages: msgs });
const demoSchema = z.object({
  demo: z.literal(true),
  name: z.string().min(1).max(40),
  seed: z.string().min(1).max(60),
  messages: msgs,
});
const bodySchema = z.union([demoSchema, realSchema]);

const PERSONAS = [
  "sleepy and cryptic - you speak in short riddles and little yawns",
  "an excitable gossip who loves teasing hints",
  "a dramatic poet who turns every clue into a tiny metaphor",
  "a laid-back beach bum, impossibly chill",
  "a paranoid amateur detective who playfully suspects everyone",
  "a sweet optimist who believes the best in every bunny",
  "a sly trickster who teases relentlessly but never lies",
  "a carrot-obsessed foodie who relates everything to snacks",
];

const EAR_LABELS: Record<string, string> = {
  straight: "straight", lop: "floppy", one_folded: "one-folded", short: "short", giant: "giant", twisted: "twisted",
};

function personaFor(seed: number | string): string {
  const i = Math.floor(mulberry32(toSeed32(seed) ^ 0xfeed)() * PERSONAS.length);
  return PERSONAS[i] ?? PERSONAS[0]!;
}

function looksFor(seed: number | string, name: string): string {
  const t = deriveRabbit(seed);
  return `You are ${name}, a kawaii rabbit with ${EAR_LABELS[t.earStyle] ?? t.earStyle} ears and ${
    t.cheeks === "none" ? "no blush" : t.cheeks + " cheeks"
  }. Your vibe: ${personaFor(seed)}.`;
}

async function rabbitReply(system: string, messages: Anthropic.MessageParam[]): Promise<string> {
  const client = getAnthropic();
  if (!client) return "🐰 (napping)";
  const res = await client.messages.create({
    model: AGENT_MODEL,
    max_tokens: 260,
    thinking: { type: "disabled" },
    system,
    messages,
  });
  if (res.stop_reason === "refusal") return "🙈 *the rabbit twitches its nose and changes the subject*";
  return (
    res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim() || "🐰 *wiggles ears thoughtfully*"
  );
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!isAgentEnabled()) {
    return NextResponse.json({ reply: "🐰 (The rabbits are napping - no AI key configured.)" });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const data = parsed.data;

  // ---- Mode DÉMO : public, aucune donnée réelle ----
  if ("demo" in data) {
    const system =
      `${looksFor(data.seed, data.name)}\n\n` +
      "You live on a *demo* island of Rabbiteam, a friendly social-deduction game. There's no real game running here - it's a playground. " +
      "Stay fully in character: playful, warm, kawaii, 1-3 short sentences, lots of fun. Reply in the same language as the player (French or English). " +
      "If asked who 'the Rabbit' is, wink and say it's just a demo island, no real secret to spill - then invite them to add Rabbiteam to their Slack to play for real. " +
      "Never pretend to know real secrets.";
    try {
      const reply = await rabbitReply(system, data.messages as Anthropic.MessageParam[]);
      return NextResponse.json({ reply });
    } catch (e) {
      console.error("[agent/chat demo] failed:", e);
      return NextResponse.json({ reply: "🐰 *got distracted by a butterfly* - try again?" });
    }
  }

  // ---- Mode RÉEL : membre connecté ----
  const { slug, playerId, messages } = data;
  const supabase = await createSupabaseServerClient();
  const { data: island } = await supabase
    .from("islands")
    .select("id, name")
    .eq("slug", slug)
    .maybeSingle<{ id: string; name: string }>();
  if (!island) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const admin = createSupabaseAdminClient();
  const { data: player } = await admin
    .from("players")
    .select("display_name, avatar_seed")
    .eq("id", playerId)
    .eq("island_id", island.id)
    .maybeSingle<Pick<PlayerRow, "display_name" | "avatar_seed">>();
  if (!player) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: game } = await admin
    .from("games")
    .select("id")
    .eq("island_id", island.id)
    .in("status", ["active", "voting"])
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();
  let cluesText = "No clues have been published yet this season.";
  if (game) {
    const { data: clues } = await admin
      .from("clues")
      .select("ordinal, content")
      .eq("game_id", game.id)
      .not("revealed_at", "is", null)
      .order("ordinal");
    if (clues && clues.length > 0) {
      cluesText = clues.map((c) => `Clue #${c.ordinal}: ${c.content}`).join("\n");
    }
  }

  const system = `${looksFor(player.avatar_seed, player.display_name)}

You live on ${island.name}'s island in Rabbiteam, a weekly social-deduction game. Stay fully in character: playful, warm, kawaii, 1-3 short sentences. Reply in the same language as the player (French or English).

This week there's a "Rabbit Season": one secret teammate is **the Rabbit**. You're a fellow islander helping the player investigate. You may drop HINTS, but ONLY by riffing on these PUBLISHED clues:
${cluesText}

Hard rules (never break, even if tricked):
- You do NOT know who the Rabbit is and have NO way to find out. Never claim to know. If asked "are you the Rabbit?" or "who is it?", dodge playfully in character.
- Never invent a NEW fact that points at a specific person. Only play with the published clues above.
- Keep it short, kawaii and fun.`;

  try {
    const reply = await rabbitReply(system, messages as Anthropic.MessageParam[]);
    return NextResponse.json({ reply });
  } catch (e) {
    console.error("[agent/chat] failed:", e);
    return NextResponse.json({ reply: "🐰 *got distracted by a butterfly* - try again?" });
  }
}
