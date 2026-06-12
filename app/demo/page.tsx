"use client";

/**
 * Île de démonstration en plein écran, INTERACTIVE (orbite, zoom) :
 * accessible depuis la landing pour explorer l'île sans installer l'app.
 * Même île procédurale que le fond de landing, mais jouable.
 */
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo } from "react";
import { DEMO_ISLAND_ITEMS, DEMO_RABBITS, DEMO_SEED, demoIslandEvents } from "@/lib/demo-island";

const IslandScene = dynamic(() => import("@/components/three/IslandScene"), { ssr: false });

export default function DemoIslandPage() {
  const events = useMemo(() => demoIslandEvents(), []);
  return (
    <div className="island-page">
      <IslandScene
        seed={DEMO_SEED}
        teamName="RABBITEAM"
        events={events}
        islandItems={DEMO_ISLAND_ITEMS}
        rabbits={DEMO_RABBITS}
      />
      <aside className="island-panel">
        <h1>Sample island</h1>
        <p style={{ color: "var(--ink-soft)" }}>
          Drag to orbit, scroll to zoom. This island is procedurally generated from a seed - your
          team&apos;s real one grows from your Slack, Notion and Kanban activity.
        </p>
        <Link className="btn btn-primary" href="/" style={{ display: "block", textAlign: "center" }}>
          Back to Rabbiteam
        </Link>
      </aside>
    </div>
  );
}
