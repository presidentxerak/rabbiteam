"use client";

/**
 * Nuages kawaii flottant au-dessus de l'île : gros amas dodus de sphères
 * BLANC PUR (légèrement émissifs pour rester lumineux sous le toon shading),
 * base aplatie façon dessin animé, dérive lente seedée. Le nuage le plus
 * proche a un visage souriant et des joues roses. 100% procédural.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { mulberry32, toSeed32 } from "@/lib/prng";

const CLOUD_WHITE = "#FFFFFF";

function CloudMat() {
  // Émissif doux : le toon shading ne peut pas griser le nuage.
  return <meshToonMaterial color={CLOUD_WHITE} emissive={CLOUD_WHITE} emissiveIntensity={0.35} />;
}

function Puff({ face = false }: { face?: boolean }) {
  // Silhouette cartoon : une rangée de bosses rondes + base aplatie.
  const bumps: [number, number, number, number][] = [
    // [x, y, z, rayon]
    [0, 0.18, 0, 0.52],
    [0.52, 0.05, 0.04, 0.42],
    [-0.52, 0.04, -0.03, 0.4],
    [0.26, 0.32, -0.06, 0.36],
    [-0.27, 0.3, 0.05, 0.34],
    [0.88, -0.06, 0, 0.28],
    [-0.86, -0.07, 0, 0.26],
  ];
  return (
    <group>
      {bumps.map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]}>
          <sphereGeometry args={[r, 16, 16]} />
          <CloudMat />
        </mesh>
      ))}
      {/* base aplatie façon nuage de dessin animé */}
      <mesh position={[0, -0.12, 0]} scale={[1, 0.32, 0.8]}>
        <sphereGeometry args={[0.95, 16, 16]} />
        <CloudMat />
      </mesh>
      {face && (
        <group position={[0, 0.12, 0.52]}>
          {/* yeux fermés heureux ^^ */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.2, 0.06, 0]} rotation={[0, 0, Math.PI]}>
              <torusGeometry args={[0.07, 0.018, 8, 12, Math.PI]} />
              <meshToonMaterial color="#3A3340" />
            </mesh>
          ))}
          {/* joues roses bien visibles */}
          {[-1, 1].map((s) => (
            <mesh key={`c${s}`} position={[s * 0.34, -0.08, 0]} scale={[1, 0.75, 0.35]}>
              <sphereGeometry args={[0.09, 12, 12]} />
              <meshToonMaterial color="#FF9EB5" />
            </mesh>
          ))}
          {/* petit sourire */}
          <mesh position={[0, -0.06, 0.03]}>
            <torusGeometry args={[0.07, 0.018, 8, 12, Math.PI]} />
            <meshToonMaterial color="#3A3340" />
          </mesh>
        </group>
      )}
    </group>
  );
}

export function Clouds({ seed = "clouds", count = 6 }: { seed?: number | string; count?: number }) {
  const group = useRef<Group>(null);
  const clouds = useMemo(() => {
    const rng = mulberry32(toSeed32(seed) ^ 0xc10d);
    return Array.from({ length: count }).map((_, i) => ({
      angle: (i / count) * Math.PI * 2 + rng() * 0.8,
      radius: 3.6 + rng() * 2.6,
      height: 3.2 + rng() * 1.8,
      scale: 0.8 + rng() * 0.9,
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
      rotation={[0, -props.angle + Math.PI / 2, 0]}
      scale={[props.scale, props.scale, props.scale]}
    >
      <Puff face={props.face} />
    </group>
  );
}
