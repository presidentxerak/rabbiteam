"use client";

/**
 * Île de démonstration en fond de landing : seed fixe, événements et
 * lapins générés (aucune donnée réelle). Non interactive (pointer-events
 * none côté CSS) : l'auto-rotation fait le spectacle, le scroll reste fluide.
 */
import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { IslandEventLite } from "@/lib/island-builder";

const IslandScene = dynamic(() => import("@/components/three/IslandScene"), { ssr: false });

const DEMO_SEED = "rabbiteam-demo-island";

export default function LandingIsland() {
  const { events, rabbits } = useMemo(() => {
    // Une île déjà vivante : fleurs, lanternes, coquillages, monuments.
    const types = ["standup", "kudo", "notion_page", "sprint_done", "member_joined"];
    const demoEvents: IslandEventLite[] = Array.from({ length: 90 }).map((_, i) => ({
      id: `demo-${i}`,
      type: types[i % types.length] ?? "standup",
    }));
    demoEvents.push({ id: "demo-rw", type: "season_rabbit_win" });
    demoEvents.push({ id: "demo-dw", type: "season_detective_win" });

    const demoRabbits: { avatarSeed: string; equipped: Record<string, string> }[] = [
      { avatarSeed: "demo-rabbit-1", equipped: { head: "beach_hat" } },
      { avatarSeed: "demo-rabbit-2", equipped: { hand: "carrot_classic" } },
      { avatarSeed: "demo-rabbit-3", equipped: { face: "heart_sunglasses" } },
      { avatarSeed: "demo-rabbit-4", equipped: { neck: "flower_lei" } },
      { avatarSeed: "demo-rabbit-5", equipped: { head: "flower_crown", hand: "coffee_mug" } },
      { avatarSeed: "demo-rabbit-6", equipped: { aura: "fireflies" } },
    ];
    return { events: demoEvents, rabbits: demoRabbits };
  }, []);

  return (
    <div className="landing-bg" aria-hidden="true">
      <IslandScene
        seed={DEMO_SEED}
        teamName="RABBITEAM"
        events={events}
        islandItems={["house_garland", "campfire", "giant_buoy"]}
        rabbits={rabbits}
      />
    </div>
  );
}
