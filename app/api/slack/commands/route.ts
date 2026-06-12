/**
 * Slash commands /rabbiteam : setup, standup, indice, vote, ile, inviter.
 * HMAC vérifié → ack < 3 s → traitement en arrière-plan (after + response_url).
 */
import { NextResponse, after } from "next/server";
import { readVerifiedSlackBody } from "@/lib/slack/verify";
import { slackCommandSchema, type SlackCommand } from "@/lib/zod-schemas";
import { resolveSlackCtx, resolvePlayer, type SlackCtx } from "@/lib/server/slack-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getChannelMembers, getUserInfo, openModal, postDM } from "@/lib/slack/client";
import { standupModal, voteModal } from "@/lib/slack/blocks";
import { canAddPlayer } from "@/lib/game-engine";
import { checkReferralActivation } from "@/lib/server/referrals";
import { randomSeed } from "@/lib/prng";
import type { GameRow, PlayerRow } from "@/lib/server/db-types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://rabbiteam.app";

async function respond(responseUrl: string, text: string): Promise<void> {
  await fetch(responseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ response_type: "ephemeral", text }),
  });
}

export async function POST(req: Request): Promise<NextResponse> {
  const body = await readVerifiedSlackBody(req);
  if (body === null) return NextResponse.json({ ok: false }, { status: 401 });

  const params = Object.fromEntries(new URLSearchParams(body));
  const parsed = slackCommandSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ response_type: "ephemeral", text: "Commande illisible 🐰" });
  }
  const cmd = parsed.data;
  const [sub = "aide"] = cmd.text.trim().split(/\s+/);

  after(async () => {
    try {
      const ctx = await resolveSlackCtx(cmd.team_id);
      if (!ctx) {
        await respond(cmd.response_url, "Rabbiteam isn't installed here (yet). → " + APP_URL());
        return;
      }
      switch (sub.toLowerCase()) {
        case "setup": return await handleSetup(ctx, cmd);
        case "standup": return await handleStandup(ctx, cmd);
        // Sous-commandes en anglais, alias français conservés.
        case "clue": case "clues": case "indice": return await handleIndice(ctx, cmd);
        case "unlock": case "debloquer": case "débloquer": return await handleDebloquer(ctx, cmd);
        case "vote": return await handleVote(ctx, cmd);
        case "island": case "ile": case "île": return await handleIle(ctx, cmd);
        case "invite": case "inviter": return await handleInviter(ctx, cmd);
        default:
          return await respond(
            cmd.response_url,
            "🐰 *Commands*: `/rabbiteam setup #channel` · `standup` · `clue` · `unlock <n>` · `vote` · `island` · `invite`",
          );
      }
    } catch (e) {
      console.error("[slack/commands] failed:", e);
      await respond(cmd.response_url, "Small burrow hiccup, please try again. 🐰").catch(() => undefined);
    }
  });

  // Ack vide immédiat : la vraie réponse arrive par response_url.
  return new NextResponse(null, { status: 200 });
}

// ============ /rabbiteam setup #canal ============

