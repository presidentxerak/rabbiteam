# Rabbiteam 🐰

Jeu social asynchrone d'entreprise : **île 3D kawaii** qui pousse avec les signaux réels de
l'équipe (Slack, Notion, Kanban) + **déduction sociale hebdomadaire** (la Saison du Lapin),
le tout pluggé sur Slack. Session quotidienne < 3 minutes.

- **Couche ambiante** : l'île 3D pousse toute seule (messages, kudos, pages, tickets).
- **Couche rituel** : standup gamifié 30 s → carottes 🥕, streaks, drops d'items.
- **Couche événement** : chaque lundi un joueur devient secrètement *Le Lapin* avec 3 missions
  discrètes ; indices mardi/mercredi/jeudi ; vote vendredi 11h ; révélation dramatique 16h30.

**Principes non négociables** : aucune métrique de productivité individuelle visible ; le secret
du Lapin est garanti par Postgres (RLS), pas par le front ; coût serveur marginal ≈ 0 (tout est
événementiel, un seul cron).

## Stack

| Composant | Choix |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript strict) |
| 3D | React Three Fiber + drei — géométrie 100% procédurale, zéro asset |
| BDD + Auth + Realtime | Supabase (RLS pour le secret, Realtime sur le vote du vendredi) |
| Hosting + Crons + OG | Vercel (`vercel.json`, `next/og`) |
| Validation | Zod sur 100% des entrées externes |
| Slack | HTTP brut sur Route Handlers (pas de Bolt : serverless, ack < 3 s + `after()`) |
| Paiement | Stripe (plans Team / Company) |

## Démarrage

```bash
npm install
cp .env.example .env.local   # remplir les variables
npm run dev
```

### 1. Supabase

1. Créer un projet Supabase, activer **Anonymous sign-ins** (Auth → Providers).
2. Appliquer les migrations :
   ```bash
   supabase link --project-ref <ref>
   supabase db push        # 0001_init + 0002_seed (42 items, 60 missions) + 0003_slack_tokens
   ```
3. Vérifier la forteresse RLS (DoD Phase 0) :
   ```bash
   npx tsx scripts/test-rls.ts
   ```
   Le script se connecte avec un token **utilisateur** et doit recevoir 0 ligne de
   `game_secrets`, `missions`, etc.

### 2. Slack

1. Créer une app sur api.slack.com avec les scopes bot :
   `chat:write`, `commands`, `users:read`, `channels:read`, `reactions:read`, `im:write`, `chat:write.public`.
2. **OAuth** : redirect URL → `https://<app>/api/slack/oauth`.
3. **Events API** : `https://<app>/api/slack/events` (le handler répond au `url_verification`).
   S'abonner à `reaction_added` et `message.channels`.
4. **Interactivity** : `https://<app>/api/slack/interactions`.
5. **Slash command** `/rabbiteam` : `https://<app>/api/slack/commands`.
6. Renseigner `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`.

Installation côté équipe : bouton « Ajouter à Slack » sur la landing → `/rabbiteam setup #canal`
→ chaque membre reçoit son **lien magique** en DM et découvre son lapin.

### 3. Vercel

- Déployer, renseigner toutes les variables de `.env.example`.
- Le cron est déclaré dans `vercel.json` (`0,30 * * * *`) : **un seul dispatcher** calcule
  l'heure locale de chaque île (multi-fuseaux gratuit) et déclenche les actions dues.
  Protégé par `Authorization: Bearer CRON_SECRET`.

### 4. Simuler une semaine (DoD Phase 2)

```bash
APP_URL=http://localhost:3000 CRON_SECRET=… ISLAND_ID=<uuid> npx tsx scripts/simulate-week.ts
```

Joue lundi 9h → vendredi 16h30 en accéléré contre un workspace de test, chaque tick rejoué
deux fois pour prouver l'idempotence (`dispatch_log`).

## Tests

```bash
npm test          # moteur pur (sélection du Lapin, scoring, garde-fous, HMAC, île)
npm run typecheck
npm run build
```

## Architecture

```
app/
  page.tsx                      landing (+ ?ref= parrainage)
  island/[slug]/                île privée (RLS via session)
  i/[slug]/                     île publique anonymisée (viralité)
  join/[inviteCode]/            onboarding lien magique
  api/slack/{oauth,events,commands,interactions}
  api/cron/dispatcher           LE cron unique
  api/og/reveal/[gameId]        Carte de Révélation (lapin SVG 2D)
  api/webhooks/{notion,linear,stripe}
  api/stripe/checkout
components/three/               île + lapins 100% procéduraux (R3F)
lib/
  prng.ts, rabbit-traits.ts     seed → lapin (ordre des tirages = contrat)
  island-builder.ts             (seed, events[]) → scène, pur et déterministe
  game-engine.ts                transitions de saison, pur, testé
  missions-bank.ts              60 missions (source du seed SQL)
  items-catalog.ts              42 items (source du seed SQL)
  slack/{verify,client,blocks}  HMAC, Web API, Block Kit
  server/                       orchestrateur (saison, standup, missions, parrainage)
  supabase/{server,client,admin}
supabase/migrations/            0001 schéma + RLS, 0002 seed (généré), 0003 slack_tokens
scripts/                        generate-seed, test-rls, simulate-week
tests/game-engine.test.ts       40 tests Vitest
```

### Le secret du Lapin

`game_secrets` n'a **aucune** policy de lecture : même un membre authentifié qui forge une
requête PostgREST reçoit zéro ligne. `missions` et `game_missions` sont invisibles avant la
révélation. Le trigger `guard_player_columns` empêche tout client de toucher aux carottes,
streaks et seeds — seule la service role (serveur) fait bouger la monnaie. Le bot token Slack
vit dans la table `slack_tokens` (RLS activée, **aucune policy** = même garantie que
`game_secrets`), lue uniquement via deux fonctions `security definer` réservées au service role
(migration `0003`).

### Agents Claude (optionnels)

Deux agents sont câblés sur l'API Claude (`@anthropic-ai/sdk`, `claude-opus-4-8`) et **gardés
par `isAgentEnabled()`** : sans `ANTHROPIC_API_KEY`, tout retombe sur le comportement non-IA et
l'app fonctionne à l'identique.

- **Detective Agent** (`/rabbiteam detective <question>`) : boucle agentique avec tool use
  (`get_published_clues`, `get_players`, `get_rabbit_traits`). Ses outils ne peuvent PAS lire
  `game_secrets`/`game_missions` — la RLS s'applique aussi à l'agent. Même l'IA ne peut pas tricher.
- **Game Master Agent** : `narrateClue` réécrit chaque indice de façon vivante sans changer les
  faits ; la sûreté ≥ candidats reste garantie par le moteur pur.

### Piloter une démo (cron)

Le cron Vercel (`vercel.json`) ne se déclenche qu'une fois par jour sur le plan Hobby. Pour une
démo en direct, piloter le dispatcher à la main avec `scripts/simulate-week.ts` (ou un simple
`curl` sur `/api/cron/dispatcher?now=…` avec le header `Authorization: Bearer CRON_SECRET`).

### Règle d'or des lapins

`deriveRabbit()` consomme le PRNG dans un **ordre fixe**. Ne jamais réordonner les tirages :
ça changerait tous les lapins existants. Pour ajouter un trait : à la fin, uniquement.
