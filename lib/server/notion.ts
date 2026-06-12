/**
 * Intégration Notion RÉELLE (pas démo), via le jeton d'intégration interne
 * (NOTION_API_TOKEN). Deux chemins :
 *   1. Sync à la demande (`/rabbiteam notion`) : interroge l'API Notion, importe
 *      les pages récentes comme événements d'île + complète les missions Notion.
 *      Fiable, sans config webhook. C'est le chemin principal en prod.
 *   2. Webhook temps réel (app/api/webhooks/notion) : route les events vers
 *      l'île connectée (org dont notion_workspace_id est renseigné).
 *
 * Mono-workspace : un jeton d'intégration interne = un espace Notion = une île.
 * (Le multi-tenant nécessiterait un flux OAuth Notion par équipe — hors scope.)
 */
import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { completeNotionPageMissions } from "./missions";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

export function isNotionEnabled(): boolean {
  return Boolean(process.env.NOTION_API_TOKEN);
}

async function notionApi(
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${NOTION_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.NOTION_API_TOKEN}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return (await res.json()) as Record<string, unknown>;
}

/** Vérifie le jeton et renvoie le nom de l'espace / du bot. */
export async function verifyNotion(): Promise<{ ok: boolean; name?: string; id?: string; error?: string }> {
  if (!isNotionEnabled()) return { ok: false, error: "NOTION_API_TOKEN manquante" };
  const me = await notionApi("GET", "/users/me");
  if (me.object === "user") {
    const bot = me.bot as { workspace_name?: string } | undefined;
    return { ok: true, id: me.id as string, name: bot?.workspace_name ?? (me.name as string) ?? "Notion" };
  }
  return { ok: false, error: (me.message as string) ?? "jeton invalide" };
}

interface NotionPage {
  id: string;
  created_time?: string;
  url?: string;
}

/**
 * Importe les pages Notion créées dans les `sinceMinutes` dernières minutes
 * en événements d'île `notion_page` (dédupliqués par id de page), puis complète
 * les missions Notion auto du Lapin. Retourne le nombre de pages importées.
 */
export async function syncNotionPages(
  islandId: string,
  slackToken: string,
  sinceMinutes = 1440,
): Promise<number> {
  if (!isNotionEnabled()) return 0;
  const search = await notionApi("POST", "/search", {
    filter: { property: "object", value: "page" },
    sort: { direction: "descending", timestamp: "last_edited_time" },
    page_size: 25,
  });
  const pages = (search.results as NotionPage[] | undefined) ?? [];
  const cutoff = Date.now() - sinceMinutes * 60_000;
  const admin = createSupabaseAdminClient();
  let imported = 0;

  for (const p of pages) {
    if (!p.id) continue;
    const created = p.created_time ? new Date(p.created_time).getTime() : Date.now();
    if (created < cutoff) continue;
    // Déduplication par id de page (filtre JSON sur le payload).
    const { data: existing } = await admin
      .from("island_events")
      .select("id")
      .eq("island_id", islandId)
      .eq("type", "notion_page")
      .eq("payload->>notion_page_id", p.id)
      .limit(1);
    if (existing && existing.length > 0) continue;
    await admin.from("island_events").insert({
      island_id: islandId,
      type: "notion_page",
      payload: { notion_page_id: p.id }, // jamais nominatif : juste l'id technique
    });
    imported++;
  }

  if (imported > 0) {
    await completeNotionPageMissions(islandId, slackToken);
  }
  return imported;
}

/** Trouve l'île de l'org connectée à Notion (notion_workspace_id renseigné). */
export async function notionConnectedIsland(): Promise<{ islandId: string; orgId: string } | null> {
  const admin = createSupabaseAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("id")
    .not("notion_workspace_id", "is", null)
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!org) return null;
  const { data: island } = await admin
    .from("islands")
    .select("id")
    .eq("org_id", org.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!island) return null;
  return { islandId: island.id, orgId: org.id };
}