async function handleSetup(ctx: SlackCtx, cmd: SlackCommand): Promise<void> {
  const admin = createSupabaseAdminClient();
  // Le canal vient soit de l'argument "<#C123|nom>", soit du canal courant.
  const m = cmd.text.match(/<#(C\w+)\|?/);
  const channelId = m?.[1] ?? cmd.channel_id;

  await admin.from("islands").update({ slack_channel_id: channelId }).eq("id", ctx.island.id);
  ctx.island.slack_channel_id = channelId;

  // Plan : limite de joueurs (free : 8)
  const { data: org } = await admin
    .from("organizations").select("plan").eq("id", ctx.orgId)
    .single<{ plan: "free" | "team" | "company" }>();
  const plan = org?.plan ?? "free";

  const members = await getChannelMembers(ctx.token, channelId);
  let created = 0;
  let skipped = 0;
  for (const slackUserId of members) {
    const info = await getUserInfo(ctx.token, slackUserId);
    if (!info || info.isBot) continue;
    const existing = await resolvePlayer(ctx.island.id, slackUserId);
    if (existing) continue;

    const { count } = await admin
      .from("players")
      .select("id", { count: "exact", head: true })
      .eq("island_id", ctx.island.id)
      .eq("is_active", true);
    if (!canAddPlayer(plan, count ?? 0)) { skipped++; continue; }

    const { data: player } = await admin
      .from("players")
      .insert({
        island_id: ctx.island.id,
        slack_user_id: slackUserId,
        display_name: info.name,
        avatar_seed: randomSeed(),
      })
      .select("id")
      .single<{ id: string }>();
    if (!player) continue;
    created++;
    await admin.from("island_events").insert({
      island_id: ctx.island.id,
      type: "member_joined",
      actor_player_id: player.id,
    });
    // Lien magique : première visite web → lie auth_user_id + révèle son lapin.
    const link = `${APP_URL()}/join/${ctx.island.invite_code}?u=${slackUserId}`;
    await postDM(
      ctx.token,
      slackUserId,
      `🐰 Welcome to the *${ctx.island.name}* island! Meet your rabbit (already born, waiting for you): ${link}`,
    );
  }

  // Le seuil de parrainage (5 joueurs actifs) peut être franchi ici.
  await checkReferralActivation(ctx.orgId).catch(() => undefined);

  const skippedNote = skipped > 0
    ? `\n⚠️ ${skipped} member(s) not added (Free plan limit: 8 players). → ${APP_URL()}/#pricing`
    : "";
  await respond(
    cmd.response_url,
    `🏝️ Channel <#${channelId}> configured. ${created} rabbit(s) invited by DM.${skippedNote}\nThe first Rabbit Season starts Monday 9am.`,
  );
}

// ============ /rabbiteam standup ============

async function handleStandup(ctx: SlackCtx, cmd: SlackCommand): Promise<void> {
  const player = await resolvePlayer(ctx.island.id, cmd.user_id);
  if (!player) {
    await respond(cmd.response_url, "You don't have a rabbit here yet — ask your team to run `/rabbiteam setup` 🐰");
    return;
  }
  await openModal(ctx.token, cmd.trigger_id, standupModal(ctx.island.id));
}

// ============ /rabbiteam indice ============

async function handleIndice(ctx: SlackCtx, cmd: SlackCommand): Promise<void> {
  const admin = createSupabaseAdminClient();
  const player = await resolvePlayer(ctx.island.id, cmd.user_id);
  const { data: game } = await admin
    .from("games")
    .select("*")
    .eq("island_id", ctx.island.id)
    .in("status", ["active", "voting"])
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle<GameRow>();
  if (!game) {
    await respond(cmd.response_url, "No season in progress. The Rabbit returns Monday 9am 🐰");
    return;
  }
  const { data: clues } = await admin
    .from("clues")
    .select("ordinal, content, tier, price, revealed_at")
    .eq("game_id", game.id)
    .order("ordinal");
  const { data: unlocks } = player
    ? await admin
        .from("clue_unlocks")
        .select("ordinal")
        .eq("game_id", game.id)
        .eq("player_id", player.id)
    : { data: [] };
  const unlocked = new Set((unlocks ?? []).map((u) => u.ordinal as number));

  const lines: string[] = ["🔍 *Season clues*"];
  let any = false;
  for (const c of clues ?? []) {
    const ordinal = c.ordinal as number;
    if (c.revealed_at || unlocked.has(ordinal)) {
      lines.push(`• Clue #${ordinal} — ${c.content}`);
      any = true;
    } else if (c.tier === "paid") {
      lines.push(`• Clue #${ordinal} — 🔒 unlock (${c.price} 🥕): \`/rabbiteam unlock ${ordinal}\` or via the web island`);
      any = true;
    }
  }
  if (!any) lines.push("No clue published yet. First clue Tuesday 10am.");
  await respond(cmd.response_url, lines.join("\n"));
}

// ============ /rabbiteam debloquer <n> — achat d'indice payant ============

async function handleDebloquer(ctx: SlackCtx, cmd: SlackCommand): Promise<void> {
  const admin = createSupabaseAdminClient();
  const player = await resolvePlayer(ctx.island.id, cmd.user_id);
  if (!player) {
    await respond(cmd.response_url, "You don't have a rabbit here yet 🐰");
    return;
  }
  const ordinal = Number(cmd.text.trim().split(/\s+/)[1] ?? "2");
  const { data: game } = await admin
    .from("games")
    .select("id")
    .eq("island_id", ctx.island.id)
    .in("status", ["active", "voting"])
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!game) {
    await respond(cmd.response_url, "No season in progress 🐰");
    return;
  }
  const { data: clue } = await admin
    .from("clues")
    .select("content, price, tier")
    .eq("game_id", game.id)
    .eq("ordinal", ordinal)
    .eq("tier", "paid")
    .maybeSingle<{ content: string; price: number; tier: string }>();
  if (!clue) {
    await respond(cmd.response_url, "This clue isn't for sale 🐰");
    return;
  }
  const { data: already } = await admin
    .from("clue_unlocks")
    .select("ordinal")
    .eq("game_id", game.id)
    .eq("ordinal", ordinal)
    .eq("player_id", player.id)
    .maybeSingle();
  if (already) {
    await respond(cmd.response_url, `🔓 Already unlocked — ${clue.content}`);
    return;
  }
  if (player.carrots < clue.price) {
    await respond(cmd.response_url, `You need ${clue.price} 🥕 (you have ${player.carrots}). Standups are the bank.`);
    return;
  }
  await admin.from("players").update({ carrots: player.carrots - clue.price }).eq("id", player.id);
  await admin.from("clue_unlocks").insert({
    game_id: game.id,
    ordinal,
    player_id: player.id,
    paid: clue.price,
  });
  await respond(cmd.response_url, `🔓 *Clue #${ordinal}* — ${clue.content}\n(-${clue.price} 🥕. What you tell the team… that's your business 😏)`);
}

