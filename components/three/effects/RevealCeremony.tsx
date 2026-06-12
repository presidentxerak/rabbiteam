"use client";

/**
 * Cérémonie de révélation du vendredi : projecteur sur le lapin accusé,
 * "masque" qui tombe, confettis (victoire des Détectives ou du Lapin)
 * ou fumigène gris (match nul). Pilotée par l'événement Realtime `reveal`.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { mulberry32 } from "@/lib/prng";
import { Rabbit } from "../Rabbit";
import type { IslandRabbit } from "../Island";

export interface CeremonyState {
  result: "rabbit_win" | "detectives_win" | "draw";
  rabbitPlayerId: string;
  accusedPlayerId: string | null;
  startedAt: number; // Date.now() à la réception du broadcast
}

const CONFETTI_COLORS = ["#F6C6D8", "#FFF3CF", "#C8E6F5", "#CDEBD3", "#D9C7F2", "#FF8C7A"];

function Confetti({ seed, gray }: { seed: number; gray: boolean }) {
  const group = useRef<Group>(null);
  const parts = useMemo(() => {
    const rng = mulberry32(seed);
    return Array.from({ length: 80 }).map(() => ({
      x: (rng() - 0.5) * 5,
      z: (rng() - 0.5) * 5,
      y0: 3 + rng() * 3,
      speed: 0.4 + rng() * 0.8,
      spin: rng() * 4,
      color: gray ? "#BFC9D9" : CONFETTI_COLORS[Math.floor(rng() * CONFETTI_COLORS.length)],
    }));
  }, [seed, gray]);
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    g.children.forEach((child, i) => {
      const p = parts[i];
      if (!p) return;
      const t = clock.elapsedTime * p.speed;
      child.position.y = p.y0 - (t % (p.y0 + 0.5));
      child.rotation.x = t * p.spin;
      child.rotation.z = t * p.spin * 0.7;
    });
  });
  return (
    <group ref={group}>
      {parts.map((p, i) => (
        <mesh key={i} position={[p.x, p.y0, p.z]}>
          <boxGeometry args={[0.07, 0.012, 0.05]} />
          <meshToonMaterial color={p.color} />
        </mesh>
      ))}
    </group>
  );
}

export function RevealCeremony({
  state,
  rabbits,
}: {
  state: CeremonyState;
  rabbits: IslandRabbit[];
}) {
  const spotRef = useRef<Group>(null);
  const maskRef = useRef<Group>(null);
  const accused = rabbits.find((r) => r.playerId === state.accusedPlayerId);
  const realRabbit = rabbits.find((r) => r.playerId === state.rabbitPlayerId);
  const star = accused ?? realRabbit;

  useFrame(({ clock }) => {
    const elapsed = (Date.now() - state.startedAt) / 1000;
    if (spotRef.current) {
      // Le projecteur balaie puis se fixe (3 s de suspense).
      const sweep = Math.max(0, 1 - elapsed / 3);
      spotRef.current.position.x = Math.sin(clock.elapsedTime * 4) * 2 * sweep;
    }
    if (maskRef.current) {
      // Le masque tombe après le suspense.
      const fall = Math.max(0, elapsed - 3);
      maskRef.current.position.y = Math.max(1.6 - fall * 1.2, 0.45);
      maskRef.current.rotation.z = Math.min(fall * 0.8, 1.4);
    }
  });

  return (
    <group>
      {/* projecteur */}
      <group ref={spotRef} position={[0, 0.4, 2.4]}>
        <spotLight
          position={[0, 5, 0]}
          angle={0.35}
          penumbra={0.4}
          intensity={60}
          color="#FFF3CF"
          target-position={[0, 0, 0]}
        />
        {star && (
          <Rabbit
            avatarSeed={star.avatarSeed}
            name={star.name}
            equipped={star.equipped}
            position={[0, 0, 0]}
            frozen
            scale={1.1}
          />
        )}
        {/* le masque qui tombe */}
        <group ref={maskRef} position={[0, 1.6, 0.35]}>
          <mesh>
            <sphereGeometry args={[0.18, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshToonMaterial color="#52465E" />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.07, 0.06, 0.12]}>
              <circleGeometry args={[0.035, 8]} />
              <meshToonMaterial color="#FFFDF8" />
            </mesh>
          ))}
        </group>
      </group>
      <Confetti seed={42} gray={state.result === "draw"} />
    </group>
  );
}
