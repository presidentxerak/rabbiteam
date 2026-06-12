"use client";

/**
 * Île de démonstration en fond de landing : seed fixe, événements et
 * lapins générés (aucune donnée réelle). Non interactive (pointer-events
 * none côté CSS) : l'auto-rotation fait le spectacle, le scroll reste fluide.
 */
import dynamic from "next/dynamic";
import { useMemo } from "react";
import { DEMO_ISLAND_ITEMS, DEMO_RABBITS, DEMO_SEED, demoIslandEvents } from "@/lib/demo-island";

const IslandScene = dynamic(() => import("@/components/three/IslandScene"), { ssr: false });

export default function LandingIsland() {
  const events = useMemo(() => demoIslandEvents(), []);
  return (
    <div className="landing-bg" aria-hidden="true">
      <IslandScene
        seed={DEMO_SEED}
        teamName="RABBITEAM"
        events={events}
        islandItems={DEMO_ISLAND_ITEMS}
        rabbits={DEMO_RABBITS}
      />
    </div>
  );
}
