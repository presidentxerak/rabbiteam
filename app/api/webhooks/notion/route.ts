/**
 * Webhook Notion (temps réel) : page créée → événement `notion_page` sur
 * l'île connectée (croissance cosmétique collective, jamais nominatif) +
 * détection des missions Notion auto.
 *
 * Flux d'abonnement Notion :
 *  1. Tu ajoutes un webhook dans ton intégration → cette URL.
 *  2. Notion envoie un {verification_token} : on le renvoie (et on le logge).
 *  3. Tu copies ce token dans NOTION_WEBHOOK_SECRET (Vercel) + Redeploy.
 *  4. Les events suivants sont signés (X-Notion-Signature) et vérifiés.
 *
 * Tant que NOTION_WEBHOOK_SECRET n'est pas posée, on accepte les events sans
 * vérif (le temps de finaliser la config) en le signalant dans les logs.
 */
import { NextResponse, after } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createSupabaseAdminClient, getSlackToken } from "@/lib/supabase/admin";
import { notionWebhookSchema } from "@/lib/zod-schemas";
import { completeNotionPageMissions } from "@/lib/server/missions";
import { notionConnectedIsland } from "@/lib/server/notion";

export const dynamic = "force-dynamic";

function verifyNotionSignature(body: string, signature: string | null): boolean {
  const secret = process.env.NOTION_WEBHOOK_SECRET;
  if (!secret) return true; // pas encore configuré : on laisse passer (setup)
  if (!signature) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request): Promise<NextResponse> {
  const body = await req.text();

  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Vérification d'abonnement Notion (premier appel) : renvoyer le token.
  if (typeof json === "object" && json !== null && "verification_token" in json) {
    const vt = (json as { verification_token: string }).verification_token;
    console.log("[webhooks/notion] verification_token reçu (à mettre dans NOTION_WEBHOOK_SECRET):", vt);
    return NextResponse.json({ verification_token: vt });
  }

  if (!verifyNotionSignature(body, req.headers.get("x-notion-signature"))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const parsed = notionWebhookSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: true });
  const event = parsed.data;

  after(async () => {
    try {
      if (event.type !== "page.created") return; // croissance île = créations
      // Route vers l'île connectée (org dont notion_workspace_id est posé via
      // /rabbiteam notion). Mono-workspace : une seule île connectée.
      const target = await notionConnectedIsland();
      if (!target) return;
      const pageId = event.entity?.id;
      const admin = createSupabaseAdminClient();

      // Déduplication par id de page (le webhook peut être relivré).
      if (pageId) {
        const { data: existing } = await admin
          .from("island_events")
          .select("id")
          .eq("island_id", target.islandId)
          .eq("type", "notion_page")
          .eq("payload->>notion_page_id", pageId)
          .limit(1);
        if (existing && existing.length > 0) return;
      }

      await admin.from("island_events").insert({
        island_id: target.islandId,
        type: "notion_page",
        payload: pageId ? { notion_page_id: pageId } : {},
      });

      const token = await getSlackToken(target.orgId);
      if (token) await completeNotionPageMissions(target.islandId, token);
    } catch (e) {
      console.error("[webhooks/notion] failed:", e);
    }
  });

  return NextResponse.json({ ok: true });
}
