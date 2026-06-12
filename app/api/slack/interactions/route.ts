/**
 * Interactions Slack : soumissions de modals (standup, vote) et boutons
 * (ouvrir standup/vote, mission accomplie, débloquer un indice).
 * Payload = form-urlencoded avec un champ `payload` JSON. HMAC vérifié.
 */
import { NextResponse, after } from "next/server";
import { readVerifiedSlackBody } from "@/lib/slack/verify";
import {
  slackInteractionSchema,
  standupSubmissionSchema,
  type SlackInteraction,
} from "@/lib/zod-schemas";
import { resolveSlackCtx, resolvePlayer, type SlackCtx } from "@/lib/server/slack-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { handleStandupSubmission } from "@/lib/server/standup";
import { handleMissionDoneButton } from "@/lib/server/missions";
import { openModal, postEphemeral } from "@/lib/slack/client";
import { standupModal, voteModal } from "@/lib/slack/blocks";
import { broadcastToIsland } from "@/lib/server/realtime";
import type { GameRow, PlayerRow } from "@/lib/server/db-types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request): Promise<NextResponse> {
  const body = await readVerifiedSlackBody(req);
  if (body === null) return NextResponse.json({ ok: false }, { status: 401 });

  const raw = new URLSearchParams(body).get("payload");
  if (!raw) return NextResponse.json({ ok: false }, { status: 400 });
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const parsed = slackInteractionSchema.safeParse(json);
  if (!parsed.success) return new NextResponse(null, { status: 200 });
  const interaction = parsed.data;
  const teamId = interaction.team?.id;
  if (!teamId) return new NextResponse(null, { status: 200 });

  // Les view_submission de standup sont validées de façon synchrone pour
  // pouvoir renvoyer des erreurs de champ ; le reste part en arrière-plan.
  if (interaction.type === "view_submission") {
    const callbackId = interaction.view?.callback_id;
    if (callbackId === "standup_submit") {
      const intention = readStateValue(interaction, "intention_block", "intention");
      const moodRaw = readStateValue(interaction, "mood_block", "mood");
      const sub = standupSubmissionSchema.safeParse({
        intention: typeof intention === "string" ? intention.trim() : "",
        mood: moodRaw ?? "🙂",
      });
      if (!sub.success) {
        return NextResponse.json({
          response_action: "errors",
          errors: { intention_block: "140 characters max, and at least one word 🐰" },
        });
      }
      after(() => processStandup(teamId, interaction, sub.data).catch(logErr));
      return new NextResponse(null, { status: 200 });
    }
    if (callbackId === "vote_submit") {
      after(() => processVote(teamId, interaction).catch(logErr));
      return new NextResponse(null, { status: 200 });
    }
    return new NextResponse(null, { status: 200 });
  }

  if (interaction.type === "block_actions") {
    after(() => processBlockAction(teamId, interaction).catch(logErr));
  }
  return new NextResponse(null, { status: 200 });
}

function logErr(e: unknown): void {
  console.error("[slack/interactions] failed:", e);
}

function readStateValue(i: SlackInteraction, blockId: string, actionId: string): string | undefined {
  const block = i.view?.state?.values[blockId]?.[actionId] as
    | { value?: string; selected_option?: { value?: string } }
    | undefined;
  return block?.selected_option?.value ?? block?.value;
}

// ============ Standup ============

async function processStandup(
  teamId: string,
  interaction: SlackInteraction,
  data: { intention: string; mood: "🙂" | "🚀" | "😴" | "🤯" | "🎉" },
): Promise<void> {
  const ctx = await resolveSlackCtx(teamId);
  if (!ctx) return;
  const player = await resolvePlayer(ctx.island.id, interaction.user.id);
  if (!player) return;
  await handleStandupSubmission({
    island: ctx.island,
    player,
    token: ctx.token,
    intention: data.intention,
    mood: data.mood,
  });
}

// ============ Vote ============

