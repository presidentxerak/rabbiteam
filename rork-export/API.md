# Contrat d'API — Rabbiteam Mobile

L'app mobile ne recrée **aucune** logique serveur : elle parle au backend
Next.js/Supabase déjà déployé. Ce document liste ce qui **existe déjà** et les
endpoints REST « mobile » **à ajouter** (chacun n'est qu'un mince emballage
autour de `lib/server/*` et de la logique pure de `logic/`).

Base URL : ton déploiement Vercel (ex. `https://rabbiteam.app`).
Format : JSON. Toutes les entrées sont validées par Zod (`lib/zod-schemas.ts`).

---

## Authentification (à câbler)

Aujourd'hui le web utilise une session Supabase SSR (cookies) + RLS. Pour mobile :

1. Onboarding par **lien magique** : le bot Slack envoie en DM un lien
   `https://rabbiteam.app/join/<inviteCode>?u=<slack_user_id>`. Transforme-le en
   deep link `rabbiteam://join/...`. L'app appelle un endpoint d'échange (à ajouter)
   qui crée/retrouve la session Supabase et renvoie un **access token** + le `playerId`.
2. L'app stocke le token (expo-secure-store) et l'envoie en `Authorization: Bearer <token>`.
3. Côté serveur, la RLS Supabase continue de protéger le secret du Lapin —
   ne jamais contourner avec la service role pour des données joueur.

> Ce qui existe : `app/join/[inviteCode]/` (flux web). Ce qu'il faut ajouter :
> un `POST /api/auth/exchange` qui renvoie un token utilisable par l'app native.

---

## Modèle de données (extrait, cf. `lib/server/db-types.ts`)

```ts
Player  { id, island_id, display_name, avatar_seed, equipped, carrots, streak, last_standup, is_active }
Island  { id, name, slug, seed, timezone, is_public, invite_code }
Game    { id, island_id, week_start, status: active|voting|revealed|cancelled, result }
Item    { id, slug, name, slot, rarity, params }   // = logic/items-catalog.ts
Clue    { id, game_id, ordinal, content, revealed_at }
Vote    { game_id, voter_id, suspect_id }
```

---

## Endpoints

### ✅ Existe déjà

#### `POST /api/agent/chat` — chat avec un lapin
```jsonc
// Requête (membre connecté)
{ "slug": "<island-slug>", "playerId": "<uuid>",
  "messages": [{ "role": "user", "content": "qui est le lapin ?" }] }  // 1..14 messages, 800 car. max
// Requête (démo publique, sans login)
{ "demo": true, "name": "Margaux", "seed": "demo-rabbit-1",
  "messages": [{ "role": "user", "content": "coucou" }] }
// Réponse
{ "reply": "🐰 *remue les oreilles*…" }
```
Le lapin n'évoque que les indices **publiés** ; il ne connaît pas le secret.
Sans `ANTHROPIC_API_KEY`, renvoie un message « les lapins font la sieste ».

#### `GET /api/health` — sonde de disponibilité.
#### `GET /api/agent/ping` — vérifie que l'agent Claude est configuré.

### 🔧 À ajouter (emballages triviaux de `lib/server/*`)

> Chacun lit l'état Supabase et applique la logique pure de `logic/`. Les noms
> ci-dessous sont une proposition cohérente avec l'existant.

#### `GET /api/island/:slug` — état de l'île
```jsonc
{
  "island": { "name": "...", "slug": "...", "seed": 123456789, "timezone": "Europe/Paris" },
  "me": { "playerId": "<uuid>", "carrots": 120, "streak": 4,
          "avatarSeed": 987, "equipped": { "head": "beach_hat" },
          "standupPostedToday": false },
  "players": [ { "playerId": "<uuid>", "name": "Théo", "avatarSeed": 42,
                 "equipped": { "hand": "carrot_classic" } } ],
  "events": [ { "id": "evt-1", "type": "standup" }, { "id": "evt-2", "type": "kudo" } ],
  "islandItems": ["house_garland", "campfire"]
}
```
→ Le client appelle `buildIsland(island.seed, events, islandItems)` pour la scène,
et `deriveRabbit(avatarSeed)` par joueur pour le rendu.

