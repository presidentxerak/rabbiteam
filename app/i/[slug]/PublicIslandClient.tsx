"use client";

/** Rendu 3D de l'île publique : lapins SANS noms, lecture seule. */
import dynamic from "next/dynamic";
import type { IslandEventLite } from "@/lib/island-builder";

const IslandScene = dynamic(() => import("@/components/three/IslandScene"), { ssr: false });

export default function PublicIslandClient(props: {
  seed: string;
  name: string;
  events: IslandEventLite[];
  rabbits: { avatarSeed: string; equipped: Record<string, string> }[];
}) {
  return (
    <IslandScene
      seed={props.seed}
      teamName={props.name}
      events={props.events}
      rabbits={props.rabbits.map((r) => ({ avatarSeed: r.avatarSeed, equipped: r.equipped }))}
    />
  );
}
