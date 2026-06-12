"use client";

/**
 * Île privée : rendu 3D plein écran + panneau latéral (saison, indices,
 * collection, équipement). Realtime branché UNIQUEMENT pendant les fenêtres
 * de vote/révélation (channel par île).
 */
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import RabbitChat from "@/components/RabbitChat";
import type { CeremonyState } from "@/components/three/effects/RevealCeremony";
import type { IslandEventLite } from "@/lib/island-builder";

const IslandScene = dynamic(() => import("@/components/three/IslandScene"), { ssr: false });

export interface PanelPlayer {
  id: string;
  name: string;
  avatarSeed: string;
  equipped: Record<string, string>;
}

export interface MyItem {
  slug: string;
  name: string;
  slot: string;
  rarity: string;
}

export interface IslandClientProps {
  islandId: string;
  slug: string;
  name: string;
  seed: string;
  events: IslandEventLite[];
  islandItems: string[];
  players: PanelPlayer[];
  me: { playerId: string; carrots: number; streak: number; equipped: Record<string, string> } | null;
  myItems: MyItem[];
  game: { id: string; status: string; result: string | null } | null;
  clues: { ordinal: number; content: string }[];
}

const SLOT_LABELS: Record<string, string> = {
  head: "Head",
  face: "Face",
  neck: "Neck",
  hand: "Hand",
  aura: "Aura",
};

export default function IslandClient(props: IslandClientProps) {
  const [equipped, setEquipped] = useState(props.me?.equipped ?? {});
  const [gameStatus, setGameStatus] = useState(props.game?.status ?? null);
  const [ceremony, setCeremony] = useState<CeremonyState | null>(null);
  const [voters, setVoters] = useState<Set<string>>(new Set());
  const [panelOpen, setPanelOpen] = useState(true);
  const [chatPlayer, setChatPlayer] = useState<{ id: string; name: string } | null>(null);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  // Realtime : seulement pendant vote/révélation.
  useEffect(() => {
    if (gameStatus !== "voting" && gameStatus !== "revealed") return;
    const channel = supabase
      .channel(`island:${props.islandId}`)
      .on("broadcast", { event: "vote_cast" }, ({ payload }) => {
        const voterId = (payload as { voterPlayerId?: string }).voterPlayerId;
        if (voterId) setVoters((prev) => new Set(prev).add(voterId));
      })
      .on("broadcast", { event: "reveal" }, ({ payload }) => {
        const p = payload as {
          result?: CeremonyState["result"];
          rabbitPlayerId?: string;
          accusedPlayerId?: string | null;
        };
        if (p.result && p.rabbitPlayerId) {
          setGameStatus("revealed");
          setCeremony({
            result: p.result,
            rabbitPlayerId: p.rabbitPlayerId,
            accusedPlayerId: p.accusedPlayerId ?? null,
            startedAt: Date.now(),
          });
        }
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, props.islandId, gameStatus]);

  async function toggleEquip(item: MyItem): Promise<void> {
    if (!props.me) return;
    const next = { ...equipped };
    if (next[item.slot] === item.slug) {
      delete next[item.slot];
    } else {
      next[item.slot] = item.slug;
    }
    setEquipped(next);
    // RLS : players_self_update n'autorise que mes colonnes non protégées.
    await supabase.from("players").update({ equipped: next }).eq("id", props.me.playerId);
  }

  // On affiche QUI a voté (✓), jamais pour qui.
  const rabbits = props.players.map((p) => ({
    playerId: p.id,
    avatarSeed: p.avatarSeed,
    name: voters.has(p.id) ? `${p.name} (voted)` : p.name,
    equipped: p.id === props.me?.playerId ? equipped : p.equipped,
  }));

  const myItemsBySlot = new Map<string, MyItem[]>();
  for (const it of props.myItems) {
    const list = myItemsBySlot.get(it.slot) ?? [];
    list.push(it);
    myItemsBySlot.set(it.slot, list);
  }

  return (
    <div className="island-page">
      <IslandScene
        seed={props.seed}
        teamName={props.name}
        events={props.events}
        islandItems={props.islandItems}
        rabbits={rabbits}
        gathered={gameStatus === "voting" || ceremony !== null}
        ceremony={ceremony}
        onRabbitClick={(id) => {
          const p = props.players.find((pl) => pl.id === id);
          if (p) setChatPlayer({ id: p.id, name: p.name });
        }}
      />

      <aside className={`island-panel${panelOpen ? "" : " collapsed"}`}>
        <button
          className="item-chip"
          style={{ float: "right" }}
          onClick={() => setPanelOpen((o) => !o)}
        >
          {panelOpen ? "−" : "+"}
        </button>
        {panelOpen && (
          <>
            <h1>{props.name}</h1>
            <div style={{ color: "var(--ink-soft)" }}>
              {props.players.length} rabbits
              {props.me && (
                <>
                  {" "}· {props.me.carrots} carrots · streak {props.me.streak}
                </>
              )}
            </div>

            <h2>Talk to a rabbit</h2>
            <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 6 }}>
              Click a rabbit (here or on the island) to chat and fish for clues.
            </div>
            <div className="item-grid">
              {props.players.map((p) => (
                <button
                  key={p.id}
                  className="item-chip"
                  onClick={() => setChatPlayer({ id: p.id, name: p.name })}
                >
                  🐰 {p.name}
                </button>
              ))}
            </div>

            <h2>Season</h2>
            <div className="clue-line">
              {gameStatus === "voting"
                ? "Voting is open! The rabbits are gathering…"
                : gameStatus === "active"
                  ? "The Rabbit is among you."
                  : gameStatus === "revealed"
                    ? "Season revealed - debrief in progress."
                    : "No season this week."}
            </div>
            {voters.size > 0 && (
              <div className="clue-line">
                {voters.size} vote{voters.size > 1 ? "s" : ""} cast{" "}
                (who voted, never for whom)
              </div>
            )}

            {props.clues.length > 0 && (
              <>
                <h2>Clues</h2>
                {props.clues.map((c) => (
                  <div key={c.ordinal} className="clue-line">
                    #{c.ordinal} - {c.content}
                  </div>
                ))}
              </>
            )}

            {props.me && (
              <>
                <h2>My collection</h2>
                {props.myItems.length === 0 && (
                  <div style={{ color: "var(--ink-soft)" }}>
                    Do your standups, build streaks, items will drop.
                  </div>
                )}
                {[...myItemsBySlot.entries()].map(([slot, items]) => (
                  <div key={slot} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                      {SLOT_LABELS[slot] ?? slot}
                    </div>
                    <div className="item-grid">
                      {items.map((it) => (
                        <button
                          key={it.slug}
                          className={`item-chip rarity-${it.rarity}${equipped[it.slot] === it.slug ? " equipped" : ""}`}
                          onClick={() => void toggleEquip(it)}
                        >
                          {it.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </aside>

      {gameStatus === "voting" && !ceremony && (
        <div className="vote-banner">Voting open in Slack: /rabbiteam vote</div>
      )}
      {ceremony && (
        <div className="vote-banner">
          {ceremony.result === "rabbit_win"
            ? "The Rabbit escaped!"
            : ceremony.result === "detectives_win"
              ? "Unmasked!"
              : "Draw…"}
        </div>
      )}

      {chatPlayer && (
        <RabbitChat slug={props.slug} player={chatPlayer} onClose={() => setChatPlayer(null)} />
      )}
    </div>
  );
}
