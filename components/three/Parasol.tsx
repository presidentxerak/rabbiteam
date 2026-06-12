"use client";

/** Parasol rayé : cône bicolore sur cylindre fin. */
export function Parasol() {
  return (
    <group>
      <mesh position={[0, 0.45, 0]} rotation={[0, 0, 0.12]}>
        <cylinderGeometry args={[0.025, 0.025, 0.95, 8]} />
        <meshToonMaterial color="#FFFDF8" />
      </mesh>
      <group position={[0.055, 0.92, 0]} rotation={[0, 0, 0.12]}>
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh key={i} rotation={[0, (i / 8) * Math.PI * 2, 0]}>
            <coneGeometry args={[0.55, 0.22, 8, 1, false, 0, Math.PI / 4]} />
            <meshToonMaterial color={i % 2 ? "#FF8C7A" : "#FFFDF8"} side={2} />
          </mesh>
        ))}
        <mesh position={[0, 0.16, 0]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshToonMaterial color="#FF8C7A" />
        </mesh>
      </group>
    </group>
  );
}
