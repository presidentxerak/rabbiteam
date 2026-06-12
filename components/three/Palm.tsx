"use client";

/** Palmier kawaii : tronc incliné en segments, feuilles = cônes aplatis. */
export function Palm({
  lean = 0.2,
  height = 2,
  golden = false,
}: {
  lean?: number;
  height?: number;
  golden?: boolean;
}) {
  const segments = 4;
  const trunkColor = golden ? "#D9A93C" : "#B07A52";
  const leafColor = golden ? "#F2C14E" : "#5FBF77";
  return (
    <group>
      {Array.from({ length: segments }).map((_, i) => {
        const t = i / segments;
        return (
          <mesh
            key={i}
            position={[Math.sin(lean) * t * height, (t + 0.12) * height * 0.92, 0]}
            rotation={[0, 0, -lean * (0.6 + t)]}
          >
            <cylinderGeometry args={[0.1 - t * 0.03, 0.12 - t * 0.03, height / segments + 0.06, 10]} />
            <meshToonMaterial color={trunkColor} />
          </mesh>
        );
      })}
      <group position={[Math.sin(lean) * height, height * 0.98, 0]}>
        {Array.from({ length: 6 }).map((_, i) => {
          const a = (i / 6) * Math.PI * 2;
          return (
            <mesh
              key={i}
              position={[Math.cos(a) * 0.35, 0.05, Math.sin(a) * 0.35]}
              rotation={[Math.sin(a) * 1.25, 0, -Math.cos(a) * 1.25]}
              scale={[1, 0.18, 0.42]}
            >
              <coneGeometry args={[0.22, 0.9, 6]} />
              <meshToonMaterial
                color={leafColor}
                {...(golden ? { emissive: "#F2C14E", emissiveIntensity: 0.3 } : {})}
              />
            </mesh>
          );
        })}
        <mesh>
          <sphereGeometry args={[0.12, 10, 10]} />
          <meshToonMaterial color={trunkColor} />
        </mesh>
      </group>
    </group>
  );
}
