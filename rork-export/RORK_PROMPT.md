# Prompt Rork — Rabbiteam Mobile 🐰

> Copie-colle ce document dans Rork (rork.com) pour générer l'app mobile.
> Il décrit l'app, les écrans, le design, le modèle de données et l'API.
> Les fichiers du dossier `logic/` sont à **réutiliser tels quels** : ce sont
> les règles du jeu (TypeScript pur, sans dépendance native), ce qui garantit
> que l'app mobile reste cohérente avec le web et le bot Slack existants.

---

## 1. Le concept en une phrase

Rabbiteam est un **jeu social asynchrone d'équipe** : une **île kawaii** qui
pousse avec l'activité réelle de l'équipe + une **déduction sociale
hebdomadaire** (« la Saison du Lapin ») où un coéquipier devient secrètement
*Le Lapin* et accomplit des missions discrètes pendant que les autres enquêtent.
Session quotidienne < 3 minutes.

## 2. Stack mobile demandée à Rork

- **Expo + React Native + TypeScript** (Rork par défaut).
- **expo-router** pour la navigation (tabs + écrans modaux).
- **react-native-svg** pour dessiner les lapins kawaii (voir `logic/` + section 7).
- **@tanstack/react-query** pour les appels API et le cache.
- État local léger (zustand ou contexte) — pas de Redux.
- Pas de backend à recréer : l'app **consomme l'API existante** (section 6).

> Ne PAS tenter de porter la 3D React-Three-Fiber du web. Sur mobile on dessine
> les lapins en **SVG 2D** à partir des mêmes traits (`deriveRabbit`). Plus
> simple, plus léger, identique en termes de « quel lapin pour quel seed ».

## 3. Écrans (navigation)

Onglets du bas (tab bar) :

1. **🏝️ Mon île** (`/island`) — l'écran d'accueil.
   - L'île de l'équipe avec ses lapins (chaque membre = 1 lapin SVG) et ses
     décorations (fleurs, lanternes, coquillages, monuments…).
   - Construite avec `buildIsland(seed, events)` (cf. `logic/island-builder.ts`).
   - Bandeau du haut : nom de l'île, solde de 🥕 carottes, streak du jour.
   - Bouton flottant **« Standup »** si le standup du jour n'est pas posté.
   - Tap sur un lapin → ouvre sa fiche / son chat.

2. **🥕 Standup** (modal `/standup`) — rituel quotidien 30 s.
   - 1 champ « intention du jour » (140 car. max) + 1 sélecteur d'humeur
     parmi `🙂 🚀 😴 🤯 🎉`.
   - À la validation : POST `/api/standup` → animation de récompense en carottes
     (utilise `standupReward(streakBefore)` pour afficher le calcul +bonus streak).
   - Si un item est droppé (cf. `streakDropRarity`), petite cérémonie « nouvel item ! ».