async function processVote(teamId: string, interaction: SlackInteraction): Promise<void> {
  const ctx = await resolveSlackCtx(teamId);
  if (!ctx) return;
  const player = await resolvePlayer(ctx.island.id, interaction.user.id);
  if (!player) return;
  const gameId = interaction.view?.private_metadata;
  const suspectId = readStateValue(interaction, "suspect_block", "suspect");
  if (!gameId || !suspectId) return;

  const admin = createSupabaseAdminClient();
  // La fenêtre doit être ouverte (le modal peut traîner ouvert après 16h).
  const { data: game } = await admin
    .from("games")
    .select("id, status, island_id")
    .eq("id", gameId)
    .eq("island_id", ctx.island.id)
    .maybeSingle<GameRow>();
  if (!game || game.status !== "voting") {
    await postEphemeral(ctx.token, ctx.island.slack_channel_id, player.slack_user_id,
      "The burrow is closed - voting has ended. 🐰");
    return;
  }
  // Suspect valide = joueur actif de la même île, pas soi-même.
  const { data: suspect } = await admin
    .from("players")
    .select("id")
    .eq("id", suspectId)
    .eq("island_id", ctx.island.id)
    .eq("is_active", true)
    .maybeSingle<{ id: string }>();
  if (!suspect || suspect.id === player.id) return;

  await admin.from("votes").upsert(
    { game_id: gameId, voter_id: player.id, suspect_id: suspectId },
    { onConflict: "game_id,voter_id" },
  );
  await postEphemeral(ctx.token, ctx.island.slack_channel_id, player.slack_user_id,
    "🗳️ Vote recorded. Editable until 4pm. Mum's the word.");
  // L'île montre QUI a voté, jamais pour qui.
  await broadcastToIsland(ctx.island.id, "vote_cast", { gameId, voterPlayerId: player.id });
}

// ============ Boutons ============

async function processBlockAction(teamId: string, interaction: SlackInteraction): Promise<void> {
  const ctx = await resolveSlackCtx(teamId);
  if (!ctx) return;
  const action = interaction.actions?.[0];
  if (!action) return;

  switch (action.action_id) {
    case "open_standup_modal": {
      if (interaction.trigger_id) {
        await openModal(ctx.token, interaction.trigger_id, standupModal(ctx.island.id));
      }
      return;
    }
    case "open_vote_modal": {
      if (!interaction.trigger_id) return;
      await openVoteModalFor(ctx, interaction.user.id, interaction.trigger_id);
      return;
    }
    case "mission_done": {
      if (action.value) {
        await handleMissionDoneButton({
          gameMissionId: action.value,
          clickerSlackId: interaction.user.id,
          token: ctx.token,
        });
      }
      return;
    }
    case "unlock_clue": {
      // Bouton du canal : on renvoie vers la commande dédiée (achat explicite).
      await postEphemeral(ctx.token, ctx.island.slack_channel_id, interaction.user.id,
        `To unlock: \`/rabbiteam unlock ${action.value ?? 2}\` 🥕`);
      return;
    }
  }
}

async function openVoteModalFor(ctx: SlackCtx, slackUserId: string, triggerId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const player = await resolvePlayer(ctx.island.id, slackUserId);
  if (!player) return;
  const { data: game } = await admin
    .from("games")
    .select("id")
    .eq("island_id", ctx.island.id)
    .eq("status", "voting")
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!game) {
    await postEphemeral(ctx.token, ctx.island.slack_channel_id, slackUserId,
      "The burrow opens Friday 11am 🐰");
    return;
  }
  const { data: players } = await admin
    .from("players")
    .select("*")
    .eq("island_id", ctx.island.id)
    .eq("is_active", true);
  const candidates = ((players ?? []) as PlayerRow[])
    .filter((p) => p.id !== player.id)
    .map((p) => ({ playerId: p.id, name: p.display_name }));
  await openModal(ctx.token, triggerId, voteModal(game.id, candidates));
}
