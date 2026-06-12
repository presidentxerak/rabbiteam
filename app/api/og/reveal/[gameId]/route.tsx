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

function RabbitFlat({ traits, size }: { traits: RabbitTraits; size: number }) {
  const { bodyColor, bellyColor, earStyle, earInner, eyeStyle, cheeks } = traits;
  const earH = earStyle === "giant" ? 95 : earStyle === "short" ? 40 : 70;
  const earRot = earStyle === "lop" ? 50 : earStyle === "twisted" ? 18 : 0;
  const rightEarRot = earStyle === "one_folded" ? 55 : earStyle === "lop" ? -50 : -earRot;
  const eye = (cx: number) => {
    switch (eyeStyle) {
      case "sleepy":
        return <path d={`M ${cx - 9} 118 Q ${cx} 126 ${cx + 9} 118`} stroke="#3A3340" strokeWidth={4} fill="none" />;
      case "happy":
        return <path d={`M ${cx - 9} 122 Q ${cx} 112 ${cx + 9} 122`} stroke="#3A3340" strokeWidth={4} fill="none" />;
      case "star":
        return <text x={cx} y={126} fontSize={22} textAnchor="middle">✦</text>;
      case "hypno":
        return (
          <g>
            <circle cx={cx} cy={118} r={9} fill="none" stroke="#3A3340" strokeWidth={3} />
            <circle cx={cx} cy={118} r={4} fill="none" stroke="#3A3340" strokeWidth={2} />
          </g>
        );
      case "sparkly":
        return (
          <g>
            <circle cx={cx} cy={118} r={8} fill="#3A3340" />
            <circle cx={cx + 3} cy={114} r={3} fill="#FFFFFF" />
          </g>
        );
      default:
        return <circle cx={cx} cy={118} r={7} fill="#3A3340" />;
    }
  };
  return (
    <svg width={size} height={size} viewBox="0 0 200 230">
      {/* oreilles */}
      <g transform={`rotate(${earRot} 75 70)`}>
        <ellipse cx={75} cy={70 - earH / 2} rx={16} ry={earH / 2 + 12} fill={bodyColor} />
        <ellipse cx={75} cy={70 - earH / 2} rx={8} ry={earH / 2} fill={earInner} />
      </g>
      <g transform={`rotate(${rightEarRot} 125 70)`}>
        <ellipse cx={125} cy={70 - earH / 2} rx={16} ry={earH / 2 + 12} fill={bodyColor} />
        <ellipse cx={125} cy={70 - earH / 2} rx={8} ry={earH / 2} fill={earInner} />
      </g>
      {/* corps + tête */}
      <ellipse cx={100} cy={175} rx={62} ry={50} fill={bodyColor} />
      <ellipse cx={100} cy={185} rx={38} ry={32} fill={bellyColor} />
      <circle cx={100} cy={110} r={52} fill={bodyColor} />
      {/* yeux */}
      {eye(80)}
      {eyeStyle === "monocle_wink" ? (
        <g>
          <circle cx={120} cy={118} r={13} fill="none" stroke="#C9A227" strokeWidth={3} />
          <path d="M 112 118 Q 120 124 128 118" stroke="#3A3340" strokeWidth={4} fill="none" />
        </g>
      ) : (
        eye(120)
      )}
      {/* museau */}
      <ellipse cx={100} cy={132} rx={6} ry={4} fill="#E8A0A8" />
      <path d="M 100 136 L 100 142 M 94 146 Q 100 150 106 146" stroke="#3A3340" strokeWidth={3} fill="none" />
      {/* joues */}
      {cheeks !== "none" && (
        <g>
          <circle cx={64} cy={132} r={9} fill={cheeks === "peach" ? "#FFD9B8" : "#F9C6D0"} opacity={0.9} />
          <circle cx={136} cy={132} r={9} fill={cheeks === "peach" ? "#FFD9B8" : "#F9C6D0"} opacity={0.9} />
        </g>
      )}
    </svg>
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
