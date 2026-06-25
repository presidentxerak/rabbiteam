# Export Rork — Rabbiteam Mobile 🐰

Cet export te permet de générer l'app **mobile** Rabbiteam dans
[Rork](https://rork.com) (Expo + React Native), en réutilisant les **vraies
règles du jeu** déjà écrites pour le web et Slack. Aucune logique de jeu n'est
réinventée : l'app mobile consomme le backend existant et partage le code pur.

> Pourquoi un export et pas « importer le repo » ? Le projet web est un
> **Next.js** (rendu serveur, 3D React-Three-Fiber, intégrations Slack/Stripe/
> Supabase). Rork construit des apps **Expo/React Native** : on ne peut pas y
> coller un projet Next.js. Ce qui se transporte, c'est (1) la logique de jeu
> pure, (2) une spec claire, (3) le contrat d'API. C'est exactement ce dossier.

## Contenu

| Fichier | Rôle |
|---|---|
| **`RORK_PROMPT.md`** | 👉 **Le prompt à coller dans Rork.** Concept, écrans, navigation, boucle de jeu, design, comment réutiliser `logic/`. |
| `API.md` | Contrat d'API : endpoints existants vs. à ajouter côté serveur. |
| `design-system.md` | Palette, typo, composants, animations, ton. |
| `logic/` | La **logique de jeu portable** (TypeScript pur, 0 dépendance native). À copier dans le projet Expo. |

### `logic/` — réutilisable tel quel en React Native
| Fichier | Contenu |
|---|---|
| `prng.ts` | PRNG déterministe (mulberry32) + hash de seed. La base de tout le procédural. |
| `rabbit-traits.ts` | `deriveRabbit(seed)` → traits du lapin kawaii. **Ordre des tirages = contrat, ne pas réordonner.** |
| `island-builder.ts` | `buildIsland(seed, events)` → descripteur de scène déterministe. |
| `game-engine.ts` | Règles pures : sélection du Lapin, scoring, carottes/streaks, `dueActions` (timing de la semaine), limites de plan. |
| `items-catalog.ts` | ~42 items (chapeaux, lunettes, auras, items d'île) avec slot/rareté/params. |
| `missions-bank.ts` | ~60 missions du Lapin (brief, outil, difficulté, détection). |
| `demo-island.ts` | Données de démo pour faire tourner l'app **sans backend**. |

Ces fichiers n'importent que les uns les autres (imports relatifs) et,
ponctuellement, `zod` pour des types. **Aucun accès DOM/Node** → compatibles RN.

## Comment l'utiliser dans Rork

1. Ouvre [Rork](https://rork.com) et crée un nouveau projet d'app mobile.
2. Colle le contenu de **`RORK_PROMPT.md`** comme brief principal.
3. Ajoute en contexte `API.md` et `design-system.md` (ou résume-les dans le chat).
4. Copie le dossier `logic/` dans le projet généré (`src/logic/` ou `lib/`) et
   demande à Rork de **réutiliser ces fichiers** plutôt que d'en réécrire les règles.
5. Démarre par l'écran **« Mon île » en mode démo** (via `demo-island.ts`),
   puis le standup, puis la saison/vote. Branche le vrai backend ensuite (`API.md`).

## Côté backend (à prévoir)

L'app a besoin de quelques endpoints REST « mobile » qui n'existent pas encore
(le web étant piloté par Slack + SSR). Ils sont triviaux : ils emballent
`lib/server/*` déjà écrit. La liste exacte (et ce qui existe déjà, comme
`POST /api/agent/chat`) est dans **`API.md`**. À ajouter aussi : un échange de
**lien magique → token** pour l'auth native.

## Garde-fous à ne pas casser

- Le **secret du Lapin** reste côté serveur (RLS Postgres) — l'app ne l'apprend
  qu'à la révélation du vendredi 16h30.
- **Aucune métrique de productivité individuelle** affichée.
- Ne jamais réordonner les tirages de `rabbit-traits.ts` (changerait tous les
  lapins déjà existants chez les utilisateurs).
</content>
