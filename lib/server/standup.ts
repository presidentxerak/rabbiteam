/**
 * Standup gamifié : upsert du standup, carottes (+bonus streak),
 * événement d'île, drops de streak. Toute la monnaie bouge ici,
 * côté serveur uniquement.
 */
import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  standupReward,
  streakDropRarity,
  streakSurvives,
} from "@/lib/game-engine";
import { localTime } from "./time";
import { announceDrop, grantRandomItem } from "./rewards";
import { postEphemeral } from "@/lib/slack/client";
import type { IslandRow, PlayerRow } from "./db-types";

export async function handleStandupSubmission(opts: {
  island: IslandRow;
  player: PlayerRow;
  token: string;
  intention: string;
  mood: string;
}): Promise<void> {
  const { island, player, token, intention, mood } = opts;
  const admin = createSupabaseAdminClient();
  const today = localTime(new Date(), island.timezone).day;

  // Idempotent : un standup par jour. Si déjà posté, on met juste à jour le texte.
  const { data: existing } = await admin
    .from("standups")
    .select("day")
    .eq("player_id", player.id)
    .eq("day", today)
    .maybeSingle();
  await admin.from("standups").upsert(
    { player_id: player.id, island_id: island.id, day: today, intention, mood },
    { onConflict: "player_id,day" },
  );
  if (existing) {
    await postEphemeral(token, island.slack_channel_id, player.slack_user_id,
      "Intention mise à jour ✏️ (les carottes du jour étaient déjà dans le terrier)");
    return;
  }

  // Streak : survit si le dernier standup date du jour ouvré précédent.
  const streakBefore = streakSurvives(player.last_standup, today) ? player.streak : 0;
  const { carrots, newStreak } = standupReward(streakBefore);

  await admin
    .from("players")
    .update({
      carrots: player.carrots + carrots,
      streak: newStreak,
      last_standup: today,
    })
    .eq("id", player.id);

  await admin.from("island_events").insert({
    island_id: island.id,
    type: "standup",
    actor_player_id: player.id,
    payload: { mood },
  });

  const flame = newStreak >= 3 ? ` — streak ${newStreak} 🔥` : "";
  await postEphemeral(
    token,
    island.slack_channel_id,
    player.slack_user_id,
    `+${carrots} 🥕${flame}`,
  );

  // Drop de streak (3 → common, 5 → uncommon, ×10 → rare)
  const rarity = streakDropRarity(newStreak);
  if (rarity) {
    const item = await grantRandomItem(player, rarity, `streak_${newStreak}`);
    if (item) {
      await announceDrop(
        token,
        island.slack_channel_id,
        player.display_name,
        item,
        `streak de ${newStreak} jours`,
      );
    }
  }
}
