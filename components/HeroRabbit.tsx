"use client";

/**
 * En-tête de landing : « Rabbiteam » en VRAIE 3D (Text3D extrudé + biseau,
 * une lettre = une couleur pastel, vague de rebond) + la mascotte qui
 * salue et change d'expression. Police helvetiker_bold (64 Ko, latin).
 */
import dynamic from "next/dynamic";
import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Center, Text3D } from "@react-three/drei";
import type { Group } from "three";
import type { EyeStyle } from "@/lib/rabbit-traits";

const Rabbit = dynamic(() => import("@/components/three/Rabbit").then((m) => m.Rabbit), {
  ssr: false,
});

const FONT = "/fonts/helvetiker_bold.typeface.json";

// Une couleur joyeuse par lettre, cycle pastel saturé.
const LETTER_COLORS = [
  "#FF6B57", // R corail vif
  "#FFB347", // a mangue
  "#FFD93D", // b soleil
  "#6BCB77", // b menthe
  "#4D96FF", // i ciel
  "#9B5DE5", // t violet
  "#F15BB5", // e rose bonbon
  "#FF6B57", // a corail
  "#00C2A8", // m turquoise
];

const LETTERS = "Rabbiteam".split("");
// Largeurs approchées des glyphes helvetiker bold (taille 1) pour le kerning.
const WIDTHS: Record<string, number> = {
  R: 0.72, a: 0.56, b: 0.6, i: 0.27, t: 0.36, e: 0.56, m: 0.88,
};

function Title3D() {
  const group = useRef<Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (!group.current) return;
    group.current.children.forEach((letter, i) => {
      // Vague de rebond + petite torsion, déphasée lettre par lettre.
      letter.position.y = Math.abs(Math.sin(t * 2 + i * 0.45)) * 0.12;
      letter.rotation.z = Math.sin(t * 1.5 + i * 0.45) * 0.06;
    });
  });

  let x = 0;
  const positions = LETTERS.map((ch) => {
    const w = WIDTHS[ch] ?? 0.6;
    const pos = x;
    x += w + 0.06;
    return pos;
  });
  const total = x - 0.06;

  return (
    <Center top position={[0, 1.35, 0]}>
      <group ref={group} position={[-total / 2, 0, 0]} scale={[0.62, 0.62, 0.62]}>
        {LETTERS.map((ch, i) => (
          <group key={i} position={[positions[i] ?? 0, 0, 0]}>
            <Text3D
              font={FONT}
              size={1}
              height={0.34}
              bevelEnabled
              bevelThickness={0.05}
              bevelSize={0.035}
              bevelSegments={4}
              curveSegments={10}
            >
              {ch}
              <meshToonMaterial color={LETTER_COLORS[i % LETTER_COLORS.length]} />
            </Text3D>
          </group>
        ))}
      </group>
    </Center>
  );
}

// Expressions joyeuses uniquement (pas d'hypno ni de monocle pour la mascotte).
const EXPRESSIONS: EyeStyle[] = ["round", "happy", "sparkly", "star", "happy"];

function WavingRabbit() {
  const group = useRef<Group>(null);
  const [expr, setExpr] = useState<EyeStyle>("round");

  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i = (i + 1) % EXPRESSIONS.length;
      setExpr(EXPRESSIONS[i] ?? "happy");
    }, 1400);
    return () => clearInterval(id);
  }, []);

  useFrame(({ clock }) => {
    if (group.current) {
      const t = clock.elapsedTime;
      group.current.rotation.y = Math.sin(t * 0.6) * 0.3;
      group.current.position.y = -0.55 + Math.abs(Math.sin(t * 1.8)) * 0.1;
    }
  });

  return (
    <group ref={group} position={[0, -0.55, 0]}>
      {/* mascot-82 : rose dragée, oreilles droites, joues roses (seed choisi) */}
      <Rabbit avatarSeed="mascot-82" scale={1.35} expression={expr} />
    </group>
  );
}

export default function HeroRabbit() {
  return (
    <div className="hero-rabbit">
      <div className="hero-rabbit-stage">
        <Canvas camera={{ position: [0, 0.9, 3.4], fov: 42 }} dpr={[1, 2]}>
          <ambientLight intensity={0.95} color="#FFF6E8" />
          <directionalLight position={[3, 5, 3]} intensity={1.5} color="#FFFDF2" />
          <directionalLight position={[-3, 2, -2]} intensity={0.4} color="#C8E6F5" />
          <Suspense fallback={null}>
            <Title3D />
            <WavingRabbit />
          </Suspense>
        </Canvas>
      </div>
    </div>
  );
}
