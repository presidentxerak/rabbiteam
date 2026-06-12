/**
 * Slack Events API : url_verification, reaction_added (kudos + missions),
 * message (missions "mot à placer"). HMAC vérifié, réponse 200 < 3 s,
 * traitement en arrière-plan via after().
 */
import { NextResponse, after } from "next/server";
import { readVerifiedSlackBody } from "@/lib/slack/verify";
import {
  slackEventEnvelopeSchema,
  slackMessageEventSchema,
  slackReactionEventSchema,
} from "@/lib/zod-schemas";
import { claimSlackEvent, resolveSlackCtx } from "@/lib/server/slack-context";
import { handleMessage, handleReaction } from "@/lib/server/missions";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  const body = await readVerifiedSlackBody(req);
  if (body === null) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const parsed = slackEventEnvelopeSchema.safeParse(json);
  if (!parsed.success) {
    // Événement inconnu : on ackera quand même (Slack n'aime pas les erreurs).
    return NextResponse.json({ ok: true });
  }
  const envelope = parsed.data;

  // Première chose à coder : le challenge d'enregistrement de l'URL.
  if (envelope.type === "url_verification") {
    return NextResponse.json({ challenge: envelope.challenge });
  }

  // Ack immédiat (< 3 s), traitement en arrière-plan.
  after(async () => {
    try {
      if (!(await claimSlackEvent(envelope.event_id))) return; // retry Slack déjà traité
      const ctx = await resolveSlackCtx(envelope.team_id);
      if (!ctx) return;
      const rawEvent = envelope.event;

      if (rawEvent.type === "reaction_added") {
        const parsedEvent = slackReactionEventSchema.safeParse(rawEvent);
        if (!parsedEvent.success) return;
        const event = parsedEvent.data;
        await handleReaction({
          island: ctx.island,
          token: ctx.token,
          reactorSlackId: event.user,
          targetSlackId: event.item_user ?? null,
          reaction: event.reaction,
          channel: event.item.channel ?? null,
          messageTs: event.item.ts ?? null,
        });
      } else if (rawEvent.type === "message") {
        const parsedEvent = slackMessageEventSchema.safeParse(rawEvent);
        if (!parsedEvent.success) return;
        const event = parsedEvent.data;
        // On ignore les bots et les messages édités/systèmes.
        if (event.bot_id || event.subtype || !event.user || !event.text) return;
        await handleMessage({
          island: ctx.island,
          token: ctx.token,
          authorSlackId: event.user,
          text: event.text,
          channel: event.channel,
          ts: event.ts,
          threadTs: event.thread_ts ?? null,
        });
      }
    } catch (e) {
      console.error("[slack/events] background failed:", e);
    }
  });

  return NextResponse.json({ ok: true });
}
