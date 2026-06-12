"use client";

import { Parasol } from "./Parasol";
import { Deckchair } from "./Deckchair";

/** Croissant de plage plus clair + parasol rayé + chaise longue. */
export function Beach() {
  return (
    <group position={[2.0, 0.01, 1.4]} rotation={[0, -0.5, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.205, 0]}>
        <circleGeometry args={[1.5, 24]} />
        <meshToonMaterial color="#FBEDC9" />
      </mesh>
      <group position={[0.3, 0.2, -0.2]}>
        <Parasol />
      </group>
      <group position={[-0.45, 0.2, 0.35]} rotation={[0, 0.7, 0]}>
        <Deckchair />
      </group>
      {/* coquillages décoratifs fixes */}
      {[[-0.9, 0.6], [0.8, 0.7], [0.2, 1.0]].map(([x, z], i) => (
        <mesh key={i} position={[x ?? 0, 0.23, z ?? 0]} scale={[1, 0.5, 1]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshToonMaterial color={i % 2 ? "#F6C6D8" : "#FFFDF8"} />
        </mesh>
      ))}
    </group>
  );
}
