/**
 * UN SEUL cron (toutes les 30 min, vercel.json) : le dispatcher calcule
 * l'heure locale de chaque île et déclenche les actions dues. Idempotence
 * garantie par dispatch_log (voir lib/server/season.ts).
 *
 * Test d'intégration : ?now=2026-06-12T09:00:00Z&island=<uuid> permet de
 * simuler une semaine en accéléré (toujours protégé par CRON_SECRET).
 */
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { dueActions } from "@/lib/game-engine";
import { localTime } from "@/lib/server/time";
import { cronQuerySchema } from "@/lib/zod-schemas";
import {
  checkSleepingRabbit,
  closeAndScore,
  loadIslandCtx,
  openVoting,
  releaseClue,
  reveal,
  standupReminder,
  startSeason,
  voteReminder,
  type IslandCtx,
} from "@/lib/server/season";
import type { IslandRow } from "@/lib/server/db-types";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const url = new URL(req.url);
  const parsed = cronQuerySchema.safeParse({
    now: url.searchParams.get("now") ?? undefined,
    island: url.searchParams.get("island") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "bad_query" }, { status: 400 });
  }
  const now = parsed.data.now ? new Date(parsed.data.now) : new Date();

  const admin = createSupabaseAdminClient();
  let query = admin.from("islands").select("*");
  if (parsed.data.island) query = query.eq("id", parsed.data.island);
  const { data: islands, error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const ran: Record<string, string[]> = {};
  for (const island of (islands ?? []) as IslandRow[]) {
    const lt = localTime(now, island.timezone);
    const due = dueActions(lt.weekday, lt.hour, lt.minute);
    if (due.length === 0) continue;
    const ctx = await loadIslandCtx(island);
    if (!ctx) continue;
    ran[island.slug] = due;
    for (const action of due) {
      try {
        await runAction(action, ctx, lt.day);
      } catch (e) {
        console.error(`[dispatcher] ${island.slug}/${action} failed:`, e);
      }
    }
  }

  return NextResponse.json({ ok: true, at: now.toISOString(), ran });
}

async function runAction(action: string, ctx: IslandCtx, day: string): Promise<void> {
  switch (action) {
    case "start_season": return startSeason(ctx, day);
    case "standup_reminder": return standupReminder(ctx, day);
    case "release_clue_1": return releaseClue(ctx, day, 1);
    case "release_paid_clue": return releaseClue(ctx, day, 2);
    case "release_clue_3": return releaseClue(ctx, day, 3);
    case "check_sleeping_rabbit": return checkSleepingRabbit(ctx, day);
    case "open_voting": return openVoting(ctx, day);
    case "vote_reminder": return voteReminder(ctx, day);
    case "close_and_score": return closeAndScore(ctx, day);
    case "reveal": return reveal(ctx, day);
  }
}
