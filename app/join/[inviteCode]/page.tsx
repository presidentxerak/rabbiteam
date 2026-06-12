/**
 * Onboarding joueur via lien magique Slack :
 * /join/[invite_code]?u=[slack_user_id] → révèle son lapin + lie le compte.
 */
import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ inviteCode: string }>;
  searchParams: Promise<{ u?: string }>;
}) {
  const { inviteCode } = await params;
  const { u } = await searchParams;

  const notFound = (
    <main className="join-page">
      <h1>Expired or incomplete link</h1>
      <p>Ask for a fresh magic link in Slack with `/rabbiteam setup`.</p>
      <Link className="btn btn-primary" href="/">
        Home
      </Link>
    </main>
  );

  if (!u) return notFound;

  const admin = createSupabaseAdminClient();
  const { data: island } = await admin
    .from("islands")
    .select("id, name")
    .eq("invite_code", inviteCode)
    .maybeSingle<{ id: string; name: string }>();
  if (!island) return notFound;

  const { data: player } = await admin
    .from("players")
    .select("display_name, avatar_seed")
    .eq("island_id", island.id)
    .eq("slack_user_id", u)
    .maybeSingle<{ display_name: string; avatar_seed: string }>();
  if (!player) return notFound;

  const { default: JoinClient } = await import("./JoinClient");
  return (
    <JoinClient
      inviteCode={inviteCode}
      slackUserId={u}
      displayName={player.display_name}
      avatarSeed={String(player.avatar_seed)}
      islandName={island.name}
    />
  );
}
