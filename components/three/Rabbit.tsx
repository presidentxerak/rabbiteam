"use client";

/**
 * Lapin procédural : 100% primitives R3F, dérivé d'avatar_seed via
 * deriveRabbit (calculé dans le navigateur, jamais stocké).
 * Déambulation lente seedée (pas de physique), nom au survol.
 */
import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { Group } from "three";
import { deriveRabbit, type EyeStyle, type RabbitTraits } from "@/lib/rabbit-traits";
import { mulberry32, toSeed32 } from "@/lib/prng";
import { EquippedItems } from "./items/EquippedItems";

export interface RabbitProps {
  avatarSeed: number | string;
  name?: string;
  equipped?: Record<string, string>;
  /** Position de base sur l'île ; le lapin déambule autour. */
  position?: [number, number, number];
  wander?: boolean;
  /** Mise en scène (vote/cérémonie) : fige le lapin face caméra. */
  frozen?: boolean;
  scale?: number;
  /** Override l'expression (yeux) sans changer le reste du lapin - pour le hero animé. */
  expression?: EyeStyle;
  /** Si fourni, le lapin devient cliquable (curseur main) → ouvre son chat. */
  onSelect?: () => void;
}

function Ear({ traits, side }: { traits: RabbitTraits; side: 1 | -1 }) {
  const { earStyle, bodyColor, earInner } = traits;
  // Oreilles réduites de moitié pour un look plus rond et mignon.
  const h = earStyle === "giant" ? 0.42 : earStyle === "short" ? 0.16 : 0.3;
  let rotZ = side * 0.15;
  if (earStyle === "lop") rotZ = side * 1.15;
  if (earStyle === "one_folded" && side === 1) rotZ = 1.3;
  if (earStyle === "twisted") rotZ = side * 0.45;
  return (
    <group position={[side * 0.16, 0.66, 0]} rotation={[0, 0, rotZ]}>
      <mesh position={[0, h / 2, 0]}>
        <capsuleGeometry args={[0.09, h, 6, 12]} />
        <meshToonMaterial color={bodyColor} />
      </mesh>
      <mesh position={[0, h / 2, 0.055]} scale={[0.55, 0.8, 0.5]}>
        <capsuleGeometry args={[0.09, h, 6, 12]} />
        <meshToonMaterial color={earInner} />
      </mesh>
    </group>
  );
}

function Eyes({ traits }: { traits: RabbitTraits }) {
  const closed = traits.eyeStyle === "sleepy" || traits.eyeStyle === "happy";
  return (
    <group position={[0, 0.42, 0.31]}>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.14, 0, 0]}>
          {closed ? (
            <mesh rotation={[0, 0, traits.eyeStyle === "happy" ? Math.PI : 0]} position={[0, 0, 0.02]}>
              <torusGeometry args={[0.045, 0.012, 8, 12, Math.PI]} />
              <meshToonMaterial color="#3A3340" />
            </mesh>
          ) : (
            <mesh>
              <sphereGeometry args={[0.045, 12, 12]} />
              <meshToonMaterial color={traits.eyeStyle === "hypno" ? "#7A6F86" : "#3A3340"} />
            </mesh>
          )}
          {traits.eyeStyle === "sparkly" && (
            <mesh position={[0.018, 0.018, 0.035]}>
              <sphereGeometry args={[0.015, 8, 8]} />
              <meshToonMaterial color="#FFFFFF" />
            </mesh>
          )}
          {traits.eyeStyle === "star" && (
            <mesh position={[0, 0, 0.03]} rotation={[0, 0, 0.4]}>
              <boxGeometry args={[0.07, 0.018, 0.01]} />
              <meshToonMaterial color="#F2C14E" />
            </mesh>
          )}
        </group>
      ))}
      {traits.eyeStyle === "monocle_wink" && (
        <mesh position={[0.14, 0, 0.04]}>
          <torusGeometry args={[0.07, 0.012, 8, 20]} />
          <meshToonMaterial color="#C9A227" />
        </mesh>
      )}
    </group>
  );
}

