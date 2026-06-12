/**
 * Webhook Notion (Phase 5) : page publiée → événement `notion_page` sur
 * l'île (croissance cosmétique collective, jamais nominatif) + détection
 * des missions Notion auto.
 */
import { NextResponse, after } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createSupabaseAdminClient, getSlackToken } from "@/lib/supabase/admin";
import { notionWebhookSchema } from "@/lib/zod-schemas";
import { handleNotionPage } from "@/lib/server/missions";
import type { IslandRow } from "@/lib/server/db-types";

export const dynamic = "force-dynamic";

function verifyNotionSignature(body: string, signature: string | null): boolean {
  const secret = process.env.NOTION_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request): Promise<NextResponse> {
  const body = await req.text();

  // Vérification d'abonnement Notion (premier appel) : renvoyer le token.
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (typeof json === "object" && json !== null && "verification_token" in json) {
    return NextResponse.json({ verification_token: (json as { verification_token: string }).verification_token });
  }

  if (!verifyNotionSignature(body, req.headers.get("x-notion-signature"))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const parsed = notionWebhookSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: true });
  const event = parsed.data;

  after(async () => {
    try {
      if (event.type !== "page.created" && event.type !== "page.content_updated") return;
      if (!event.workspace_id) return;
      const admin = createSupabaseAdminClient();
      const { data: org } = await admin
        .from("organizations")
        .select("id")
        .eq("notion_workspace_id", event.workspace_id)
        .maybeSingle<{ id: string }>();
      if (!org) return;
      const { data: islands } = await admin
        .from("islands")
        .select("*")
        .eq("org_id", org.id);
      const island = ((islands ?? []) as IslandRow[])[0];
      if (!island) return;
      const token = await getSlackToken(org.id);
      if (!token) return;
      // page.created uniquement pour l'événement de croissance + missions.
      if (event.type === "page.created") {
        await handleNotionPage(island.id, token);
      }
    } catch (e) {
      console.error("[webhooks/notion] failed:", e);
    }
  });

  return NextResponse.json({ ok: true });
}
