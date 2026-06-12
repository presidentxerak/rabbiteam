/**
 * Installation de l'app Slack (OAuth v2).
 * Échange du code → bot token (stocké dans Vault), création de
 * l'organisation + île par défaut, message d'onboarding, parrainage.
 */
import { NextResponse } from "next/server";
import { createSupabaseAdminClient, storeSlackToken } from "@/lib/supabase/admin";
import { slackApi } from "@/lib/slack/client";
import { slackOAuthAccessSchema, slackOAuthQuerySchema } from "@/lib/zod-schemas";
import { randomSeed } from "@/lib/prng";

export const dynamic = "force-dynamic";

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "ile"
  );
}

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://rabbiteam.app";

  const parsed = slackOAuthQuerySchema.safeParse({
    code: url.searchParams.get("code") ?? "",
    state: url.searchParams.get("state") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.redirect(`${appUrl}/?error=slack_oauth`);
  }

  // Échange code → token (Basic auth client_id:client_secret)
  const res = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: parsed.data.code,
      client_id: process.env.SLACK_CLIENT_ID!,
      client_secret: process.env.SLACK_CLIENT_SECRET!,
    }),
  });
  const accessParsed = slackOAuthAccessSchema.safeParse(await res.json());
  if (!accessParsed.success) {
    return NextResponse.redirect(`${appUrl}/?error=slack_oauth`);
  }
  const { access_token, team } = accessParsed.data;

  const admin = createSupabaseAdminClient();

  // Idempotent : réinstallation = mise à jour du token, pas de doublon.
  const { data: existingOrg } = await admin
    .from("organizations")
    .select("id")
    .eq("slack_team_id", team.id)
    .maybeSingle<{ id: string }>();

  let orgId: string;
  if (existingOrg) {
    orgId = existingOrg.id;
    await admin
      .from("organizations")
      .update({ slack_team_name: team.name })
      .eq("id", orgId);
  } else {
    const { data: org, error } = await admin
      .from("organizations")
      .insert({ slack_team_id: team.id, slack_team_name: team.name })
      .select("id")
      .single<{ id: string }>();
    if (error || !org) {
      return NextResponse.redirect(`${appUrl}/?error=org_create`);
    }
    orgId = org.id;

    // Île par défaut (le canal sera fixé par /rabbiteam setup)
    let slug = slugify(team.name);
    const { data: slugTaken } = await admin
      .from("islands").select("id").eq("slug", slug).maybeSingle();
    if (slugTaken) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    await admin.from("islands").insert({
      org_id: orgId,
      name: team.name,
      slug,
      seed: randomSeed(),
      slack_channel_id: "",
    });

    // Parrainage : ?state=ref_<island_id> posé par la landing
    const ref = parsed.data.state?.startsWith("ref_") ? parsed.data.state.slice(4) : null;
    if (ref) {
      const { data: referrerIsland } = await admin
        .from("islands").select("id").eq("id", ref).maybeSingle();
      if (referrerIsland) {
        await admin.from("referrals").insert({
          referrer_island_id: ref,
          referred_org_id: orgId,
        });
      }
    }
  }

  await storeSlackToken(orgId, access_token);

  // Message d'onboarding dans le DM de l'installateur n'est pas garanti ;
  // on poste via le canal général si possible, sinon l'utilisateur verra
  // les instructions sur la page de succès.
  await slackApi(access_token, "chat.postMessage", {
    channel: url.searchParams.get("installer") ?? "",
    text: "🐰 Rabbiteam is installed! Pick your channel with `/rabbiteam setup #channel`.",
  }).catch(() => undefined);

  return NextResponse.redirect(`${appUrl}/?installed=1`);
}
