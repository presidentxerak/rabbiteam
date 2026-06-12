/**
 * Génère supabase/migrations/0002_seed.sql à partir des sources TypeScript
 * (items-catalog.ts + missions-bank.ts). À relancer après toute modification :
 *   npx tsx scripts/generate-seed.ts
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { ITEMS_CATALOG } from "../lib/items-catalog";
import { MISSIONS_BANK } from "../lib/missions-bank";

function sqlString(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

function sqlJson(obj: unknown): string {
  return `${sqlString(JSON.stringify(obj))}::jsonb`;
}

const lines: string[] = [
  "-- ============================================================",
  "-- SEED — catalogue d'items + banque de missions",
  "-- ⚠️ FICHIER GÉNÉRÉ par scripts/generate-seed.ts — ne pas éditer à la main.",
  "-- ============================================================",
  "",
  `-- ${ITEMS_CATALOG.length} items`,
  "insert into items (slug, name, slot, rarity, params, unlock_hint) values",
];

lines.push(
  ITEMS_CATALOG.map(
    (i) =>
      `  (${sqlString(i.slug)}, ${sqlString(i.name)}, ${sqlString(i.slot)}, ${sqlString(i.rarity)}, ${sqlJson(i.params)}, ${sqlString(i.unlockHint)})`,
  ).join(",\n") + "\non conflict (slug) do update set name = excluded.name, params = excluded.params, unlock_hint = excluded.unlock_hint;",
);

lines.push("", `-- ${MISSIONS_BANK.length} missions`, "insert into missions (slug, tool, difficulty, brief_md, detection, params) values");
lines.push(
  MISSIONS_BANK.map(
    (m) =>
      `  (${sqlString(m.slug)}, ${sqlString(m.tool)}, ${m.difficulty}, ${sqlString(m.briefMd)}, ${sqlString(m.detection)}, ${sqlJson(m.params)})`,
  ).join(",\n") + "\non conflict (slug) do update set brief_md = excluded.brief_md, params = excluded.params;",
);
lines.push("");

const out = join(__dirname, "..", "supabase", "migrations", "0002_seed.sql");
writeFileSync(out, lines.join("\n"));
console.log(`✅ ${out} généré (${ITEMS_CATALOG.length} items, ${MISSIONS_BANK.length} missions)`);
