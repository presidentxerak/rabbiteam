"use client";

/**
 * Canvas R3F : caméra orbitale douce, auto-rotation lente par défaut
 * (mobile-first : l'essentiel des visites vient du lien Slack sur téléphone).
 * Ombres désactivées sur mobile (perf).
 */
import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Island, type IslandProps } from "./Island";

function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
}

export default function IslandScene(props: IslandProps) {
  const mobile = useMemo(isMobile, []);
  return (
    <Canvas
      shadows={!mobile}
      dpr={mobile ? [1, 1.5] : [1, 2]}
      camera={{ position: [6.5, 5, 6.5], fov: 42 }}
      style={{ width: "100%", height: "100%", touchAction: "none" }}
      gl={{ antialias: !mobile }}
    >
      <color attach="background" args={["#CFF0F5"]} />
      <ambientLight intensity={0.85} color="#FFF6E8" />
      <directionalLight position={[6, 10, 4]} intensity={1.4} color="#FFFDF2" castShadow={!mobile} />
      <directionalLight position={[-6, 4, -6]} intensity={0.35} color="#C8E6F5" />
      <Suspense fallback={null}>
        <Island {...props} />
      </Suspense>
      <OrbitControls
        autoRotate
        autoRotateSpeed={0.6}
        enablePan={false}
        minDistance={5}
        maxDistance={14}
        minPolarAngle={0.4}
        maxPolarAngle={1.35}
        enableDamping
        dampingFactor={0.06}
      />
    </Canvas>
  );
}
