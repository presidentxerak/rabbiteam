/**
 * Carte de Révélation 1200×630 (next/og, JSX → PNG).
 * Le lapin du vainqueur est rendu en 2D plat (mêmes traits que la 3D :
 * on réutilise deriveRabbit, AUCUN rendu 3D côté serveur).
 * L'URL est aussi la meta-image du lien public → partage LinkedIn/Slack.
 */
import { ImageResponse } from "next/og";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { deriveRabbit, type RabbitTraits } from "@/lib/rabbit-traits";
import type { GameRow, PlayerRow } from "@/lib/server/db-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lapin 2D plat construit 100% en <div> (flexbox + border-radius) : rendu
 * fiable par Satori (next/og), contrairement au SVG brut. Mêmes traits que
 * la 3D (deriveRabbit) pour rester cohérent.
 */
function RabbitFlat({ traits, size }: { traits: RabbitTraits; size: number }) {
  const { bodyColor, bellyColor, earStyle, earInner, cheeks } = traits;
  const s = size / 230; // échelle (le dessin est pensé sur 230px de haut)
  const px = (n: number) => `${n * s}px`;
  const earH = earStyle === "giant" ? 130 : earStyle === "short" ? 60 : 100;
  const leftEarRot = earStyle === "lop" ? 28 : earStyle === "twisted" ? 12 : -8;
  const rightEarRot = earStyle === "one_folded" ? 34 : earStyle === "lop" ? -28 : 8;
  const cheekColor = cheeks === "peach" ? "#FFD9B8" : "#F9C6D0";

  const ear = (rot: number, left: boolean) => (
    <div
      style={{
        position: "absolute",
        top: px(-earH + 36),
        left: left ? px(34) : px(96),
        width: px(34),
        height: px(earH),
        background: bodyColor,
        borderRadius: px(18),
        transform: `rotate(${rot}deg)`,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
      }}
    >
      <div style={{ marginTop: px(12), width: px(16), height: px(earH - 34), background: earInner, borderRadius: px(10) }} />
    </div>
  );

  return (
    <div style={{ position: "relative", width: px(164), height: px(230), display: "flex" }}>
      {ear(leftEarRot, true)}
      {ear(rightEarRot, false)}
      {/* corps */}
      <div style={{ position: "absolute", bottom: 0, left: px(10), width: px(144), height: px(120), background: bodyColor, borderRadius: px(72) }} />
      <div style={{ position: "absolute", bottom: px(6), left: px(46), width: px(72), height: px(78), background: bellyColor, borderRadius: px(40) }} />
      {/* tête */}
      <div style={{ position: "absolute", top: px(28), left: px(20), width: px(124), height: px(124), background: bodyColor, borderRadius: px(64), display: "flex" }}>
        {/* yeux */}
        <div style={{ position: "absolute", top: px(54), left: px(30), width: px(16), height: px(16), background: "#3A3340", borderRadius: px(8) }} />
        <div style={{ position: "absolute", top: px(54), left: px(78), width: px(16), height: px(16), background: "#3A3340", borderRadius: px(8) }} />
        {/* museau */}
        <div style={{ position: "absolute", top: px(74), left: px(56), width: px(12), height: px(9), background: "#E8A0A8", borderRadius: px(6) }} />
        {/* joues */}
        {cheeks !== "none" && (
          <>
            <div style={{ position: "absolute", top: px(70), left: px(12), width: px(20), height: px(14), background: cheekColor, borderRadius: px(10) }} />
            <div style={{ position: "absolute", top: px(70), left: px(92), width: px(20), height: px(14), background: cheekColor, borderRadius: px(10) }} />
          </>
        )}
      </div>
    </div>
  );
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ gameId: string }> },
): Promise<Response> {
  const { gameId } = await params;
  const admin = createSupabaseAdminClient();

  const { data: game } = await admin
    .from("games")
    .select("*")
    .eq("id", gameId)
    .eq("status", "revealed") // la carte n'existe qu'après révélation
    .maybeSingle<GameRow>();
  if (!game || !game.result) {
    return new Response("Not found", { status: 404 });
  }

  const { data: secret } = await admin
    .from("game_secrets")
    .select("rabbit_player_id")
    .eq("game_id", gameId)
    .single<{ rabbit_player_id: string }>();
  const { data: rabbit } = await admin
    .from("players")
    .select("*")
    .eq("id", secret?.rabbit_player_id ?? "")
    .single<PlayerRow>();
  const { data: island } = await admin
    .from("islands")
    .select("slug, name")
    .eq("id", game.island_id)
    .single<{ slug: string; name: string }>();
  const { data: votes } = await admin
    .from("votes")
    .select("suspect_id")
    .eq("game_id", gameId);

  // Stat amusante : marge de survie ou score du démasquage.
  const counts = new Map<string, number>();
  for (const v of votes ?? []) {
    counts.set(v.suspect_id as string, (counts.get(v.suspect_id as string) ?? 0) + 1);
  }
  const sorted = [...counts.values()].sort((a, b) => b - a);
  const rabbitVotes = counts.get(rabbit?.id ?? "") ?? 0;
  const top = sorted[0] ?? 0;
  const second = sorted[1] ?? 0;
  let stat: string;
  if (game.result === "rabbit_win") {
    stat =
      top - rabbitVotes <= 1 && top > 0
        ? `The Rabbit survived ${rabbitVotes} votes — by a carrot's whisker`
        : `${votes?.length ?? 0} votes, zero flair: the Rabbit slipped through`;
  } else if (game.result === "detectives_win") {
    stat =
      top - second <= 1
        ? `Unmasked ${top} votes to ${second} — a photo finish`
        : `${top} votes against them: the team had a nose for it`;
  } else {
    stat = "The Rabbit hid so well it forgot its own missions";
  }

  const verdict =
    game.result === "rabbit_win"
      ? "🐰 The Rabbit escaped!"
      : game.result === "detectives_win"
        ? "🔍 Unmasked!"
        : "😶 Draw";
  const bg =
    game.result === "rabbit_win" ? "#FFF3E2" : game.result === "detectives_win" ? "#E2F3FF" : "#F0EDF5";
  const traits = deriveRabbit(rabbit?.avatar_seed ?? 0);
  const appHost = (process.env.NEXT_PUBLIC_APP_URL ?? "https://rabbiteam.app").replace(/^https?:\/\//, "");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: `linear-gradient(160deg, ${bg} 0%, #7ED6DF 140%)`,
          fontFamily: "sans-serif",
          padding: 60,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1 }}>
          <div style={{ fontSize: 28, color: "#7A6F86", display: "flex" }}>
            Rabbit Season · {island?.name ?? "Rabbiteam"}
          </div>
          <div style={{ fontSize: 72, fontWeight: 800, color: "#3A3340", marginTop: 12, display: "flex" }}>
            {verdict}
          </div>
          <div style={{ fontSize: 34, color: "#3A3340", marginTop: 24, display: "flex" }}>
            The Rabbit was {rabbit?.display_name ?? "?"}
          </div>
          <div style={{ fontSize: 26, color: "#7A6F86", marginTop: 18, maxWidth: 620, display: "flex" }}>
            {stat}
          </div>
          <div style={{ fontSize: 26, color: "#3A3340", marginTop: 48, display: "flex" }}>
            {appHost}/i/{island?.slug ?? ""} — Would your team survive the Rabbit?
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <RabbitFlat traits={traits} size={420} />
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
