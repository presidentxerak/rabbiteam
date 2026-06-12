"use client";

/**
 * Décorations événementielles de l'île (fleurs, lanternes, coquillages,
 * monuments…). Instancing pour les fleurs/coquillages au-delà de 50
 * occurrences ; cap géré en amont par island-builder (massifs).
 */
import { useLayoutEffect, useMemo, useRef } from "react";
import { Color, Object3D, type InstancedMesh } from "three";
import type { Decoration } from "@/lib/island-builder";

export const ISLAND_RADIUS = 3.4;

export function decorationPosition(d: Decoration): [number, number, number] {
  const r = d.radius * (ISLAND_RADIUS - 0.6) + 1.3; // entre la maison et l'eau
  return [Math.cos(d.angle) * r, 0.2, Math.sin(d.angle) * r];
}

const FLOWER_COLORS = ["#F6C6D8", "#FFF3CF", "#D9C7F2", "#F2A9A0"];

function InstancedSpheres({
  decorations,
  baseColor,
  radius,
  y,
}: {
  decorations: Decoration[];
  baseColor: string;
  radius: number;
  y: number;
}) {
  const ref = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const color = new Color();
    decorations.forEach((d, i) => {
      const [x, , z] = decorationPosition(d);
      dummy.position.set(x, y, z);
      dummy.scale.setScalar(d.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      color.set(baseColor).offsetHSL(d.hueShift, 0, 0);
      mesh.setColorAt(i, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [decorations, baseColor, dummy, y]);
  if (decorations.length === 0) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, decorations.length]}>
      <sphereGeometry args={[radius, 8, 8]} />
      <meshToonMaterial />
    </instancedMesh>
  );
}

function Flower({ d }: { d: Decoration }) {
  const pos = decorationPosition(d);
  const color = FLOWER_COLORS[Math.floor(((d.angle / (Math.PI * 2)) * 4) % 4)] ?? "#F6C6D8";
  return (
    <group position={pos} scale={[d.scale * 0.6, d.scale * 0.6, d.scale * 0.6]}>
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.16, 6]} />
        <meshToonMaterial color="#6FCB85" />
      </mesh>
      {Array.from({ length: 5 }).map((_, i) => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.045, 0.17, Math.sin(a) * 0.045]}>
            <sphereGeometry args={[0.035, 6, 6]} />
            <meshToonMaterial color={color} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.17, 0]}>
        <sphereGeometry args={[0.03, 6, 6]} />
        <meshToonMaterial color="#FFF3CF" />
      </mesh>
    </group>
  );
}

function Lantern({ d }: { d: Decoration }) {
  const pos = decorationPosition(d);
  return (
    <group position={pos} scale={[d.scale, d.scale, d.scale]}>
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.36, 6]} />
        <meshToonMaterial color="#B07A52" />
      </mesh>
      <mesh position={[0, 0.34, 0]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshToonMaterial color="#FFE9A0" emissive="#FFE9A0" emissiveIntensity={0.7} />
      </mesh>
    </group>
  );
}

function RabbitStatue({ d }: { d: Decoration }) {
  const pos = decorationPosition(d);
  return (
    <group position={pos} scale={[d.scale, d.scale, d.scale]}>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.18, 0.22, 0.12, 12]} />
        <meshToonMaterial color="#D8D3CB" />
      </mesh>
      <mesh position={[0, 0.24, 0]}>
        <sphereGeometry args={[0.13, 12, 12]} />
        <meshToonMaterial color="#C9C3BA" />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshToonMaterial color="#C9C3BA" />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.05, 0.56, 0]} rotation={[0, 0, s * 0.15]}>
          <capsuleGeometry args={[0.03, 0.16, 4, 8]} />
          <meshToonMaterial color="#C9C3BA" />
        </mesh>
      ))}
    </group>
  );
}

function MagnifierMonument({ d }: { d: Decoration }) {
  const pos = decorationPosition(d);
  return (
    <group position={pos} scale={[d.scale, d.scale, d.scale]} rotation={[0, d.angle, 0]}>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.16, 0.2, 0.1, 12]} />
        <meshToonMaterial color="#D8D3CB" />
      </mesh>
      <mesh position={[0, 0.45, 0]}>
        <torusGeometry args={[0.18, 0.035, 8, 20]} />
        <meshToonMaterial color="#C9A227" />
      </mesh>
      <mesh position={[0, 0.16, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.24, 8]} />
        <meshToonMaterial color="#C9A227" />
      </mesh>
    </group>
  );
}

function Sapling({ d }: { d: Decoration }) {
  const pos = decorationPosition(d);
  return (
    <group position={pos} scale={[d.scale * 0.7, d.scale * 0.7, d.scale * 0.7]}>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.02, 0.03, 0.2, 6]} />
        <meshToonMaterial color="#B07A52" />
      </mesh>
      <mesh position={[0, 0.26, 0]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshToonMaterial color="#7DD491" />
      </mesh>
    </group>
  );
}

function Massif({ d }: { d: Decoration }) {
  const pos = decorationPosition(d);
  return (
    <group position={pos} scale={[d.scale, d.scale, d.scale]}>
      {Array.from({ length: 5 }).map((_, i) => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.15, 0.08 + (i % 2) * 0.05, Math.sin(a) * 0.15]}>
            <sphereGeometry args={[0.12, 8, 8]} />
            <meshToonMaterial color={FLOWER_COLORS[i % 4]} />
          </mesh>
        );
      })}
    </group>
  );
}

export function Decorations({ decorations }: { decorations: Decoration[] }) {
  const flowers = decorations.filter((d) => d.kind === "flower");
  const shells = decorations.filter((d) => d.kind === "shell");
  const pebbles = decorations.filter((d) => d.kind === "pebble");
  // Instancing au-delà de 50 occurrences (perf mobile).
  const instanceFlowers = flowers.length > 50;
  const instanceShells = shells.length > 50;
  return (
    <group>
      {(instanceFlowers ? [] : flowers).map((d, i) => (
        <Flower key={`f${i}`} d={d} />
      ))}
      {instanceFlowers && (
        <InstancedSpheres decorations={flowers} baseColor="#F6C6D8" radius={0.06} y={0.25} />
      )}
      {(instanceShells ? [] : shells).map((d, i) => {
        const pos = decorationPosition(d);
        return (
          <mesh key={`s${i}`} position={pos} scale={[d.scale, d.scale * 0.5, d.scale]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshToonMaterial color="#FFFDF8" />
          </mesh>
        );
      })}
      {instanceShells && (
        <InstancedSpheres decorations={shells} baseColor="#FFFDF8" radius={0.05} y={0.22} />
      )}
      <InstancedSpheres decorations={pebbles} baseColor="#BFC9D9" radius={0.05} y={0.22} />
      {decorations.map((d, i) => {
        switch (d.kind) {
          case "lantern": return <Lantern key={i} d={d} />;
          case "rabbit_statue": return <RabbitStatue key={i} d={d} />;
          case "magnifier_monument": return <MagnifierMonument key={i} d={d} />;
          case "sapling": return <Sapling key={i} d={d} />;
          case "massif": return <Massif key={i} d={d} />;
          default: return null;
        }
      })}
    </group>
  );
}
