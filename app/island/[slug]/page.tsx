/**
 * Île privée (auth requise, membre de l'île). Toutes les lectures passent
 * par le client SSR avec la session utilisateur : la RLS fait le tri —
 * un non-membre ne voit même pas que l'île existe.
 */
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import IslandClient, { type MyItem, type PanelPlayer } from "./IslandClient";
import type { IslandEventLite } from "@/lib/island-builder";

export const dynamic = "force-dynamic";

export default async function IslandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="join-page">
        <h1>Private island</h1>
        <p>Open the magic link you got in your Slack DM to step onto the island.</p>
        <Link className="btn btn-primary" href="/">
          Back home
        </Link>
      </main>
    );
  }

  const { data: island } = await supabase
    .from("islands")
    .select("id, name, slug, seed")
    .eq("slug", slug)
    .maybeSingle<{ id: string; name: string; slug: string; seed: string }>();

  if (!island) {
    return (
      <main className="join-page">
        <h1>Nothing here…</h1>
        <p>This island doesn&apos;t exist, or you&apos;re not a member.</p>
        <Link className="btn btn-primary" href="/">
          Back home
        </Link>
      </main>
    );
  }

  const [{ data: players }, { data: events }, { data: islandItemRows }, { data: game }] =
    await Promise.all([
      supabase
        .from("players")
        .select("id, display_name, avatar_seed, equipped, carrots, streak, auth_user_id, is_active")
        .eq("island_id", island.id)
        .eq("is_active", true),
      supabase
        .from("island_events")
        .select("id, type")
        .eq("island_id", island.id)
        .order("created_at", { ascending: true })
        .limit(2000),
      supabase.from("island_items").select("items(slug)").eq("island_id", island.id),
      supabase
        .from("games")
        .select("id, status, result")
        .eq("island_id", island.id)
        .in("status", ["active", "voting", "revealed"])
        .order("week_start", { ascending: false })
        .limit(1)
        .maybeSingle<{ id: string; status: string; result: string | null }>(),
    ]);

  const me = (players ?? []).find((p) => p.auth_user_id === user.id) ?? null;

  let myItems: MyItem[] = [];
  if (me) {
    const { data } = await supabase
      .from("player_items")
      .select("items(slug, name, slot, rarity)")
      .eq("player_id", me.id);
    myItems = (data ?? [])
      .map((r) => r.items as unknown as MyItem | null)
      .filter((i): i is MyItem => i !== null && i.slot !== "island");
  }

  let clues: { ordinal: number; content: string }[] = [];
  if (game) {
    // RLS : seuls les indices publiés ou achetés par moi sont renvoyés.
    const { data } = await supabase
      .from("clues")
      .select("ordinal, content")
      .eq("game_id", game.id)
      .order("ordinal");
    clues = (data ?? []) as { ordinal: number; content: string }[];
  }

  return (
    <IslandClient
      islandId={island.id}
      slug={island.slug}
      name={island.name}
      seed={String(island.seed)}
      events={((events ?? []) as { id: number; type: string }[]).map(
        (e): IslandEventLite => ({ id: e.id, type: e.type }),
      )}
      islandItems={(islandItemRows ?? [])
        .map((r) => (r.items as unknown as { slug: string } | null)?.slug)
        .filter((s): s is string => Boolean(s))}
      players={((players ?? []) as { id: string; display_name: string; avatar_seed: string; equipped: Record<string, string> }[]).map(
        (p): PanelPlayer => ({
          id: p.id,
          name: p.display_name,
          avatarSeed: String(p.avatar_seed),
          equipped: p.equipped ?? {},
        }),
      )}
      me={
        me
          ? {
              playerId: me.id,
              carrots: me.carrots as number,
              streak: me.streak as number,
              equipped: (me.equipped as Record<string, string>) ?? {},
            }
          : null
      }
      myItems={myItems}
      game={game}
      clues={clues}
    />
  );
}
