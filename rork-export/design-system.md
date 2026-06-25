# Design system — Rabbiteam Mobile 🐰🏝️

Esthétique : **kawaii, pastel, plage / île tropicale, chaleureux et doux**.
Coins très arrondis, ombres légères, micro-animations. Tout dérive d'un seed,
rien n'est « dur » ou anguleux.

## Palette

### Corps des lapins (pondérée — `logic/rabbit-traits.ts`)
| Hex | Nom |
|---|---|
| `#F7F4EF` | crème |
| `#EBD8C3` | beige sable |
| `#D9C7F2` | lavande |
| `#F6C6D8` | rose dragée |
| `#C8E6F5` | bleu ciel |
| `#CDEBD3` | menthe |
| `#F5E3B3` | vanille |
| `#E8B89B` | abricot |
| `#BFC9D9` | gris bleuté |
| `#F2A9A0` | corail doux |
| `#B79BD9` | violet |
| `#9FD8CB` | turquoise pâle |
| `#8E7C6D` | chocolat au lait |
| `#52465E` | nuit (rare) |

### Ventres / intérieurs d'oreilles
Crèmes et pastels très clairs : `#FFFDF8`, `#FBF0E1`, `#FCE8EE`, `#EAF6FB`,
`#EDF8EF`, `#FFF3CF`, `#F3EAFB`, `#FFE3D6` (ventre) ; `#FCD7E2`, `#FFE9D6`,
`#F6E6F9`, `#E4F2F9`, `#FFF4DA`, `#E9F7EC` (intérieur d'oreille).

### Accents UI
| Hex | Usage |
|---|---|
| `#FF8C42` | carotte (monnaie, CTA principal) |
| `#FF8C7A` | corail (boutons secondaires, bandeaux) |
| `#F2C14E` | or (rareté légendaire, récompenses) |
| `#7ED6DF` | turquoise (eau, accents frais) |
| `#FFE9A0` | lueur dorée (halo, étoiles) |
| `#52465E` | encre / texte foncé |

## Typographie
- **Titres** : serif douce et arrondie (le web utilise « Source Serif 4 »).
  En Expo : `expo-font` avec une serif équivalente (ex. Fraunces / Source Serif).
- **Corps** : sans-serif système (San Francisco / Roboto).

## Raretés (couleurs de bordure des items)
`common` gris doux · `uncommon` vert menthe · `rare` bleu · `epic` violet ·
`legendary` or `#F2C14E` avec lueur. Items verrouillés : grisés + cadenas + `unlockHint`.

## Composants clés à créer
- `<RabbitSvg traits equipped size />` — le lapin kawaii en react-native-svg.
- `<IslandScene descriptor />` — l'île 2D top-down/iso depuis `buildIsland(...)`
  (palmiers, buissons, décorations placées en polaire angle+rayon).
- `<CarrotBadge count />`, `<StreakFlame days />` — bandeau d'en-tête.
- `<ClueCard ordinal content />`, `<VoteGrid players />`, `<RevealCeremony />`.
- `<MoodPicker />` — `🙂 🚀 😴 🤯 🎉`.

## Animations (react-native-reanimated)
- Lapins : léger flottement / respiration (boucle douce).
- Récompense de standup : carottes qui jaillissent + compteur qui s'incrémente.
- Révélation du vendredi : zoom dramatique sur le lapin démasqué, confettis pastel.
- Drop d'item : petite carte qui se retourne.

## Ton & langue
Bilingue **français / anglais** (l'app et le chat lapin répondent dans la langue
du joueur). Voix : chaleureuse, joueuse, mignonne, jamais corporate. Jamais de
métrique de productivité individuelle affichée.
</content>
