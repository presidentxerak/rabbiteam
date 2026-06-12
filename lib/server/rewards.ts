/**
 * Distribution d'items (streaks, victoires, paliers de saisons, parrainage)
 * + annonces publiques de drops. Jamais d'annonce des échecs.
 */
import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { postMessage } from "@/lib/slack/client";
import { dropAnnounceBlocks } from "@/lib/slack/blocks";
import type { ItemRow, PlayerRow } from "./db-types";

/** Donne un item à un joueur (idempotent). Retourne l'item si nouvellement acquis. */
export async function grantItemToPlayer(
  playerId: string,
  itemSlug: string,
  source: string,
): Promise<ItemRow | null> {
  const admin = createSupabaseAdminClient();
  const { data: item } = await admin.from("items").select("*").eq("slug", itemSlug).single<ItemRow>();
  if (!item) return null;
  const { data: inserted } = await admin
    .from("player_items")
    .upsert(
      { player_id: playerId, item_id: item.id, source },
      { onConflict: "player_id,item_id", ignoreDuplicates: true },
    )
    .select("player_id");
  return inserted && inserted.length > 0 ? item : null;
}

/** Donne un item d'île (collectif, idempotent). */
export async function grantItemToIsland(
  islandId: string,
  itemSlug: string,
): Promise<ItemRow | null> {
  const admin = createSupabaseAdminClient();
  const { data: item } = await admin.from("items").select("*").eq("slug", itemSlug).single<ItemRow>();
  if (!item) return null;
  const { data: inserted } = await admin
    .from("island_items")
    .upsert(
      { island_id: islandId, item_id: item.id },
      { onConflict: "island_id,item_id", ignoreDuplicates: true },
    )
    .select("island_id");
  return inserted && inserted.length > 0 ? item : null;
}

/** Tire un item aléatoire d'une rareté donnée que le joueur ne possède pas. */
export async function grantRandomItem(
  player: Pick<PlayerRow, "id">,
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary",
  source: string,
): Promise<ItemRow | null> {
  const admin = createSupabaseAdminClient();
  const { data: owned } = await admin
    .from("player_items")
    .select("item_id")
    .eq("player_id", player.id);
  const ownedIds = new Set((owned ?? []).map((r) => r.item_id as string));
  const { data: pool } = await admin
    .from("items")
    .select("*")
    .eq("rarity", rarity)
    .neq("slot", "island")
    .neq("rarity", "legendary"); // les legendary ne droppent jamais au hasard
  const candidates = ((pool ?? []) as ItemRow[]).filter((i) => !ownedIds.has(i.id));
  if (candidates.length === 0) return null;
  const item = candidates[Math.floor(Math.random() * candidates.length)];
  if (!item) return null;
  await admin
    .from("player_items")
    .upsert(
      { player_id: player.id, item_id: item.id, source },
      { onConflict: "player_id,item_id", ignoreDuplicates: true },
    );
  return item;
}

/** Annonce publique d'un drop dans le canal de l'île. */
export async function announceDrop(
  token: string,
  channelId: string,
  playerName: string,
  item: ItemRow,
  reason: string,
): Promise<void> {
  await postMessage(
    token,
    channelId,
    `✨ ${playerName} a débloqué ${item.name}`,
    dropAnnounceBlocks(playerName, item.name, item.rarity, reason),
  );
}

/** Paliers d'items d'île par nombre de saisons jouées (4 / 12 / 24). */
export async function grantSeasonMilestones(islandId: string, seasonsPlayed: number): Promise<ItemRow[]> {
  const granted: ItemRow[] = [];
  const milestones: [number, string][] = [
    [4, "campfire"],
    [12, "hammock"],
    [24, "pontoon"],
    [24, "mini_lighthouse"],
  ];
  for (const [threshold, slug] of milestones) {
    if (seasonsPlayed >= threshold) {
      const item = await grantItemToIsland(islandId, slug);
      if (item) granted.push(item);
    }
  }
  return granted;
}
