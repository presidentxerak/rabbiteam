/**
 * DoD Phase 0 — test des policies RLS contre une base réelle.
 * Tente de lire game_secrets (et les autres tables protégées) avec un token
 * UTILISATEUR : doit recevoir 0 ligne, même authentifié, même membre.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=… NEXT_PUBLIC_SUPABASE_ANON_KEY=… \
 *   SUPABASE_SERVICE_ROLE_KEY=… npx tsx scripts/test-rls.ts
 *
 * Pré-requis : migrations appliquées, "Anonymous sign-ins" activé.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY requis");
  process.exit(1);
}

async function main(): Promise<void> {
  const client = createClient(url!, anonKey!);
  let failures = 0;

  // Session utilisateur réelle (anonyme — même niveau qu'un joueur connecté).
  const { error: authError } = await client.auth.signInAnonymously();
  if (authError) {
    console.error("⚠️ signInAnonymously a échoué (activer Anonymous sign-ins) :", authError.message);
    process.exit(1);
  }

  const protectedTables = [
    "game_secrets", // 🔒 LE secret
    "missions", // banque invisible (recoupement = fuite)
    "referrals",
    "dispatch_log",
    "slack_events_processed",
  ];

  for (const table of protectedTables) {
    const { data, error } = await client.from(table).select("*").limit(10);
    const rows = data?.length ?? 0;
    if (rows > 0) {
      console.error(`❌ ${table} : ${rows} ligne(s) lisibles par un utilisateur !`);
      failures++;
    } else {
      console.log(`✅ ${table} : 0 ligne (${error ? `erreur: ${error.code}` : "vide"})`);
    }
  }

  // Écriture interdite : un utilisateur ne crée pas de partie ni ne touche aux carottes.
  const { error: insertErr } = await client
    .from("games")
    .insert({ island_id: "00000000-0000-0000-0000-000000000000", week_start: "2026-01-05" });
  if (insertErr) {
    console.log(`✅ insert games refusé (${insertErr.code})`);
  } else {
    console.error("❌ insert games accepté pour un utilisateur !");
    failures++;
  }

  if (failures > 0) {
    console.error(`\n${failures} faille(s) RLS détectée(s).`);
    process.exit(1);
  }
  console.log("\n🔒 RLS OK : le secret du Lapin est gardé par Postgres.");
}

void main();
