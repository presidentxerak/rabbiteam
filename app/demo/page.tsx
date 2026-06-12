"use client";

/**
 * Île de démonstration en plein écran, INTERACTIVE (orbite, zoom) et où les
 * lapins sont CHATTABLES (chat de démo, réponses génériques, sans login).
 */
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import RabbitChat from "@/components/RabbitChat";
import { DEMO_ISLAND_ITEMS, DEMO_RABBITS, DEMO_SEED, demoIslandEvents } from "@/lib/demo-island";

const IslandScene = dynamic(() => import("@/components/three/IslandScene"), { ssr: false });

export default function DemoIslandPage() {
  const events = useMemo(() => demoIslandEvents(), []);
  const [chat, setChat] = useState<{ name: string; seed: string } | null>(null);

  // Lapins cliquables : on utilise l'avatarSeed comme identifiant.
  const rabbits = DEMO_RABBITS.map((r) => ({
    playerId: r.avatarSeed,
    avatarSeed: r.avatarSeed,
    name: r.name,
    equipped: r.equipped,
  }));

  return (
    <div className="island-page">
      <IslandScene
        seed={DEMO_SEED}
        teamName="RABBITEAM"
        events={events}
        islandItems={DEMO_ISLAND_ITEMS}
        rabbits={rabbits}
        onRabbitClick={(id) => {
          const r = DEMO_RABBITS.find((x) => x.avatarSeed === id);
          if (r) setChat({ name: r.name, seed: r.avatarSeed });
        }}
      />

      <aside className="island-panel">
        <h1>Sample island</h1>
        <p style={{ color: "var(--ink-soft)" }}>
          Drag to orbit, scroll to zoom, and <strong>click a rabbit to chat</strong> with it. This
          island is procedurally generated - your team&apos;s real one grows from your Slack, Notion
          and Kanban activity.
        </p>
        <h2>Talk to a rabbit</h2>
        <div className="item-grid">
          {DEMO_RABBITS.map((r) => (
            <button
              key={r.avatarSeed}
              className="item-chip"
              onClick={() => setChat({ name: r.name, seed: r.avatarSeed })}
            >
              🐰 {r.name}
            </button>
          ))}
        </div>
        <Link
          className="btn btn-primary"
          href="/"
          style={{ display: "block", textAlign: "center", marginTop: 14 }}
        >
          Back to Rabbiteam
        </Link>
      </aside>

      {chat && (
        <RabbitChat
          name={chat.name}
          payload={{ demo: true, name: chat.name, seed: chat.seed }}
          onClose={() => setChat(null)}
        />
      )}
    </div>
  );
}
