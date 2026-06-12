"use client";

/**
 * Compose toute l'île à partir de (seed, events[], islandItems, rabbits).
 * Léger flottement sinusoïdal du groupe entier. Socle sable sur disque
 * d'eau turquoise, maison centrale, végétation seedée, plage, croissance.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { buildIsland, type IslandEventLite } from "@/lib/island-builder";
import { House } from "./House";
import { Palm } from "./Palm";
import { Bush } from "./Bush";
import { Beach } from "./Beach";
import { Decorations, ISLAND_RADIUS } from "./Decorations";
import { Rabbit } from "./Rabbit";
import { RevealCeremony, type CeremonyState } from "./effects/RevealCeremony";

export interface IslandRabbit {
  playerId?: string;
  avatarSeed: number | string;
  name?: string;
  equipped?: Record<string, string>;
}

export interface IslandProps {
  seed: number | string;
  teamName: string;
  events: IslandEventLite[];
  islandItems?: string[];
  rabbits?: IslandRabbit[];
  ceremony?: CeremonyState | null;
  /** Lapins rassemblés devant la maison (fenêtre de vote). */
  gathered?: boolean;
}

function IslandItemMesh({ slug, index }: { slug: string; index: number }) {
  const a = 1.1 + index * 1.05;
  const pos: [number, number, number] = [Math.cos(a) * 2.6, 0.2, Math.sin(a) * 2.6];
  switch (slug) {
    case "campfire":
      return (
        <group position={pos}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[0, 0.04, 0]} rotation={[0.3, (i / 3) * Math.PI * 2, 1.3]}>
              <cylinderGeometry args={[0.03, 0.03, 0.3, 6]} />
              <meshToonMaterial color="#6B4F3A" />
            </mesh>
          ))}
          <mesh position={[0, 0.14, 0]}>
            <coneGeometry args={[0.08, 0.2, 8]} />
            <meshToonMaterial color="#FF8C42" emissive="#FF8C42" emissiveIntensity={0.8} />
          </mesh>
        </group>
      );
    case "giant_buoy":
      return (
        <mesh position={[pos[0] * 1.5, 0.05, pos[2] * 1.5]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.35, 0.12, 10, 20]} />
          <meshToonMaterial color="#FF8C7A" />
        </mesh>
      );
    case "hammock":
      return (
        <group position={pos}>
          {[-0.5, 0.5].map((x) => (
            <mesh key={x} position={[x, 0.25, 0]}>
              <cylinderGeometry args={[0.03, 0.04, 0.5, 8]} />
              <meshToonMaterial color="#B07A52" />
            </mesh>
          ))}
          <mesh position={[0, 0.32, 0]} rotation={[0, 0, 0]} scale={[1, 0.25, 1]}>
            <sphereGeometry args={[0.5, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
            <meshToonMaterial color="#CDEBD3" side={2} />
          </mesh>
        </group>
      );
    case "pontoon":
      return (
        <group position={[pos[0] * 1.25, 0.12, pos[2] * 1.25]} rotation={[0, -a, 0]}>
          <mesh>
            <boxGeometry args={[1.6, 0.06, 0.5]} />
            <meshToonMaterial color="#D9B98A" />
          </mesh>
          {[-0.6, 0.6].map((x) =>
            [-0.18, 0.18].map((z) => (
              <mesh key={`${x}${z}`} position={[x, -0.15, z]}>
                <cylinderGeometry args={[0.04, 0.04, 0.3, 8]} />
                <meshToonMaterial color="#B07A52" />
              </mesh>
            )),
          )}
        </group>
      );
    case "mini_lighthouse":
      return (
        <group position={[pos[0] * 1.15, 0.2, pos[2] * 1.15]}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[0, 0.15 + i * 0.3, 0]}>
              <cylinderGeometry args={[0.16 - i * 0.03, 0.19 - i * 0.03, 0.3, 12]} />
              <meshToonMaterial color={i % 2 ? "#FFFDF8" : "#FF8C7A"} />
            </mesh>
          ))}
          <mesh position={[0, 1.02, 0]}>
            <sphereGeometry args={[0.09, 10, 10]} />
            <meshToonMaterial color="#FFE9A0" emissive="#FFE9A0" emissiveIntensity={1} />
          </mesh>
          <mesh position={[0, 1.14, 0]}>
            <coneGeometry args={[0.12, 0.12, 10]} />
            <meshToonMaterial color="#E2574C" />
          </mesh>
        </group>
      );
    case "golden_palm":
      return (
        <group position={[pos[0] * 0.9, 0.2, pos[2] * 0.9]}>
          <Palm lean={0.18} height={1.9} golden />
        </group>
      );
    case "beach_swing":
      return (
        <group position={pos}>
          <mesh position={[0, 0.5, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.03, 0.03, 0.8, 8]} />
            <meshToonMaterial color="#B07A52" />
          </mesh>
          {[-0.25, 0.25].map((x) => (
            <mesh key={x} position={[x, 0.35, 0]}>
              <cylinderGeometry args={[0.01, 0.01, 0.3, 6]} />
              <meshToonMaterial color="#EBD8C3" />
            </mesh>
          ))}
          <mesh position={[0, 0.2, 0]}>
            <boxGeometry args={[0.55, 0.03, 0.18]} />
            <meshToonMaterial color="#F5E0B7" />
          </mesh>
          {[-0.55, 0.55].map((x) => (
            <mesh key={x} position={[x, 0.25, 0]} rotation={[0, 0, x > 0 ? -0.15 : 0.15]}>
              <cylinderGeometry args={[0.035, 0.045, 0.55, 8]} />
              <meshToonMaterial color="#B07A52" />
            </mesh>
          ))}
        </group>
      );
    default:
      return null;
  }
}

