"use client";

/**
 * En-tête de landing : la mascotte 3D qui salue et change d'expression,
 * puis « Rabbiteam » écrit en gros sous le lapin, dans la même typo dégradée
 * que les titres de section.
 */
import dynamic from "next/dynamic";
import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Group } from "three";
import type { EyeStyle } from "@/lib/rabbit-traits";

const Rabbit = dynamic(() => import("@/components/three/Rabbit").then((m) => m.Rabbit), {
  ssr: false,
});

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
      group.current.position.y = -0.55 + Math.abs(Math.sin(t * 1.8)) * 0.08;
    }
  });

  return (
    <group ref={group} position={[0, -0.55, 0]}>
      {/* mascot-82 : rose dragée, oreilles droites, yeux ronds, joues roses */}
      <Rabbit avatarSeed="mascot-82" scale={1.5} expression={expr} />
    </group>
  );
}

export default function HeroRabbit() {
  return (
    <div className="hero-rabbit">
      <div className="hero-rabbit-stage">
        {/* caméra frontale rapprochée + fov serré : le lapin remplit la scène */}
        <Canvas camera={{ position: [0, 0.45, 2.2], fov: 40 }} dpr={[1, 2]}>
          <ambientLight intensity={0.95} color="#FFF6E8" />
          <directionalLight position={[3, 5, 3]} intensity={1.5} color="#FFFDF2" />
          <directionalLight position={[-3, 2, -2]} intensity={0.4} color="#C8E6F5" />
          <Suspense fallback={null}>
            <WavingRabbit />
          </Suspense>
        </Canvas>
      </div>
      <h1 className="logo-text">Rabbiteam</h1>
    </div>
  );
}
