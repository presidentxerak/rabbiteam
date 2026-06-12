/**
 * Installation de l'app Slack (OAuth v2).
 * Échange du code → bot token (stocké dans Vault), création de
 * l'organisation + île par défaut, message d'onboarding, parrainage.
 */
import { NextResponse } from "next/server";
import { createSupabaseAdminClient, storeSlackToken } from "@/lib/supabase/admin";
import { postDM } from "@/lib/slack/client";
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
  const { data: existingOrg, error: selErr } = await admin
    .from("organizations")
    .select("id")
    .eq("slack_team_id", team.id)
    .maybeSingle<{ id: string }>();
  if (selErr) {
    // Cause la plus fréquente ici : migrations non appliquées (table absente,
    // code 42P01) ou clé service-role / URL invalide. Visible dans les logs +
    // dans l'URL de redirection pour diagnostiquer rapidement.
    console.error("[oauth] org select failed:", selErr.code, selErr.message);
    return NextResponse.redirect(`${appUrl}/?error=db&code=${selErr.code ?? "unknown"}`);
  }

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
      console.error("[oauth] org create failed:", error?.code, error?.message);
      return NextResponse.redirect(`${appUrl}/?error=org_create&code=${error?.code ?? "unknown"}`);
    }
    orgId = org.id;

    // Île par défaut (le canal sera fixé par /rabbiteam setup)
    let slug = slugify(team.name);
    const { data: slugTaken } = await admin
      .from("islands").select("id").eq("slug", slug).maybeSingle();
    if (slugTaken) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    const { error: islandErr } = await admin.from("islands").insert({
      org_id: orgId,
      name: team.name,
      slug,
      seed: randomSeed(),
      slack_channel_id: "",
    });
    if (islandErr) {
      console.error("[oauth] island create failed:", islandErr.code, islandErr.message);
      return NextResponse.redirect(`${appUrl}/?error=island_create&code=${islandErr.code ?? "unknown"}`);
    }

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

  try {
    await storeSlackToken(orgId, access_token);
  } catch (e) {
    console.error("[oauth] storeSlackToken failed:", e);
    return NextResponse.redirect(`${appUrl}/?error=token_store`);
  }

  // DM d'onboarding à la personne qui vient d'installer l'app (authed_user).
  const installerId = accessParsed.data.authed_user?.id;
  if (installerId) {
    await postDM(
      access_token,
      installerId,
      "🐰 *Rabbiteam is installed!* Pick your channel with `/rabbiteam setup #channel` and the first Rabbit Season starts Monday 9am.",
    ).catch(() => undefined);
  }

  return NextResponse.redirect(`${appUrl}/?installed=1`);
}
