/**
 * Preuve que l'agent Claude est actif et connecté : GET /api/agent/ping?secret=<CRON_SECRET>
 * Fait un appel réel et minimal à l'API Claude et renvoie le modèle, la
 * réponse et la latence. Protégé par CRON_SECRET (un appel Claude coûte un
 * peu). Si ANTHROPIC_API_KEY est absente, renvoie enabled:false sans erreur.
 */
import { NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { AGENT_MODEL, getAnthropic, isAgentEnabled } from "@/lib/agent/client";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request): Promise<NextResponse> {
  const secret = new URL(req.url).searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!isAgentEnabled()) {
    return NextResponse.json({
      ok: false,
      enabled: false,
      hint: "ANTHROPIC_API_KEY manquante dans Vercel. L'app marche sans, mais les agents sont désactivés.",
    });
  }

  const client = getAnthropic();
  if (!client) {
    return NextResponse.json({ ok: false, enabled: false });
  }

  const t0 = Date.now();
  try {
    const res = await client.messages.create({
      model: AGENT_MODEL,
      max_tokens: 30,
      thinking: { type: "disabled" },
      messages: [
        { role: "user", content: "Reply with exactly one word: PONG" },
      ],
    });
    const reply = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return NextResponse.json({
      ok: res.stop_reason !== "refusal",
      enabled: true,
      model: res.model,
      reply,
      stop_reason: res.stop_reason,
      latency_ms: Date.now() - t0,
      usage: res.usage,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      enabled: true,
      error: e instanceof Error ? e.message : String(e),
      latency_ms: Date.now() - t0,
    });
  }
}
