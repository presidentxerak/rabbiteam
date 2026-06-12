"use client";

/**
 * Maison kawaii centrale (= l'entreprise) : base cylindrique crème,
 * étage corail, toit dôme rouge doux, porte arrondie, 2 fenêtres hublot,
 * enseigne avec le nom de l'équipe. Aucune référence à quoi que ce soit. 🐢❌
 */
import { Text } from "@react-three/drei";

export function House({ teamName, garland = false }: { teamName: string; garland?: boolean }) {
  return (
    <group>
      {/* base crème */}
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[1.15, 1.25, 1.1, 24]} />
        <meshToonMaterial color="#FFF6E8" />
      </mesh>
      {/* étage corail */}
      <mesh position={[0, 1.35, 0]}>
        <cylinderGeometry args={[0.95, 1.05, 0.6, 24]} />
        <meshToonMaterial color="#FF8C7A" />
      </mesh>
      {/* toit dôme rouge doux */}
      <mesh position={[0, 1.65, 0]}>
        <sphereGeometry args={[0.98, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshToonMaterial color="#E2574C" />
      </mesh>
      {/* cheminée pompon */}
      <mesh position={[0.45, 2.35, 0]}>
        <sphereGeometry args={[0.14, 12, 12]} />
        <meshToonMaterial color="#FFF6E8" />
      </mesh>
      {/* porte arrondie */}
      <group position={[0, 0.45, 1.2]}>
        <mesh>
          <boxGeometry args={[0.45, 0.6, 0.1]} />
          <meshToonMaterial color="#B07A52" />
        </mesh>
        <mesh position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.225, 0.225, 0.1, 16, 1, false, 0, Math.PI]} />
          <meshToonMaterial color="#B07A52" />
        </mesh>
        <mesh position={[0.12, 0, 0.06]}>
          <sphereGeometry args={[0.03, 8, 8]} />
          <meshToonMaterial color="#F2C14E" />
        </mesh>
      </group>
      {/* 2 fenêtres hublot */}
      {[-0.75, 0.75].map((x) => (
        <group key={x} position={[x, 0.85, 0.95]} rotation={[0, x > 0 ? 0.6 : -0.6, 0]}>
          <mesh>
            <torusGeometry args={[0.18, 0.04, 8, 20]} />
            <meshToonMaterial color="#FFFDF8" />
          </mesh>
          <mesh>
            <circleGeometry args={[0.18, 20]} />
            <meshToonMaterial color="#9ADBE8" />
          </mesh>
        </group>
      ))}
      {/* enseigne avec le nom de l'équipe */}
      <group position={[0, 2.0, 1.0]} rotation={[-0.15, 0, 0]}>
        <mesh>
          <boxGeometry args={[1.5, 0.34, 0.06]} />
          <meshToonMaterial color="#FFF6E8" />
        </mesh>
        <Text
          position={[0, 0, 0.04]}
          fontSize={0.17}
          color="#E2574C"
          anchorX="center"
          anchorY="middle"
          maxWidth={1.4}
        >
          {teamName.toUpperCase().slice(0, 16)}
        </Text>
      </group>
      {/* guirlande (item d'île house_garland) */}
      {garland &&
        Array.from({ length: 10 }).map((_, i) => {
          const a = (i / 10) * Math.PI * 2;
          const colors = ["#F6C6D8", "#FFF3CF", "#C8E6F5"];
          return (
            <mesh key={i} position={[Math.cos(a) * 1.05, 1.1 + Math.sin(i * 2.1) * 0.06, Math.sin(a) * 1.05]}>
              <sphereGeometry args={[0.05, 8, 8]} />
              <meshToonMaterial
                color={colors[i % 3]}
                emissive={colors[i % 3]}
                emissiveIntensity={0.4}
              />
            </mesh>
          );
        })}
    </group>
  );
}
