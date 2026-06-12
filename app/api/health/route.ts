/**
 * Diagnostic de déploiement : GET /api/health
 * Vérifie la présence des variables d'environnement et l'état de la base
 * (tables créées ? seed appliqué ?). Ne révèle aucun secret, uniquement des
 * booléens et des compteurs. Pense-bête intégré : chaque check en échec
 * indique l'action corrective.
 */
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    SLACK_CLIENT_ID: Boolean(process.env.SLACK_CLIENT_ID),
    SLACK_CLIENT_SECRET: Boolean(process.env.SLACK_CLIENT_SECRET),
    SLACK_SIGNING_SECRET: Boolean(process.env.SLACK_SIGNING_SECRET),
    NEXT_PUBLIC_APP_URL: Boolean(process.env.NEXT_PUBLIC_APP_URL),
    CRON_SECRET: Boolean(process.env.CRON_SECRET),
    ANTHROPIC_API_KEY: Boolean(process.env.ANTHROPIC_API_KEY),
  };

  const db: Record<string, unknown> = { reachable: false, tables: false, seeded: false };
  const hints: string[] = [];

  for (const [k, ok] of Object.entries(env)) {
    if (!ok && k !== "ANTHROPIC_API_KEY") {
      hints.push(`Env var ${k} manquante dans Vercel (Settings → Environment Variables), puis Redeploy.`);
    }
  }

  if (env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    const admin = createSupabaseAdminClient();
    const { error: orgErr } = await admin.from("organizations").select("id", { head: true, count: "exact" });
    if (orgErr) {
      db.reachable = true;
      db.error = `${orgErr.code}: ${orgErr.message}`;
      if (orgErr.code === "PGRST205" || orgErr.code === "42P01") {
        hints.push(
          "Les tables n'existent pas : colle supabase/setup-all.sql dans Supabase → SQL Editor → Run (ou `supabase db push`).",
        );
      }
    } else {
      db.reachable = true;
      db.tables = true;
      const [{ count: items }, { count: missions }, { count: orgs }] = await Promise.all([
        admin.from("items").select("id", { head: true, count: "exact" }),
        admin.from("missions").select("id", { head: true, count: "exact" }),
        admin.from("organizations").select("id", { head: true, count: "exact" }),
      ]);
      db.items = items ?? 0;
      db.missions = missions ?? 0;
      db.organizations = orgs ?? 0;
      db.seeded = (items ?? 0) >= 40 && (missions ?? 0) >= 60;
      if (!db.seeded) {
        hints.push("Seed incomplet : re-colle la partie 0002 de supabase/setup-all.sql (items + missions).");
      }
    }
  } else {
    hints.push("Impossible de tester la base sans NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.");
  }

  const ok = Object.entries(env).every(([k, v]) => v || k === "ANTHROPIC_API_KEY") && db.tables === true && db.seeded === true;
  return NextResponse.json({ ok, env, db, agents: env.ANTHROPIC_API_KEY ? "enabled" : "disabled (optional)", hints });
}
