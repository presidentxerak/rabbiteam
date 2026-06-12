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
    title: { type: "plain_text", text: "Standup du jour 🐰" },
    submit: { type: "plain_text", text: "Poser mon intention" },
    close: { type: "plain_text", text: "Plus tard" },
    blocks: [
      {
        type: "input",
        block_id: "intention_block",
        label: { type: "plain_text", text: "Mon intention du jour" },
        element: {
          type: "plain_text_input",
          action_id: "intention",
          max_length: 140,
          placeholder: { type: "plain_text", text: "Aujourd'hui je termine la maquette…" },
        },
      },
      {
        type: "input",
        block_id: "mood_block",
        label: { type: "plain_text", text: "Humeur" },
        element: {
          type: "static_select",
          action_id: "mood",
          initial_option: { text: { type: "plain_text", text: "🙂 Ça va" }, value: "🙂" },
          options: [
            { text: { type: "plain_text", text: "🙂 Ça va" }, value: "🙂" },
            { text: { type: "plain_text", text: "🚀 En forme" }, value: "🚀" },
            { text: { type: "plain_text", text: "😴 Fatigué·e" }, value: "😴" },
            { text: { type: "plain_text", text: "🤯 Débordé·e" }, value: "🤯" },
            { text: { type: "plain_text", text: "🎉 Excellent" }, value: "🎉" },
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
    title: { type: "plain_text", text: "Qui est le Lapin ? 🕵️" },
    submit: { type: "plain_text", text: "Voter" },
    close: { type: "plain_text", text: "Annuler" },
    blocks: [
      section("Désigne ton suspect. Tu peux changer ton vote jusqu'à la clôture (16h)."),
      {
        type: "input",
        block_id: "suspect_block",
        label: { type: "plain_text", text: "Mon suspect" },
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
    section("🤫 *C'est toi.* Cette semaine, tu es **le Lapin**."),
    section(
      "Voici tes 3 missions. Accomplis-en *au moins 2* avant vendredi 11h sans te faire repérer. " +
        "Les missions détectées automatiquement se cochent toutes seules ; les autres, coche-les toi-même (parole de Lapin).",
    ),
    divider(),
  ];
  missions.forEach((m, i) => {
    blocks.push(section(`*Mission ${i + 1}* ${stars(m.difficulty)}\n${m.briefMd}`));
    if (m.detection === "honor") {
      blocks.push(
        actions(button("J'ai accompli cette mission ✅", "mission_done", m.gameMissionId)),
      );
    } else {
      blocks.push(context("🔎 Détection automatique — rien à faire, je te confirme en DM."));
    }
  });
  blocks.push(divider());
  blocks.push(context("Ce message disparaît de ta mémoire vendredi 16h30. Bonne chance, agent. 🐰"));
  return blocks;
}

// ============ Annonces publiques de saison ============

export function seasonOpenBlocks(seasonNumber: number): Block[] {
  return [
    section(`🐰 *Saison #${seasonNumber} ouverte.* Le Lapin est parmi vous.`),
    context("Premier indice mardi 10h. Restez attentifs…"),
  ];
}

export function votingOpenBlocks(islandUrl: string): Block[] {
  return [
    section("🗳️ *Le terrier est ouvert.* Qui est le Lapin cette semaine ?"),
    actions(button("Voter 🗳️", "open_vote_modal"), linkButton("Voir l'île 🏝️", islandUrl)),
    context("Vote modifiable jusqu'à 16h. Sur l'île, les lapins se rassemblent déjà…"),
  ];
}

export function standupReminderBlocks(): Block[] {
  return [
    section("☀️ *Standup du jour* — pose ton intention en 30 secondes, gagne tes carottes."),
    actions(button("Faire mon standup 🥕", "open_standup_modal")),
  ];
}

export function clueBlocks(ordinal: number, content: string | null, price: number): Block[] {
  if (content) {
    return [section(`🔍 *Indice n°${ordinal}* — ${content}`)];
  }
  return [
    section(`🔍 *Indice n°${ordinal}* — disponible au terrier.`),
    actions(button(`Débloquer (${price} 🥕)`, "unlock_clue", String(ordinal))),
    context("L'achat est individuel. Ce que tu en dis ensuite… c'est ton affaire. 😏"),
  ];
}

export function dropAnnounceBlocks(playerName: string, itemName: string, rarity: string, reason: string): Block[] {
  const rarityEmoji: Record<string, string> = {
    common: "⚪", uncommon: "🟢", rare: "🔵", epic: "🟣", legendary: "🟡",
  };
  return [
    section(`✨ *${playerName}* a débloqué *${itemName}* ${rarityEmoji[rarity] ?? ""} — ${reason}`),
  ];
}
