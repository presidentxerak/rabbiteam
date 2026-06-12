"use client";

/**
 * Révélation du lapin à l'onboarding : petite scène 3D dédiée + liaison
 * du compte (session anonyme Supabase → players.auth_user_id).
 */
import dynamic from "next/dynamic";
import { Suspense, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { linkPlayer } from "./actions";

const Rabbit = dynamic(
  () => import("@/components/three/Rabbit").then((m) => m.Rabbit),
  { ssr: false },
);

export default function JoinClient(props: {
  inviteCode: string;
  slackUserId: string;
  displayName: string;
  avatarSeed: string;
  islandName: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  function adopt(): void {
    startTransition(async () => {
      // Session anonyme (réutilisée si déjà présente).
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        const { error: signInError } = await supabase.auth.signInAnonymously();
        if (signInError) {
          setError("Impossible de créer ta session. Réessaie dans un instant.");
          return;
        }
      }
      const res = await linkPlayer(props.inviteCode, props.slackUserId);
      if (res.ok && res.slug) {
        router.push(`/island/${res.slug}`);
      } else if (res.error === "already_linked") {
        setError("Ce lapin a déjà été adopté depuis un autre navigateur. Si c'est toi, ouvre l'île depuis ce navigateur-là.");
      } else {
        setError("Le terrier est introuvable. Redemande un lien dans Slack.");
      }
    });
  }

  return (
    <main className="join-page">
      <span className="tag">Île {props.islandName}</span>
      <h1>
        {props.displayName}, voici ton lapin. 🐰
      </h1>
      <p style={{ color: "var(--ink-soft)", maxWidth: 480 }}>
        Il est né de ton arrivée sur l&apos;île — unique au monde, calculé pour toujours. Personne
        d&apos;autre n&apos;a le même.
      </p>
      <div className="rabbit-stage">
        <Canvas camera={{ position: [0, 0.8, 2.2], fov: 40 }}>
          <color attach="background" args={["#FFF6E8"]} />
          <ambientLight intensity={0.9} />
          <directionalLight position={[3, 5, 2]} intensity={1.3} />
          <Suspense fallback={null}>
            <Rabbit avatarSeed={props.avatarSeed} position={[0, -0.35, 0]} scale={1.4} />
          </Suspense>
          <OrbitControls autoRotate autoRotateSpeed={2} enableZoom={false} enablePan={false} />
        </Canvas>
      </div>
      <div style={{ marginTop: 24 }}>
        <button className="btn btn-primary" onClick={adopt} disabled={pending}>
          {pending ? "Adoption en cours…" : "C'est mon lapin ! 🥕"}
        </button>
      </div>
      {error && <p style={{ color: "var(--coral-deep)" }}>{error}</p>}
    </main>
  );
}
