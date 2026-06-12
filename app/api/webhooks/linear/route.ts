/**
 * Webhook Linear (Phase 5, Kanban) : `Issue completed` → événement
 * `sprint_done` AGRÉGÉ PAR ÉQUIPE, jamais nominatif (principe non
 * négociable : aucun signal de productivité individuelle).
 */
import { NextResponse, after } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createSupabaseAdminClient, getSlackToken } from "@/lib/supabase/admin";
import { linearWebhookSchema } from "@/lib/zod-schemas";
import { handleIssueCompleted } from "@/lib/server/missions";
import type { IslandRow } from "@/lib/server/db-types";

export const dynamic = "force-dynamic";

/** ≥ N tickets terminés dans la semaine → 1 événement sprint_done (cosmétique). */
const SPRINT_DONE_THRESHOLD = 5;

function verifyLinearSignature(body: string, signature: string | null): boolean {
  const secret = process.env.LINEAR_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request): Promise<NextResponse> {
  const body = await req.text();
  if (!verifyLinearSignature(body, req.headers.get("linear-signature"))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const parsed = linearWebhookSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: true });
  const event = parsed.data;

  after(async () => {
    try {
      if (event.type !== "Issue" || !event.data?.completedAt || !event.data.teamId) return;
      const admin = createSupabaseAdminClient();
      const { data: island } = await admin
        .from("islands")
        .select("*")
        .eq("linear_team_id", event.data.teamId)
        .maybeSingle<IslandRow>();
      if (!island) return;

      // Compteur hebdo agrégé dans island_events (payload.count), anonyme.
      const monday = new Date();
      const delta = monday.getUTCDay() === 0 ? -6 : 1 - monday.getUTCDay();
      monday.setUTCDate(monday.getUTCDate() + delta);
      const weekStartIso = monday.toISOString().slice(0, 10) + "T00:00:00Z";

      const { count } = await admin
        .from("island_events")
        .select("id", { count: "exact", head: true })
        .eq("island_id", island.id)
        .eq("type", "issue_completed")
        .gte("created_at", weekStartIso);
      await admin.from("island_events").insert({
        island_id: island.id,
        type: "issue_completed", // interne, ne fait rien pousser tout seul
        payload: {},
      });

      // Au seuil exact, on émet UN sprint_done (élément visible sur l'île).
      if ((count ?? 0) + 1 === SPRINT_DONE_THRESHOLD) {
        await admin.from("island_events").insert({
          island_id: island.id,
          type: "sprint_done",
          payload: { week: weekStartIso.slice(0, 10) },
        });
      }

      const { data: org } = await admin
        .from("islands").select("org_id").eq("id", island.id).single<{ org_id: string }>();
      const token = org ? await getSlackToken(org.org_id) : null;
      if (token) await handleIssueCompleted(island.id, token);
    } catch (e) {
      console.error("[webhooks/linear] failed:", e);
    }
  });

  return NextResponse.json({ ok: true });
}
