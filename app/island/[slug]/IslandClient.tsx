"use client";

/**
 * Île privée : rendu 3D plein écran + panneau latéral (saison, indices,
 * collection, équipement). Realtime branché UNIQUEMENT pendant les fenêtres
 * de vote/révélation (channel par île).
 */
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
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
  head: "Tête",
  face: "Visage",
  neck: "Cou",
  hand: "Main",
  aura: "Aura",
};

export default function IslandClient(props: IslandClientProps) {
  const [equipped, setEquipped] = useState(props.me?.equipped ?? {});
  const [gameStatus, setGameStatus] = useState(props.game?.status ?? null);
  const [ceremony, setCeremony] = useState<CeremonyState | null>(null);
  const [voters, setVoters] = useState<Set<string>>(new Set());
  const [panelOpen, setPanelOpen] = useState(true);
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
    name: voters.has(p.id) ? `${p.name} 🗳️✓` : p.name,
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
      />

      <aside className={`island-panel${panelOpen ? "" : " collapsed"}`}>
        <button
          className="item-chip"
          style={{ float: "right" }}
          onClick={() => setPanelOpen((o) => !o)}
        >
          {panelOpen ? "−" : "🐰"}
        </button>
        {panelOpen && (
          <>
            <h1>🏝️ {props.name}</h1>
            <div style={{ color: "var(--ink-soft)" }}>
              {props.players.length} lapins
              {props.me && (
                <>
                  {" "}· {props.me.carrots} 🥕 · streak {props.me.streak} {props.me.streak >= 3 ? "🔥" : ""}
                </>
              )}
            </div>

            <h2>Saison</h2>
            <div className="clue-line">
              {gameStatus === "voting"
                ? "🗳️ Le vote est ouvert ! Les lapins se rassemblent…"
                : gameStatus === "active"
                  ? "🐰 Le Lapin est parmi vous."
                  : gameStatus === "revealed"
                    ? "🎭 Saison révélée — debrief en cours."
                    : "Pas de saison cette semaine."}
            </div>
            {voters.size > 0 && (
              <div className="clue-line">
                {voters.size} vote{voters.size > 1 ? "s" : ""} déposé{voters.size > 1 ? "s" : ""}{" "}
                (qui a voté, jamais pour qui 🤫)
              </div>
            )}

            {props.clues.length > 0 && (
              <>
                <h2>Indices</h2>
                {props.clues.map((c) => (
                  <div key={c.ordinal} className="clue-line">
                    🔍 n°{c.ordinal} — {c.content}
                  </div>
                ))}
              </>
            )}

            {props.me && (
              <>
                <h2>Ma collection</h2>
                {props.myItems.length === 0 && (
                  <div style={{ color: "var(--ink-soft)" }}>
                    Fais tes standups, gagne des streaks, des items tomberont. 🥕
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
        <div className="vote-banner">🗳️ Vote ouvert dans Slack : /rabbiteam vote</div>
      )}
      {ceremony && (
        <div className="vote-banner">
          {ceremony.result === "rabbit_win"
            ? "🐰 Le Lapin s'est échappé !"
            : ceremony.result === "detectives_win"
              ? "🔍 Démasqué !"
              : "😶 Match nul…"}
        </div>
      )}
    </div>
  );
}
