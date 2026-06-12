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
    title: `${island.name}'s island 🏝️ — Rabbiteam`,
    description: "Would your team survive the Rabbit?",
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
        <h1>🌊 This island keeps its secrets</h1>
        <p>It doesn&apos;t exist, or its crew made it private.</p>
        <Link className="btn btn-primary" href="/">
          Create your team&apos;s island
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
          {island.population} rabbits · {island.seasons_played} Rabbit Season
          {island.seasons_played > 1 ? "s" : ""} played
        </div>
        <p>
          This island grows from the team&apos;s real work. Every week, a secret Rabbit sows its
          missions here…
        </p>
        <Link className="btn btn-primary" href="/" style={{ display: "block", textAlign: "center" }}>
          Create your team&apos;s island 🥕
        </Link>
      </aside>
    </div>
  );
}
