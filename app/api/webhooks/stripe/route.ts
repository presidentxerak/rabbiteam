/**
 * Webhook Stripe (Phase 5) : checkout complété / abonnement modifié →
 * mise à jour de organizations.plan. Le moteur lit `plan` pour appliquer
 * les limites (saisons, joueurs).
 */
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function planFromPrice(priceId: string | null | undefined): "team" | "company" | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_TEAM) return "team";
  if (priceId === process.env.STRIPE_PRICE_COMPANY) return "company";
  return null;
}

export async function POST(req: Request): Promise<NextResponse> {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ ok: false }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ ok: false, error: "bad_signature" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const orgId = session.metadata?.org_id;
      const customerId = typeof session.customer === "string" ? session.customer : null;
      if (orgId && customerId) {
        await admin
          .from("organizations")
          .update({ stripe_customer_id: customerId })
          .eq("id", orgId);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object;
      const customerId = typeof sub.customer === "string" ? sub.customer : null;
      if (!customerId) break;
      const priceId = sub.items.data[0]?.price.id;
      const plan = sub.status === "active" || sub.status === "trialing" ? planFromPrice(priceId) : null;
      await admin
        .from("organizations")
        .update({ plan: plan ?? "free" })
        .eq("stripe_customer_id", customerId);
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const customerId = typeof sub.customer === "string" ? sub.customer : null;
      if (customerId) {
        await admin.from("organizations").update({ plan: "free" }).eq("stripe_customer_id", customerId);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
