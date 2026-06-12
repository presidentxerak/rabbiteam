"use client";

/**
 * Un composant par slot d'item. La géométrie est construite depuis le slug
 * (les params de couleur viennent du catalogue, dupliqués ici côté rendu
 * pour éviter un aller-retour DB sur chaque lapin).
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { ITEMS_CATALOG } from "@/lib/items-catalog";

function params(slug: string): Record<string, unknown> {
  return ITEMS_CATALOG.find((i) => i.slug === slug)?.params ?? {};
}
const str = (p: Record<string, unknown>, k: string, fallback: string): string =>
  typeof p[k] === "string" ? (p[k] as string) : fallback;

// ============ HEAD ============

function HeadItem({ slug }: { slug: string }) {
  const p = params(slug);
  const color = str(p, "color", "#F5E0B7");
  const shape = str(p, "shape", "bucket");
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (shape === "propeller" && ref.current) {
      const blades = ref.current.getObjectByName("propeller_blades");
      if (blades) blades.rotation.y = clock.elapsedTime * 6;
    }
    if (shape === "halo" && ref.current) {
      ref.current.position.y = 0.95 + Math.sin(clock.elapsedTime * 2) * 0.03;
    }
  });

  switch (shape) {
    case "cone":
      return (
        <mesh position={[0, 0.82, 0]}>
          <coneGeometry args={[0.13, 0.3, 16]} />
          <meshToonMaterial color={color} />
        </mesh>
      );
    case "beret":
      return (
        <mesh position={[0.05, 0.72, 0]} rotation={[0, 0, -0.2]} scale={[1, 0.35, 1]}>
          <sphereGeometry args={[0.2, 16, 12]} />
          <meshToonMaterial color={color} />
        </mesh>
      );
    case "headphones":
      return (
        <group position={[0, 0.62, 0]}>
          <mesh rotation={[0, 0, 0]}>
            <torusGeometry args={[0.26, 0.03, 8, 24, Math.PI]} />
            <meshToonMaterial color={color} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.26, -0.05, 0]}>
              <sphereGeometry args={[0.08, 12, 12]} />
              <meshToonMaterial color={str(p, "pad", "#52465E")} />
            </mesh>
          ))}
        </group>
      );
    case "propeller":
      return (
        <group ref={ref} position={[0, 0.74, 0]}>
          <mesh scale={[1, 0.5, 1]}>
            <sphereGeometry args={[0.2, 16, 12]} />
            <meshToonMaterial color={color} />
          </mesh>
          <mesh position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 0.1, 8]} />
            <meshToonMaterial color="#7A6F86" />
          </mesh>
          <group name="propeller_blades" position={[0, 0.18, 0]}>
            <mesh>
              <boxGeometry args={[0.3, 0.015, 0.04]} />
              <meshToonMaterial color={str(p, "propeller", "#FF8C7A")} />
            </mesh>
            <mesh rotation={[0, Math.PI / 2, 0]}>
              <boxGeometry args={[0.3, 0.015, 0.04]} />
              <meshToonMaterial color={str(p, "propeller", "#FF8C7A")} />
            </mesh>
          </group>
        </group>
      );
    case "flower_crown": {
      const colors = (p.colors as string[] | undefined) ?? ["#F6C6D8"];
      return (
        <group position={[0, 0.7, 0]}>
          {Array.from({ length: 8 }).map((_, i) => {
            const a = (i / 8) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(a) * 0.22, 0, Math.sin(a) * 0.22]}>
                <sphereGeometry args={[0.045, 8, 8]} />
                <meshToonMaterial color={colors[i % colors.length]} />
              </mesh>
            );
          })}
        </group>
      );
    }
    case "crown":
      return (
        <group position={[0, 0.78, 0]}>
          <mesh>
            <cylinderGeometry args={[0.16, 0.18, 0.12, 12]} />
            <meshToonMaterial color={color} />
          </mesh>
          {Array.from({ length: 5 }).map((_, i) => {
            const a = (i / 5) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(a) * 0.16, 0.1, Math.sin(a) * 0.16]}>
                <coneGeometry args={[0.03, 0.08, 6]} />
                <meshToonMaterial color={color} />
              </mesh>
            );
          })}
        </group>
      );
    case "halo":
      return (
        <group ref={ref} position={[0, 0.95, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.18, 0.025, 8, 24]} />
            <meshToonMaterial color={color} emissive={color} emissiveIntensity={0.6} />
          </mesh>
        </group>
      );
    default: // bucket hat
      return (
        <group position={[0, 0.72, 0]}>
          <mesh>
            <cylinderGeometry args={[0.18, 0.15, 0.14, 16]} />
            <meshToonMaterial color={color} />
          </mesh>
          <mesh position={[0, -0.06, 0]}>
            <cylinderGeometry args={[0.26, 0.26, 0.02, 16]} />
            <meshToonMaterial color={str(p, "band", color)} />
          </mesh>
        </group>
      );
  }
}

// ============ FACE ============

function FaceItem({ slug }: { slug: string }) {
  const p = params(slug);
  const color = str(p, "color", "#52465E");
  const shape = str(p, "shape", "round");
  if (shape === "patch") {
    return (
      <mesh position={[0.14, 0.42, 0.32]} rotation={[0.1, 0, 0]}>
        <circleGeometry args={[0.07, 12]} />
        <meshToonMaterial color={color} />
      </mesh>
    );
  }
  if (shape === "monocle") {
    return (
      <mesh position={[0.14, 0.42, 0.33]}>
        <torusGeometry args={[0.07, 0.012, 8, 20]} />
        <meshToonMaterial color={color} />
      </mesh>
    );
  }
  if (shape === "dive") {
    return (
      <group position={[0, 0.44, 0.3]}>
        <mesh scale={[1.6, 1, 0.5]}>
          <torusGeometry args={[0.13, 0.025, 8, 20]} />
          <meshToonMaterial color={color} />
        </mesh>
        <mesh scale={[1.6, 1, 0.2]} position={[0, 0, 0.01]}>
          <circleGeometry args={[0.13, 20]} />
          <meshToonMaterial color="#C8E6F5" transparent opacity={0.5} />
        </mesh>
      </group>
    );
  }
  // round / square / heart : deux verres + pont
  const lens =
    shape === "heart" ? (
      <sphereGeometry args={[0.06, 8, 8]} />
    ) : shape === "square" ? (
      <boxGeometry args={[0.11, 0.09, 0.02]} />
    ) : (
      <torusGeometry args={[0.06, 0.012, 8, 16]} />
    );
  return (
    <group position={[0, 0.42, 0.32]}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.14, 0, 0]} scale={shape === "heart" ? [1, 0.9, 0.3] : [1, 1, 1]}>
          {lens}
          <meshToonMaterial color={color} transparent={shape !== "round"} opacity={shape === "round" ? 1 : 0.85} />
        </mesh>
      ))}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.008, 0.008, 0.1, 6]} />
        <meshToonMaterial color={color} />
      </mesh>
    </group>
  );
}

// ============ NECK ============

function NeckItem({ slug }: { slug: string }) {
  const p = params(slug);
  const shape = str(p, "shape", "bow");
  switch (shape) {
    case "scarf": {
      const colors = (p.colors as string[] | undefined) ?? ["#C8E6F5"];
      return (
        <group position={[0, 0.3, 0.05]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.2, 0.05, 8, 20]} />
            <meshToonMaterial color={colors[0]} />
          </mesh>
          <mesh position={[0.12, -0.12, 0.18]} rotation={[0.3, 0, 0.2]}>
            <boxGeometry args={[0.08, 0.2, 0.03]} />
            <meshToonMaterial color={colors[1] ?? colors[0]} />
          </mesh>
        </group>
      );
    }
    case "lei": {
      const colors = (p.colors as string[] | undefined) ?? ["#F6C6D8"];
      return (
        <group position={[0, 0.28, 0.06]} rotation={[0.5, 0, 0]}>
          {Array.from({ length: 10 }).map((_, i) => {
            const a = (i / 10) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0]}>
                <sphereGeometry args={[0.04, 8, 8]} />
                <meshToonMaterial color={colors[i % colors.length]} />
              </mesh>
            );
          })}
        </group>
      );
    }
    case "pearls":
      return (
        <group position={[0, 0.3, 0.06]} rotation={[0.5, 0, 0]}>
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(a) * 0.18, Math.sin(a) * 0.18, 0]}>
                <sphereGeometry args={[0.025, 8, 8]} />
                <meshToonMaterial color={str(p, "color", "#FFFDF8")} />
              </mesh>
            );
          })}
        </group>
      );
    case "bell":
      return (
        <group position={[0, 0.3, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.19, 0.025, 8, 20]} />
            <meshToonMaterial color={str(p, "color", "#D9C7F2")} />
          </mesh>
          <mesh position={[0, -0.04, 0.19]}>
            <sphereGeometry args={[0.04, 10, 10]} />
            <meshToonMaterial color={str(p, "bell", "#F2C14E")} />
          </mesh>
        </group>
      );
    case "cape":
      return (
        <mesh position={[0, 0.18, -0.18]} rotation={[0.35, 0, 0]}>
          <coneGeometry args={[0.32, 0.55, 12, 1, true]} />
          <meshToonMaterial color={str(p, "color", "#B79BD9")} side={2} />
        </mesh>
      );
    default: // bow
      return (
        <group position={[0, 0.3, 0.22]}>
          <mesh position={[-0.06, 0, 0]} rotation={[0, 0, 0.5]}>
            <coneGeometry args={[0.05, 0.1, 4]} />
            <meshToonMaterial color={str(p, "color", "#FF8C7A")} />
          </mesh>
          <mesh position={[0.06, 0, 0]} rotation={[0, 0, -0.5]}>
            <coneGeometry args={[0.05, 0.1, 4]} />
            <meshToonMaterial color={str(p, "color", "#FF8C7A")} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.03, 8, 8]} />
            <meshToonMaterial color={str(p, "color", "#FF8C7A")} />
          </mesh>
        </group>
      );
  }
}

// ============ HAND ============

function HandItem({ slug }: { slug: string }) {
  const p = params(slug);
  const shape = str(p, "shape", "carrot");
  const pos: [number, number, number] = [0.28, 0.25, 0.14];
  switch (shape) {
    case "mug":
      return (
        <group position={pos}>
          <mesh>
            <cylinderGeometry args={[0.06, 0.05, 0.1, 12]} />
            <meshToonMaterial color={str(p, "color", "#FFFDF8")} />
          </mesh>
          <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.05, 12]} />
            <meshToonMaterial color={str(p, "drink", "#6B4F3A")} />
          </mesh>
        </group>
      );
    case "laptop":
      return (
        <group position={pos} rotation={[0, -0.4, 0]}>
          <mesh>
            <boxGeometry args={[0.16, 0.012, 0.11]} />
            <meshToonMaterial color={str(p, "color", "#BFC9D9")} />
          </mesh>
          <mesh position={[0, 0.05, -0.05]} rotation={[-0.5, 0, 0]}>
            <boxGeometry args={[0.16, 0.11, 0.008]} />
            <meshToonMaterial color={str(p, "screen", "#C8E6F5")} />
          </mesh>
        </group>
      );
    case "icecream":
      return (
        <group position={pos}>
          <mesh rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.045, 0.12, 10]} />
            <meshToonMaterial color={str(p, "cone", "#EBD8C3")} />
          </mesh>
          <mesh position={[0, 0.08, 0]}>
            <sphereGeometry args={[0.05, 10, 10]} />
            <meshToonMaterial color={str(p, "scoop", "#F6C6D8")} />
          </mesh>
        </group>
      );
    case "racket":
      return (
        <group position={pos} rotation={[0, 0, -0.4]}>
          <mesh position={[0, 0.1, 0]} scale={[1, 1.25, 0.25]}>
            <sphereGeometry args={[0.08, 12, 12]} />
            <meshToonMaterial color={str(p, "color", "#FF8C7A")} />
          </mesh>
          <mesh position={[0, -0.04, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 0.1, 8]} />
            <meshToonMaterial color={str(p, "grip", "#EBD8C3")} />
          </mesh>
        </group>
      );
    case "magnifier":
      return (
        <group position={pos} rotation={[0, 0, 0.4]}>
          <mesh position={[0, 0.08, 0]}>
            <torusGeometry args={[0.06, 0.012, 8, 20]} />
            <meshToonMaterial color={str(p, "color", "#F2C14E")} />
          </mesh>
          <mesh position={[0, -0.02, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.1, 8]} />
            <meshToonMaterial color={str(p, "color", "#F2C14E")} />
          </mesh>
        </group>
      );
    case "wand":
      return (
        <group position={pos} rotation={[0, 0, 0.3]}>
          <mesh>
            <cylinderGeometry args={[0.01, 0.01, 0.18, 8]} />
            <meshToonMaterial color={str(p, "color", "#D9C7F2")} />
          </mesh>
          <mesh position={[0, 0.12, 0]}>
            <torusGeometry args={[0.035, 0.008, 8, 16]} />
            <meshToonMaterial color={str(p, "bubbles", "#C8E6F5")} />
          </mesh>
        </group>
      );
    default: {
      // carrot (classique ou dorée)
      const glow = p.glow === true;
      return (
        <group position={pos} rotation={[0, 0, -0.6]}>
          <mesh rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.045, 0.16, 10]} />
            <meshToonMaterial
              color={str(p, "color", "#FF8C42")}
              {...(glow ? { emissive: str(p, "color", "#F2C14E"), emissiveIntensity: 0.5 } : {})}
            />
          </mesh>
          <mesh position={[0, 0.1, 0]}>
            <coneGeometry args={[0.025, 0.06, 6]} />
            <meshToonMaterial color={str(p, "leaf", "#7BC47F")} />
          </mesh>
        </group>
      );
    }
  }
}

// ============ AURA ============

function AuraItem({ slug }: { slug: string }) {
  const p = params(slug);
  const kind = str(p, "kind", "sparkles");
  const ref = useRef<Group>(null);
  const count = typeof p.count === "number" ? (p.count as number) : 8;
  const seedsPositions = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => {
        const a = (i / count) * Math.PI * 2;
        return [Math.cos(a) * 0.45, 0.35 + ((i * 37) % 50) / 100, Math.sin(a) * 0.45] as const;
      }),
    [count],
  );
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.elapsedTime * 0.4;
  });

  if (kind === "cloud") {
    return (
      <group position={[0, 1.05, 0]}>
        {[[-0.08, 0, 0], [0.08, 0, 0], [0, 0.05, 0]].map((pp, i) => (
          <mesh key={i} position={pp as [number, number, number]}>
            <sphereGeometry args={[0.08, 10, 10]} />
            <meshToonMaterial color={str(p, "color", "#BFC9D9")} />
          </mesh>
        ))}
        {[[-0.05, -0.12, 0], [0.06, -0.16, 0]].map((pp, i) => (
          <mesh key={i} position={pp as [number, number, number]}>
            <sphereGeometry args={[0.015, 6, 6]} />
            <meshToonMaterial color={str(p, "drops", "#7ED6DF")} />
          </mesh>
        ))}
      </group>
    );
  }
  if (kind === "rainbow") {
    const colors = (p.colors as string[] | undefined) ?? ["#F2A9A0"];
    return (
      <group position={[0, 0.6, -0.1]}>
        {colors.map((c, i) => (
          <mesh key={i} rotation={[0, 0, 0]}>
            <torusGeometry args={[0.5 + i * 0.05, 0.018, 8, 24, Math.PI]} />
            <meshToonMaterial color={c} transparent opacity={0.8} />
          </mesh>
        ))}
      </group>
    );
  }
  const color = str(p, "color", "#FFF3CF");
  return (
    <group ref={ref}>
      {seedsPositions.map((pp, i) => (
        <mesh key={i} position={pp as unknown as [number, number, number]}>
          {kind === "stars" ? (
            <octahedronGeometry args={[0.035]} />
          ) : (
            <sphereGeometry args={[kind === "petals" ? 0.03 : 0.02, 6, 6]} />
          )}
          <meshToonMaterial color={color} emissive={color} emissiveIntensity={kind === "fireflies" ? 0.8 : 0.3} />
        </mesh>
      ))}
    </group>
  );
}

export function EquippedItems({ equipped }: { equipped: Record<string, string> }) {
  return (
    <group>
      {equipped.head && <HeadItem slug={equipped.head} />}
      {equipped.face && <FaceItem slug={equipped.face} />}
      {equipped.neck && <NeckItem slug={equipped.neck} />}
      {equipped.hand && <HandItem slug={equipped.hand} />}
      {equipped.aura && <AuraItem slug={equipped.aura} />}
    </group>
  );
}
