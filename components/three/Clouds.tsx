"use client";

/**
 * Nuages kawaii flottant au-dessus de l'île : amas de sphères blanches
 * (meshToonMaterial), dérive lente seedée, petit visage souriant sur le
 * nuage le plus proche. 100% procédural, aucun asset.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { mulberry32, toSeed32 } from "@/lib/prng";

function Puff({ face = false }: { face?: boolean }) {
  // Un nuage = 4-5 sphères agglutinées + (option) deux yeux et des joues.
  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.5, 14, 14]} />
        <meshToonMaterial color="#FFFFFF" />
      </mesh>
      <mesh position={[0.5, -0.05, 0]}>
        <sphereGeometry args={[0.38, 14, 14]} />
        <meshToonMaterial color="#FFFFFF" />
      </mesh>
      <mesh position={[-0.5, -0.05, 0.05]}>
        <sphereGeometry args={[0.36, 14, 14]} />
        <meshToonMaterial color="#FBFCFF" />
      </mesh>
      <mesh position={[0.18, 0.22, -0.05]}>
        <sphereGeometry args={[0.32, 14, 14]} />
        <meshToonMaterial color="#FFFFFF" />
      </mesh>
      <mesh position={[-0.18, 0.18, 0.05]}>
        <sphereGeometry args={[0.3, 14, 14]} />
        <meshToonMaterial color="#F4F8FF" />
      </mesh>
      {face && (
        <group position={[0, 0.02, 0.42]}>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.16, 0.04, 0]}>
              <sphereGeometry args={[0.035, 8, 8]} />
              <meshToonMaterial color="#3A3340" />
            </mesh>
          ))}
          {[-1, 1].map((s) => (
            <mesh key={`c${s}`} position={[s * 0.26, -0.06, 0]} scale={[1, 0.7, 0.3]}>
              <sphereGeometry args={[0.05, 10, 10]} />
              <meshToonMaterial color="#F9C6D0" transparent opacity={0.85} />
            </mesh>
          ))}
          <mesh position={[0, -0.06, 0.02]} rotation={[0, 0, 0]}>
            <torusGeometry args={[0.05, 0.012, 8, 12, Math.PI]} />
            <meshToonMaterial color="#3A3340" />
          </mesh>
        </group>
      )}
    </group>
  );
}

export function Clouds({ seed = "clouds", count = 5 }: { seed?: number | string; count?: number }) {
  const group = useRef<Group>(null);
  const clouds = useMemo(() => {
    const rng = mulberry32(toSeed32(seed) ^ 0xc10d);
    return Array.from({ length: count }).map((_, i) => ({
      angle: rng() * Math.PI * 2,
      radius: 4.2 + rng() * 2.4,
      height: 3.4 + rng() * 1.6,
      scale: 0.7 + rng() * 0.8,
      drift: 0.02 + rng() * 0.04,
      bob: rng() * Math.PI * 2,
      face: i === 0, // un seul nuage a un visage, pour ne pas surcharger
    }));
  }, [seed, count]);

  useFrame(({ clock }) => {
    if (group.current) group.current.rotation.y = clock.elapsedTime * 0.015;
  });

  return (
    <group ref={group}>
      {clouds.map((c, i) => (
        <CloudInstance key={i} {...c} />
      ))}
    </group>
  );
}

function CloudInstance(props: {
  angle: number;
  radius: number;
  height: number;
  scale: number;
  drift: number;
  bob: number;
  face: boolean;
}) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = props.height + Math.sin(clock.elapsedTime * 0.4 + props.bob) * 0.18;
    }
  });
  return (
    <group
      ref={ref}
      position={[Math.cos(props.angle) * props.radius, props.height, Math.sin(props.angle) * props.radius]}
      scale={[props.scale, props.scale, props.scale]}
    >
      <Puff face={props.face} />
    </group>
  );
}
