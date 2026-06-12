/**
 * Builders Block Kit. Ton kawaii mais sobre : c'est un outil pro.
 * Tous les messages publics du jeu passent par ici.
 */

type Block = Record<string, unknown>;

export function section(text: string): Block {
  return { type: "section", text: { type: "mrkdwn", text } };
}

export function context(text: string): Block {
  return { type: "context", elements: [{ type: "mrkdwn", text }] };
}

export function divider(): Block {
  return { type: "divider" };
}

export function actions(...elements: Block[]): Block {
  return { type: "actions", elements };
}

export function button(text: string, actionId: string, value?: string, style?: "primary" | "danger"): Block {
  return {
    type: "button",
    text: { type: "plain_text", text, emoji: true },
    action_id: actionId,
    ...(value ? { value } : {}),
    ...(style ? { style } : {}),
  };
}

export function linkButton(text: string, url: string): Block {
  return { type: "button", text: { type: "plain_text", text, emoji: true }, url, action_id: `link_${Math.random().toString(36).slice(2, 8)}` };
}

// ============ Modal de standup ============

export function standupModal(islandId: string): Record<string, unknown> {
  return {
    type: "modal",
    callback_id: "standup_submit",
    private_metadata: islandId,
    title: { type: "plain_text", text: "Today's standup 🐰" },
    submit: { type: "plain_text", text: "Drop my intention" },
    close: { type: "plain_text", text: "Later" },
    blocks: [
      {
        type: "input",
        block_id: "intention_block",
        label: { type: "plain_text", text: "My intention for today" },
        element: {
          type: "plain_text_input",
          action_id: "intention",
          max_length: 140,
          placeholder: { type: "plain_text", text: "Today I'm finishing the mockup…" },
        },
      },
      {
        type: "input",
        block_id: "mood_block",
        label: { type: "plain_text", text: "Humeur" },
        element: {
          type: "static_select",
          action_id: "mood",
          initial_option: { text: { type: "plain_text", text: "🙂 Okay" }, value: "🙂" },
          options: [
            { text: { type: "plain_text", text: "🙂 Okay" }, value: "🙂" },
            { text: { type: "plain_text", text: "🚀 On fire" }, value: "🚀" },
            { text: { type: "plain_text", text: "😴 Tired" }, value: "😴" },
            { text: { type: "plain_text", text: "🤯 Swamped" }, value: "🤯" },
            { text: { type: "plain_text", text: "🎉 Great" }, value: "🎉" },
          ],
        },
      },
    ],
  };
}

// ============ Modal de vote ============

export function voteModal(
  gameId: string,
  candidates: { playerId: string; name: string }[],
): Record<string, unknown> {
  return {
    type: "modal",
    callback_id: "vote_submit",
    private_metadata: gameId,
    title: { type: "plain_text", text: "Who is the Rabbit? 🕵️" },
    submit: { type: "plain_text", text: "Vote" },
    close: { type: "plain_text", text: "Cancel" },
    blocks: [
      section("Name your suspect. You can change your vote until voting closes (4pm)."),
      {
        type: "input",
        block_id: "suspect_block",
        label: { type: "plain_text", text: "My suspect" },
        element: {
          type: "static_select",
          action_id: "suspect",
          options: candidates.map((c) => ({
            text: { type: "plain_text", text: c.name },
            value: c.playerId,
          })),
        },
      },
    ],
  };
}

// ============ DM des missions du Lapin ============

export function rabbitMissionsDM(
  missions: { gameMissionId: string; briefMd: string; difficulty: number; detection: string }[],
): Block[] {
  const stars = (d: number) => "⭐".repeat(d);
  const blocks: Block[] = [
    section("🤫 *It's you.* This week, you are **the Rabbit**."),
    section(
      "Here are your 3 missions. Pull off *at least 2* before Friday 11am without getting spotted. " +
        "Auto-detected missions check themselves off; for the others, mark them yourself (Rabbit's honor).",
    ),
    divider(),
  ];
  missions.forEach((m, i) => {
    blocks.push(section(`*Mission ${i + 1}* ${stars(m.difficulty)}\n${m.briefMd}`));
    if (m.detection === "honor") {
      blocks.push(
        actions(button("I completed this mission ✅", "mission_done", m.gameMissionId)),
      );
    } else {
      blocks.push(context("🔎 Auto-detected - nothing to do, I'll confirm in your DMs."));
    }
  });
  blocks.push(divider());
  blocks.push(context("This message self-destructs from your memory Friday 4:30pm. Good luck, agent. 🐰"));
  return blocks;
}

// ============ Public season announcements ============

export function seasonOpenBlocks(seasonNumber: number): Block[] {
  return [
    section(`🐰 *Season #${seasonNumber} is open.* The Rabbit is among you.`),
    context("First clue Tuesday 10am. Stay sharp…"),
  ];
}

export function votingOpenBlocks(islandUrl: string): Block[] {
  return [
    section("🗳️ *The burrow is open.* Who is the Rabbit this week?"),
    actions(button("Vote 🗳️", "open_vote_modal"), linkButton("View the island 🏝️", islandUrl)),
    context("Vote editable until 4pm. On the island, the rabbits are already gathering…"),
  ];
}

export function standupReminderBlocks(): Block[] {
  return [
    section("☀️ *Today's standup* - drop your intention in 30 seconds, earn your carrots."),
    actions(button("Do my standup 🥕", "open_standup_modal")),
  ];
}

export function clueBlocks(ordinal: number, content: string | null, price: number): Block[] {
  if (content) {
    return [section(`🔍 *Clue #${ordinal}* - ${content}`)];
  }
  return [
    section(`🔍 *Clue #${ordinal}* - available at the burrow.`),
    actions(button(`Unlock (${price} 🥕)`, "unlock_clue", String(ordinal))),
    context("Purchase is individual. What you say about it afterwards… that's your business. 😏"),
  ];
}

export function dropAnnounceBlocks(playerName: string, itemName: string, rarity: string, reason: string): Block[] {
  const rarityEmoji: Record<string, string> = {
    common: "⚪", uncommon: "🟢", rare: "🔵", epic: "🟣", legendary: "🟡",
  };
  return [
    section(`✨ *${playerName}* unlocked *${itemName}* ${rarityEmoji[rarity] ?? ""} - ${reason}`),
  ];
}
