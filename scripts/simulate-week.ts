/**
 * DoD Phase 2 — simule une semaine complète de Saison du Lapin en accéléré
 * en appelant le dispatcher avec des dates forcées (?now=…).
 *
 *   APP_URL=http://localhost:3000 CRON_SECRET=… ISLAND_ID=<uuid> \
 *   npx tsx scripts/simulate-week.ts [YYYY-MM-DD du lundi]
 *
 * L'idempotence est vérifiée au passage : chaque tick est rejoué deux fois.
 */

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET;
const ISLAND_ID = process.env.ISLAND_ID;

if (!CRON_SECRET) {
  console.error("CRON_SECRET requis");
  process.exit(1);
}

const monday = process.argv[2] ?? nextMonday();

function nextMonday(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

function addDays(day: string, n: number): string {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// ⚠️ heures UTC : utiliser une île en timezone UTC pour la simulation,
// ou adapter l'offset ci-dessous à la timezone de l'île de test.
const TICKS: [string, number, string][] = [
  ["lundi 09:00 — startSeason", 0, "T09:00:00Z"],
  ["lundi 09:30 — standup reminder", 0, "T09:30:00Z"],
  ["mardi 10:00 — indice gratuit n°1", 1, "T10:00:00Z"],
  ["mercredi 10:00 — indice payant n°2", 2, "T10:00:00Z"],
  ["jeudi 15:00 — indice gratuit n°3", 3, "T15:00:00Z"],
  ["jeudi 17:00 — check lapin endormi", 3, "T17:00:00Z"],
  ["vendredi 11:00 — ouverture du vote", 4, "T11:00:00Z"],
  ["vendredi 15:30 — rappel non-votants", 4, "T15:30:00Z"],
  ["vendredi 16:00 — clôture & score", 4, "T16:00:00Z"],
  ["vendredi 16:30 — révélation", 4, "T16:30:00Z"],
];

async function tick(label: string, now: string): Promise<void> {
  const qs = new URLSearchParams({ now });
  if (ISLAND_ID) qs.set("island", ISLAND_ID);
  const res = await fetch(`${APP_URL}/api/cron/dispatcher?${qs}`, {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });
  const json = (await res.json()) as { ok: boolean; ran?: Record<string, string[]> };
  console.log(`${res.ok ? "✅" : "❌"} ${label} → ${JSON.stringify(json.ran ?? json)}`);
}

async function main(): Promise<void> {
  console.log(`🐰 Simulation de la semaine du ${monday} sur ${APP_URL}\n`);
  for (const [label, dayOffset, time] of TICKS) {
    const now = addDays(monday, dayOffset) + time;
    await tick(label, now);
    // Rejeu immédiat : l'idempotence doit rendre ce second appel inoffensif.
    await tick(`   (rejeu idempotent) ${label}`, now);
  }
  console.log("\n🎉 Semaine simulée. Vérifier le canal Slack de l'île de test.");
}

void main();