#### `POST /api/standup` — poster le standup du jour
```jsonc
// Requête (cf. standupSubmissionSchema)
{ "intention": "Je finis l'écran de vote", "mood": "🚀" }
// Réponse
{ "carrots": 14, "newStreak": 3, "dropped": { "slug": "beach_hat", "rarity": "common" } | null }
```
Idempotent par jour (upsert). Utilise `standupReward` + `streakDropRarity`.

#### `GET /api/season/:slug` — saison courante
```jsonc
{
  "game": { "id": "<uuid>", "status": "active", "weekStart": "2026-06-22" },
  "clues": [ { "ordinal": 1, "content": "Le Lapin a parlé de phares…" } ],   // publiés uniquement
  "voting": { "open": false, "opensAt": "2026-06-26T11:00:00+02:00", "myVote": null,
              "tally": [ { "suspectId": "<uuid>", "count": 2 } ] },
  "iAmRabbit": false,
  "myMissions": null,   // si iAmRabbit: [{ slug, briefMd, tool, difficulty, detection, status }]
  "reveal": null        // après vendredi 16h30 : { rabbitPlayerId, result }
}
```
Ne renvoie `iAmRabbit`/`myMissions` qu'au joueur concerné ; `reveal` qu'après
la révélation (garde-fou serveur, jamais côté client).

#### `POST /api/vote` — voter (cf. voteSubmissionSchema)
```jsonc
{ "gameId": "<uuid>", "suspectPlayerId": "<uuid>" }   // → { ok: true }
```
Ouvert seulement pendant la fenêtre de vote (vendredi 11h→16h). Realtime Supabase
diffuse l'évolution du `tally`.

#### `POST /api/clue/unlock` — débloquer l'indice payant (cf. clueUnlockSchema)
```jsonc
{ "gameId": "<uuid>", "ordinal": 2 }   // coûte 30 🥕 → { content: "...", carrots: 90 }
```

#### `POST /api/equip` — équiper / déséquiper un item (cf. equipSchema)
```jsonc
{ "islandId": "<uuid>", "slot": "head", "itemSlug": "beach_hat" }   // itemSlug:null = déséquiper
// → { equipped: { "head": "beach_hat" } }
```

#### `GET /api/wardrobe/:slug` — items débloqués du joueur
```jsonc
{ "unlocked": ["beach_hat","carrot_classic"], "equipped": { "head":"beach_hat" } }
```
Le catalogue complet (verrouillés inclus) vient de `logic/items-catalog.ts`.

#### `POST /api/mission/check` — Le Lapin coche une mission « honor »
```jsonc
{ "gameMissionId": "<uuid>", "done": true }   // → { status: "done" }
```

---

## Realtime (vote du vendredi)

Le web utilise Supabase Realtime sur la table des votes. En RN, utilise
`@supabase/supabase-js` (compatible) + `expo` ; abonne-toi au canal du `gameId`
pour faire monter le compteur de votes en direct.

## Notes d'implémentation serveur

- Toute la logique métier existe déjà dans `lib/server/` (`season.ts`,
  `standup.ts`, `missions.ts`, `clues.ts`, `referrals.ts`, `rewards.ts`) et
  `lib/game-engine.ts`. Les nouveaux endpoints ne font que : (1) authentifier,
  (2) parser avec le schéma Zod correspondant, (3) appeler la fonction serveur,
  (4) renvoyer du JSON. Pas de nouvelle règle de jeu à écrire.
- Le secret du Lapin reste protégé par la RLS Postgres (`game_secrets`,
  `game_missions` sans policy de lecture). Ne jamais le renvoyer avant la
  révélation.
</content>
