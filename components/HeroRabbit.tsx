"use client";

/**
 * En-tête de landing : « Rabbiteam » en typo 3D (CSS extrudé, fiable et
 * responsive, aucun asset) + un lapin 3D qui change d'expression et salue.
 */
import dynamic from "next/dynamic";
import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import type { EyeStyle } from "@/lib/rabbit-traits";

const Rabbit = dynamic(() => import("@/components/three/Rabbit").then((m) => m.Rabbit), {
  ssr: false,
});

// Suite d'expressions jouées en boucle (le corps ne change pas, juste les yeux).
const EXPRESSIONS: EyeStyle[] = ["happy", "sparkly", "star", "monocle_wink", "round", "sleepy"];

function WavingRabbit() {
  const group = useRef<Group>(null);
  const [expr, setExpr] = useState<EyeStyle>("happy");

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
      group.current.rotation.y = Math.sin(t * 0.6) * 0.35;
      group.current.position.y = -0.35 + Math.abs(Math.sin(t * 1.6)) * 0.08;
    }
  });

  return (
    <group ref={group} position={[0, -0.35, 0]}>
      <Rabbit avatarSeed="rabbiteam-hero-mascot" scale={1.5} expression={expr} />
    </group>
  );
}

export default function HeroRabbit() {
  return (
    <div className="hero-rabbit">
      <h1 className="logo3d" aria-label="Rabbiteam">
        Rabbiteam
      </h1>
      <div className="hero-rabbit-stage">
        <Canvas camera={{ position: [0, 0.7, 2.4], fov: 40 }} dpr={[1, 2]}>
          <ambientLight intensity={0.95} color="#FFF6E8" />
          <directionalLight position={[3, 5, 2]} intensity={1.3} color="#FFFDF2" />
          <directionalLight position={[-3, 2, -2]} intensity={0.3} color="#C8E6F5" />
          <Suspense fallback={null}>
            <WavingRabbit />
          </Suspense>
        </Canvas>
      </div>
    </div>
  );
}
