/**
 * Stripe Checkout (Phase 5) : crée une session d'abonnement Team/Company
 * pour une organisation. Le webhook /api/webhooks/stripe applique le plan.
 * GET /api/stripe/checkout?org=<uuid>&plan=team|company
 */
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  org: z.string().uuid(),
  plan: z.enum(["team", "company"]),
});

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://rabbiteam.app";
  const parsed = querySchema.safeParse({
    org: url.searchParams.get("org") ?? "",
    plan: url.searchParams.get("plan") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "bad_query" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("id, stripe_customer_id, slack_team_name")
    .eq("id", parsed.data.org)
    .maybeSingle<{ id: string; stripe_customer_id: string | null; slack_team_name: string }>();
  if (!org) return NextResponse.json({ ok: false, error: "org_not_found" }, { status: 404 });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const priceId =
    parsed.data.plan === "team" ? process.env.STRIPE_PRICE_TEAM : process.env.STRIPE_PRICE_COMPANY;
  if (!priceId) {
    return NextResponse.json({ ok: false, error: "price_not_configured" }, { status: 500 });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    ...(org.stripe_customer_id ? { customer: org.stripe_customer_id } : {}),
    metadata: { org_id: org.id },
    subscription_data: { metadata: { org_id: org.id } },
    success_url: `${appUrl}/?upgraded=1`,
    cancel_url: `${appUrl}/#pricing`,
  });

  return NextResponse.redirect(session.url ?? `${appUrl}/#pricing`, 303);
}