// ============ /rabbiteam vote ============

async function handleVote(ctx: SlackCtx, cmd: SlackCommand): Promise<void> {
  const admin = createSupabaseAdminClient();
  const player = await resolvePlayer(ctx.island.id, cmd.user_id);
  if (!player) {
    await respond(cmd.response_url, "You don't have a rabbit here yet 🐰");
    return;
  }
  const { data: game } = await admin
    .from("games")
    .select("*")
    .eq("island_id", ctx.island.id)
    .eq("status", "voting")
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle<GameRow>();
  if (!game) {
    await respond(cmd.response_url, "The burrow opens Friday 11am 🐰");
    return;
  }
  const { data: players } = await admin
    .from("players")
    .select("*")
    .eq("island_id", ctx.island.id)
    .eq("is_active", true);
  const candidates = ((players ?? []) as PlayerRow[])
    .filter((p) => p.id !== player.id) // no self-accusation
    .map((p) => ({ playerId: p.id, name: p.display_name }));
  await openModal(ctx.token, cmd.trigger_id, voteModal(game.id, candidates));
}

// ============ /rabbiteam ile ============

async function handleIle(ctx: SlackCtx, cmd: SlackCommand): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { count: population } = await admin
    .from("players")
    .select("id", { count: "exact", head: true })
    .eq("island_id", ctx.island.id)
    .eq("is_active", true);
  const { data: game } = await admin
    .from("games")
    .select("status")
    .eq("island_id", ctx.island.id)
    .in("status", ["active", "voting"])
    .limit(1)
    .maybeSingle<{ status: string }>();
  const season = game
    ? game.status === "voting"
      ? "🗳️ vote in progress!"
      : "🐰 season in progress"
    : "no season this week";
  await respond(
    cmd.response_url,
    `🏝️ *${ctx.island.name}* — ${population ?? 0} rabbits · ${season}\n${APP_URL()}/island/${ctx.island.slug}`,
  );
}

// ============ /rabbiteam invite ============

async function handleInviter(ctx: SlackCtx, cmd: SlackCommand): Promise<void> {
  await respond(
    cmd.response_url,
    `🥕✨ *Golden Carrot referral* — share this link:\n${APP_URL()}/?ref=${ctx.island.id}\n` +
      "When a team installs via this link and reaches 5 active players, " +
      "your WHOLE island (and theirs) receives the legendary Golden Carrot + a golden palm. 🌴",
  );
}
