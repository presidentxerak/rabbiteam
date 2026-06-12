/**
 * Île PUBLIQUE lecture seule (/i/[slug]) : la landing page vivante de
 * chaque client. Données 100% anonymisées (vue + RPC, RGPD-safe).
 * CTA unique : créer son île.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import PublicIslandClient from "./PublicIslandClient";
import type { IslandEventLite } from "@/lib/island-builder";

export const dynamic = "force-dynamic";

function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://rabbiteam.app";
  // La meta-image = la dernière Carte de Révélation de l'île (si publique).
  const admin = createSupabaseAdminClient();
  const { data: island } = await admin
    .from("islands")
    .select("id, name, is_public")
    .eq("slug", slug)
    .eq("is_public", true)
    .maybeSingle<{ id: string; name: string; is_public: boolean }>();
  if (!island) return { title: "Rabbiteam" };
  const { data: lastGame } = await admin
    .from("games")
    .select("id")
    .eq("island_id", island.id)
    .eq("status", "revealed")
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();
  return {
    title: `L'île de ${island.name} 🏝️ — Rabbiteam`,
    description: "Votre équipe résisterait au Lapin ?",
    openGraph: lastGame
      ? { images: [`${appUrl}/api/og/reveal/${lastGame.id}`] }
      : undefined,
  };
}

export default async function PublicIslandPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = anonClient();

  const { data: island } = await supabase
    .from("public_islands")
    .select("*")
    .eq("slug", slug)
    .maybeSingle<{ slug: string; name: string; seed: string; population: number; seasons_played: number }>();

  if (!island) {
    return (
      <main className="join-page">
        <h1>🌊 Cette île garde ses secrets</h1>
        <p>Elle n&apos;existe pas, ou son équipage l&apos;a rendue privée.</p>
        <Link className="btn btn-primary" href="/">
          Créer l&apos;île de votre équipe
        </Link>
      </main>
    );
  }

  const [{ data: events }, { data: rabbits }] = await Promise.all([
    supabase.rpc("public_island_events", { p_slug: slug }),
    supabase.rpc("public_island_rabbits", { p_slug: slug }),
  ]);

  return (
    <div className="island-page">
      <PublicIslandClient
        seed={String(island.seed)}
        name={island.name}
        events={((events ?? []) as { id: number; type: string }[]).map(
          (e): IslandEventLite => ({ id: e.id, type: e.type }),
        )}
        rabbits={((rabbits ?? []) as { avatar_seed: string; equipped: Record<string, string> }[]).map(
          (r) => ({ avatarSeed: String(r.avatar_seed), equipped: r.equipped ?? {} }),
        )}
      />
      <aside className="island-panel">
        <h1>🏝️ {island.name}</h1>
        <div style={{ color: "var(--ink-soft)" }}>
          {island.population} lapins · {island.seasons_played} saison
          {island.seasons_played > 1 ? "s" : ""} du Lapin jouée
          {island.seasons_played > 1 ? "s" : ""}
        </div>
        <p>
          Cette île pousse avec le vrai travail de l&apos;équipe. Chaque semaine, un Lapin secret y
          sème ses missions…
        </p>
        <Link className="btn btn-primary" href="/" style={{ display: "block", textAlign: "center" }}>
          Créer l&apos;île de votre équipe 🥕
        </Link>
      </aside>
    </div>
  );
}
