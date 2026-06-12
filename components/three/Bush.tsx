"use client";

/** Buisson : sphères vertes agglutinées. */
export function Bush({ scale = 1 }: { scale?: number }) {
  return (
    <group scale={[scale, scale, scale]}>
      <mesh position={[0, 0.18, 0]}>
        <sphereGeometry args={[0.25, 12, 12]} />
        <meshToonMaterial color="#6FCB85" />
      </mesh>
      <mesh position={[0.18, 0.12, 0.08]}>
        <sphereGeometry args={[0.17, 12, 12]} />
        <meshToonMaterial color="#5FBF77" />
      </mesh>
      <mesh position={[-0.16, 0.12, -0.05]}>
        <sphereGeometry args={[0.15, 12, 12]} />
        <meshToonMaterial color="#7DD491" />
      </mesh>
    </group>
  );
}