3. **🔍 La Saison** (`/season`) — le cœur déduction (visible seulement si une
   saison est active du lundi au vendredi).
   - Timeline de la semaine : lundi (départ) → indices mardi/mercredi/jeudi →
     vote vendredi 11h → révélation vendredi 16h30.
   - Liste des **indices publiés** (depuis l'API), un par un, façon cartes.
   - Vendredi : **écran de vote** — grille des coéquipiers, on désigne un suspect
     (POST `/api/vote`). Realtime : compteur de votes qui monte.
   - Révélation : animation dramatique qui dévoile Le Lapin + résultat
     (`rabbit_win` / `detectives_win` / `draw`).
   - **Si le joueur EST le Lapin** : un onglet secret « Tes missions » liste ses
     3 missions de la semaine (cf. `logic/missions-bank.ts`) avec cases à cocher
     pour les missions « honor ».

4. **💬 Chat lapin** (`/chat/[playerId]`) — discuter avec un lapin de l'île.
   - Chat IA mignon : POST `/api/agent/chat` (voir contrat section 6).
   - Le lapin distille des indices UNIQUEMENT à partir des indices publiés ;
     il ne connaît jamais le secret.

5. **🎒 Garde-robe** (`/wardrobe`) — habiller son lapin.
   - Grille d'items débloqués par slot (`head, face, neck, hand, aura`),
     source : `logic/items-catalog.ts`.
   - Équiper / déséquiper (POST `/api/equip`) avec aperçu live du lapin SVG.
   - Items verrouillés grisés avec leur `unlockHint`.

6. **👤 Profil / réglages** (`/profile`) — nom, notifications, plan, déconnexion.

### Onboarding (hors tabs)
- **Lien magique** : l'utilisateur arrive via un deep link `rabbiteam://join/<code>`
  (le bot Slack envoie ce lien en DM). L'app échange le code contre une session.
- Écran « découvre ton lapin » : révèle le lapin SVG dérivé de l'`avatar_seed`.

## 4. Boucle de jeu (rythme de la semaine)

`logic/game-engine.ts` encode tout le timing dans `dueActions(weekday, hour, minute)` :

| Quand | Événement |
|---|---|
| Lundi 9h | Début de saison, Le Lapin est tiré secrètement |
| Tous les jours 9h30 | Rappel de standup |
| Mardi 10h | Indice #1 publié |
| Mercredi 10h | Indice payant (30 🥕) déblocable |
| Jeudi 15h | Indice #3 publié |
| Vendredi 11h | Ouverture du vote |
| Vendredi 16h | Clôture + scoring |
| Vendredi 16h30 | **Révélation** |

L'app mobile **n'orchestre pas** ce timing (c'est le cron serveur) : elle lit
l'état courant via l'API et affiche l'écran correspondant. `dueActions` te sert
surtout à comprendre/afficher la timeline.

## 5. Règles non négociables (à respecter dans l'UI)

- **Aucune métrique de productivité individuelle** n'est jamais affichée.
- Le **secret du Lapin** n'est jamais côté client : l'app ne reçoit l'identité
  du Lapin que dans la réponse de révélation, après vendredi 16h30.
- Le chat lapin et les indices ne fuitent jamais le secret (garanti côté serveur).

## 6. Contrat d'API (voir `API.md` pour le détail complet)

Base URL = ton déploiement web existant (Vercel), ex. `https://rabbiteam.app`.
L'app mobile appelle ces endpoints en JSON. Auth via token de session
(à ajouter côté serveur — voir note dans `API.md`).

Endpoints clés :
- `GET  /api/island/:slug` → état de l'île (seed, events, lapins, items, carottes…)
- `POST /api/standup` → `{ intention, mood }` → récompense
- `GET  /api/season/:slug` → saison courante (statut, indices publiés, fenêtre de vote)
- `POST /api/vote` → `{ gameId, suspectPlayerId }`
- `POST /api/clue/unlock` → `{ gameId, ordinal }` (indice payant)
- `POST /api/equip` → `{ islandId, slot, itemSlug|null }`
- `POST /api/agent/chat` → chat lapin (déjà implémenté côté web, voir ci-dessous)

> ⚠️ Le backend web actuel est piloté par Slack et le rendu SSR. Plusieurs de ces
> endpoints REST « mobile » doivent être **ajoutés** côté serveur (ils sont triviaux :
> ils enveloppent la logique `lib/server/*` déjà existante). `API.md` liste
> précisément ce qui existe vs. ce qu'il reste à exposer.

### `/api/agent/chat` (déjà en prod)
```jsonc
// Requête (membre connecté)
{ "slug": "ile-de-lequipe", "playerId": "<uuid>", "messages": [{ "role": "user", "content": "coucou" }] }
// Réponse
{ "reply": "🐰 *remue les oreilles*…" }
```

## 7. Rendu du lapin (le détail visuel le plus important)

Chaque lapin est **100% procédural** : `deriveRabbit(avatarSeed)` →
`{ bodyColor, bellyColor, earStyle, earInner, eyeStyle, cheeks, tailStyle, sizeJitter }`.
Même seed → même lapin, partout (web, Slack, mobile). **Ne jamais réordonner les
tirages dans `rabbit-traits.ts`** (ça changerait tous les lapins existants).

Construis un composant `<RabbitSvg traits={...} equipped={...} size={...} />` en
`react-native-svg` qui dessine :
- corps + ventre (ellipses), 2 oreilles selon `earStyle`
  (`straight, lop, one_folded, short, giant, twisted`), intérieur d'oreille `earInner`,
- yeux selon `eyeStyle` (`round, star, sleepy, sparkly, happy, monocle_wink, hypno`),
- joues selon `cheeks` (`pink, peach, freckles, none`), petite queue `tailStyle`.
- Les items équipés (chapeau, lunettes, écharpe, objet en main, aura) se dessinent
  par-dessus selon `slot` + `params` de `items-catalog.ts`.

Garde un style **kawaii pastel** (palette section 8), contours doux, têtes rondes.

## 8. Design system (extrait du code web)

- Esthétique : **kawaii, pastel, plage/île, chaleureux**. Coins très arrondis,
  ombres douces, micro-animations (react-native-reanimated).
- Police titres : serif douce (équivalent « Source Serif »). Corps : sans-serif système.
- Palette lapins (pondérée, cf. `rabbit-traits.ts`) : crème `#F7F4EF`, beige `#EBD8C3`,
  lavande `#D9C7F2`, rose dragée `#F6C6D8`, bleu ciel `#C8E6F5`, menthe `#CDEBD3`,
  vanille `#F5E3B3`, abricot `#E8B89B`, corail `#F2A9A0`, nuit `#52465E` (rare).
- Accents : carotte orange `#FF8C42`, corail `#FF8C7A`, or `#F2C14E`, turquoise `#7ED6DF`.
- Voir `design-system.md` pour la liste complète.

## 9. Comment utiliser les fichiers `logic/`

Copie le dossier `logic/` dans `src/logic/` (ou `lib/`) du projet Expo. Ils ne
dépendent que les uns des autres (imports relatifs) et de `zod` (uniquement pour
des types, optionnel). **Aucune dépendance DOM/Node** → 100% compatible RN.

Imports utiles :
```ts
import { deriveRabbit } from "@/logic/rabbit-traits";
import { buildIsland } from "@/logic/island-builder";
import { standupReward, scoreSeason, dueActions, streakDropRarity } from "@/logic/game-engine";
import { ITEMS_CATALOG, itemsByRarity } from "@/logic/items-catalog";
import { MISSIONS_BANK } from "@/logic/missions-bank";
import { DEMO_SEED, demoIslandEvents, DEMO_RABBITS } from "@/logic/demo-island";
```

## 10. Mode démo (pour tester sans backend)

Pour démarrer sans serveur, utilise les données de `logic/demo-island.ts`
(`DEMO_SEED`, `demoIslandEvents()`, `DEMO_RABBITS`) afin d'afficher une île
peuplée et jouable hors-ligne. Branche le vrai backend ensuite.

---

**Objectif Rork** : générer une app Expo polie, kawaii et fluide, qui réutilise
ces règles de jeu telles quelles et consomme l'API ci-dessus. Commence par
l'écran « Mon île » en mode démo, puis le standup, puis la saison/vote.
</content>
</invoke>