export function Rabbit({
  avatarSeed,
  name,
  equipped = {},
  position = [0, 0, 0],
  wander = false,
  frozen = false,
  scale = 1,
  expression,
  onSelect,
}: RabbitProps) {
  const baseTraits = useMemo(() => deriveRabbit(avatarSeed), [avatarSeed]);
  const traits = useMemo<RabbitTraits>(
    () => (expression ? { ...baseTraits, eyeStyle: expression } : baseTraits),
    [baseTraits, expression],
  );
  const group = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);
  // Paramètres de déambulation propres à ce lapin (seedés, stables).
  const walk = useMemo(() => {
    const rng = mulberry32(toSeed32(avatarSeed) ^ 0x5eed);
    return {
      speed: 0.08 + rng() * 0.1,
      radius: 0.35 + rng() * 0.5,
      phase: rng() * Math.PI * 2,
      hop: 1.6 + rng() * 1.2,
    };
  }, [avatarSeed]);

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.elapsedTime;
    if (wander && !frozen) {
      const a = walk.phase + t * walk.speed;
      group.current.position.x = position[0] + Math.cos(a) * walk.radius;
      group.current.position.z = position[2] + Math.sin(a * 0.8) * walk.radius;
      group.current.rotation.y = -a + Math.PI / 2;
      group.current.position.y = position[1] + Math.abs(Math.sin(t * walk.hop)) * 0.06;
    } else {
      group.current.position.set(...position);
      if (frozen) group.current.rotation.y = 0;
    }
  });

  const s = scale * traits.sizeJitter;
  return (
    <group
      ref={group}
      position={position}
      scale={[s, s, s]}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        if (onSelect) document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        if (onSelect) document.body.style.cursor = "auto";
      }}
      onClick={
        onSelect
          ? (e) => {
              e.stopPropagation();
              onSelect();
            }
          : undefined
      }
    >
      {/* corps */}
      <mesh position={[0, 0.22, 0]}>
        <sphereGeometry args={[0.3, 20, 20]} />
        <meshToonMaterial color={traits.bodyColor} />
      </mesh>
      <mesh position={[0, 0.18, 0.16]} scale={[0.7, 0.75, 0.5]}>
        <sphereGeometry args={[0.3, 20, 20]} />
        <meshToonMaterial color={traits.bellyColor} />
      </mesh>
      {/* tête */}
      <mesh position={[0, 0.5, 0.02]}>
        <sphereGeometry args={[0.26, 20, 20]} />
        <meshToonMaterial color={traits.bodyColor} />
      </mesh>
      <Ear traits={traits} side={-1} />
      <Ear traits={traits} side={1} />
      <Eyes traits={traits} />
      {/* museau */}
      <mesh position={[0, 0.36, 0.27]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshToonMaterial color="#E8A0A8" />
      </mesh>
      {/* joues */}
      {traits.cheeks !== "none" && (
        <group position={[0, 0.4, 0.24]}>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.16, 0, 0]} scale={[1, 0.7, 0.4]}>
              <sphereGeometry args={[traits.cheeks === "freckles" ? 0.025 : 0.045, 10, 10]} />
              <meshToonMaterial
                color={traits.cheeks === "peach" ? "#FFD9B8" : "#F9C6D0"}
                transparent
                opacity={0.85}
              />
            </mesh>
          ))}
        </group>
      )}
      {/* queue */}
      <mesh position={[0, 0.2, -0.27]}>
        <sphereGeometry
          args={[traits.tailStyle === "tiny" ? 0.05 : 0.09, 10, 10]}
        />
        <meshToonMaterial
          color={traits.tailStyle === "heart" ? "#F9C6D0" : traits.bellyColor}
        />
      </mesh>
      {/* pattes */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.13, 0.02, 0.1]} scale={[1, 0.5, 1.4]}>
          <sphereGeometry args={[0.09, 10, 10]} />
          <meshToonMaterial color={traits.bodyColor} />
        </mesh>
      ))}
      <EquippedItems equipped={equipped} />
      {name && hovered && (
        <Html position={[0, 1.15, 0]} center distanceFactor={8}>
          <div
            style={{
              background: "rgba(58,51,64,0.85)",
              color: "#FFFDF8",
              padding: "3px 11px",
              borderRadius: 12,
              fontSize: 13,
              whiteSpace: "nowrap",
              fontFamily: "sans-serif",
              textAlign: "center",
            }}
          >
            {name}
            {onSelect && <div style={{ fontSize: 10, opacity: 0.8 }}>click to chat</div>}
          </div>
        </Html>
      )}
    </group>
  );
}
