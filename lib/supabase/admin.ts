/**
 * Client service-role : SERVEUR UNIQUEMENT (bypasse RLS).
 * Ne jamais importer depuis un composant client - le garde-fou
 * "server-only" fait échouer le build si ça arrive.
 */
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function createSupabaseAdminClient(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  return cached;
}

/** Stocke le bot token Slack dans Supabase Vault (jamais en clair en table). */
export async function storeSlackToken(orgId: string, token: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("store_slack_token", {
    p_org_id: orgId,
    p_token: token,
  });
  if (error) throw new Error(`store_slack_token: ${error.message}`);
}

/** Lit le bot token Slack depuis Vault (service role uniquement). */
export async function getSlackToken(orgId: string): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("get_slack_token", { p_org_id: orgId });
  if (error) throw new Error(`get_slack_token: ${error.message}`);
  return (data as string | null) ?? null;
}