export function Island({
  seed,
  teamName,
  events,
  islandItems = [],
  rabbits = [],
  ceremony = null,
  gathered = false,
}: IslandProps) {
  const scene = useMemo(() => buildIsland(seed, events, islandItems), [seed, events, islandItems]);
  const group = useRef<Group>(null);

  // Flottement sinusoïdal doux du groupe entier.
  useFrame(({ clock }) => {
    if (group.current) {
      group.current.position.y = Math.sin(clock.elapsedTime * 0.5) * 0.05;
      group.current.rotation.z = Math.sin(clock.elapsedTime * 0.3) * 0.008;
    }
  });

  const hasGarland = islandItems.includes("house_garland");

  return (
    <group ref={group}>
      {/* eau turquoise */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]}>
        <circleGeometry args={[9, 48]} />
        <meshToonMaterial color="#7ED6DF" />
      </mesh>
      {/* socle sable */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[ISLAND_RADIUS, ISLAND_RADIUS + 0.5, 0.4, 36]} />
        <meshToonMaterial color="#F5E0B7" />
      </mesh>
      {/* herbe centrale */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.201, 0]}>
        <circleGeometry args={[2.3, 32]} />
        <meshToonMaterial color="#A8E0A0" />
      </mesh>

      <group position={[0, 0.2, 0]}>
        <House teamName={teamName} garland={hasGarland} />
      </group>

      {scene.palms.map((p, i) => {
        const r = p.radius * (ISLAND_RADIUS - 0.8) + 1.4;
        return (
          <group
            key={`palm${i}`}
            position={[Math.cos(p.angle) * r, 0.2, Math.sin(p.angle) * r]}
            rotation={[0, p.angle, 0]}
          >
            <Palm lean={p.lean} height={p.height} />
          </group>
        );
      })}
      {scene.bushes.map((b, i) => {
        const r = b.radius * (ISLAND_RADIUS - 0.9) + 1.3;
        return (
          <group key={`bush${i}`} position={[Math.cos(b.angle) * r, 0.2, Math.sin(b.angle) * r]}>
            <Bush scale={b.scale} />
          </group>
        );
      })}

      <Beach />
      <Decorations decorations={scene.decorations} />
      {scene.islandItems.map((slug, i) => (
        <IslandItemMesh key={slug} slug={slug} index={i} />
      ))}

      {/* lapins des membres : promenade, ou rassemblement devant la maison */}
      {rabbits.map((r, i) => {
        const n = Math.max(rabbits.length, 1);
        const a = (i / n) * Math.PI * 2;
        const pos: [number, number, number] = gathered
          ? [Math.cos(a) * 1.9, 0.4, Math.abs(Math.sin(a)) * 0.9 + 1.7]
          : [Math.cos(a) * 2.2, 0.4, Math.sin(a) * 2.2];
        return (
          <Rabbit
            key={r.playerId ?? i}
            avatarSeed={r.avatarSeed}
            name={r.name}
            equipped={r.equipped}
            position={pos}
            wander={!gathered}
            frozen={gathered}
            scale={0.85}
          />
        );
      })}

      {ceremony && <RevealCeremony state={ceremony} rabbits={rabbits} />}
    </group>
  );
}
