"use client";

/** Chaise longue : boîtes inclinées pastel. */
export function Deckchair() {
  return (
    <group>
      <mesh position={[0, 0.12, 0]} rotation={[-0.25, 0, 0]}>
        <boxGeometry args={[0.4, 0.04, 0.55]} />
        <meshToonMaterial color="#C8E6F5" />
      </mesh>
      <mesh position={[0, 0.3, -0.3]} rotation={[0.55, 0, 0]}>
        <boxGeometry args={[0.4, 0.04, 0.4]} />
        <meshToonMaterial color="#C8E6F5" />
      </mesh>
      {[[-0.16, 0.18], [0.16, 0.18], [-0.16, -0.2], [0.16, -0.2]].map(([x, z], i) => (
        <mesh key={i} position={[x ?? 0, 0.04, z ?? 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.1, 8]} />
          <meshToonMaterial color="#FFFDF8" />
        </mesh>
      ))}
    </group>
  );
}
