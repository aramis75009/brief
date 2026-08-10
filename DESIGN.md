# Système de design — Brief

> Source de vérité visuelle du produit. Toute décision d'UI se lit ici avant d'être codée.
> Écrit par `/design-consultation` le 9 août 2026.

## Contexte produit

- **Ce que c'est :** un organiseur personnel piloté à la voix. Tu parles, Whisper transcrit, un LLM découpe la note en tâches et rendez-vous datés, tu relis, Brief les garde et te les rappelle.
- **Pour qui :** un utilisateur unique (Aramis), sur iPhone, en PWA installée sur l'écran d'accueil.
- **Positionnement :** Brief **possède ses données**, sur un VPS auto-hébergé. Il n'aiguille plus vers un service tiers et n'a donc aucun plafond de projets. C'est lui le système de vérité.
- **Type de projet :** app mobile web (PWA), Next.js 16 / React 19 / Tailwind v4.
- **La chose mémorable :** « Je parle, c'est rangé. » Le micro est le héros, tout le reste s'efface.
- **Ce que Brief fait et que personne d'autre ne fait :** la **vision globale de charge inter-projets**. Les listes de tâches montrent des tâches ; l'onglet Vision montre **ce qui déborde**. C'est le seul écran qui justifie d'ouvrir l'app après avoir dicté.

## Direction esthétique

- **Direction :** console bento douce — la structure joyeuse des tuiles, disciplinée par une typographie sobre.
- **Niveau de décoration :** intentionnel. **Zéro ornement.** Le seul pixel non fonctionnel de l'app est le halo du micro.
- **Ambiance :** calme, dense en information, jamais bavarde. L'app doit donner l'impression d'un outil qu'on ouvre dix secondes, pas d'un espace où l'on s'installe.
- **Référence de départ :** maquette d'assistant IA type Dribbble (structure bento, lignes en pilule, bloc noir contrasté). Structure conservée, peau remplacée.
- **Recherche menée le 9 août 2026 :** [Todoist](https://www.todoist.com), [Superlist](https://www.superlist.com), [Voicenotes](https://voicenotes.com), [Granola](https://www.granola.ai).

### Le premier principe qui gouverne tout

Les concurrents traitent leur sortie comme un **document** : notes, résumé, action items en prose. Brief ne produit pas un document, il produit une **décision de routage** — quel projet, quelle date, quelle priorité.

**Conséquence directe : la couleur n'est jamais décorative.** Chaque surface teintée de l'app encode un projet. Si une teinte apparaît sans désigner une destination, c'est un bug de design.

## Typographie

- **Famille unique : General Sans** (Fontshare) — géométrique-humaniste. Choisie parce qu'elle a la rondeur de la référence sans ses ouvertures molles : elle reste lisible à 13 px sur mobile, ce que Poppins ne fait pas.
- **Pas de police mono.** JetBrains Mono est supprimée : une police de moins à charger sur une app qu'on ouvre pour gagner dix secondes. Les chiffres utilisent `font-variant-numeric: tabular-nums`.
- **Chargement :** `next/font/local` avec les `.woff2` Fontshare (400, 500, 600, 700) déposés dans `src/app/fonts/`. **Pas** `next/font/google` — General Sans n'y est pas.

### Échelle — huit crans, pas un de plus

| px | poids | interlettrage | usage |
|---:|---|---|---|
| 56 | 600 | −2.4 | le chiffre du jour, une seule occurrence par écran |
| 40 | 600 | −1.1 | titre d'écran héroïque |
| 27 | 600 | −0.7 | titre d'écran standard (`Brief`, `Revue`, `Tâches`) |
| 21 | 600 | −0.3 | titre de section, nom de projet en tête de groupe |
| 17 | 400 | 0 | corps, transcription |
| 15 | 500 | 0 | libellé de bouton, titre de tâche |
| 13 | 500 | 0 | métadonnée, sous-titre, indice sous le micro |
| 11 | 600 | +1.2, capitales | étiquette de section (`TRANSCRIPTION`, `AJOUTER`) |

Toute taille hors de cette liste est une erreur. L'app actuelle en compte plus de vingt (`13.5px`, `12.5px`, `11.5px`, `10.5px`…) : c'est la dette que ce fichier existe pour effacer.

## Couleur

**Approche : une action, cinq destinations.**

### Encre et fonds

| Token | Clair | Sombre | Rôle |
|---|---|---|---|
| `--page` | `#F5F3F0` | `#0F0E0D` | fond de page |
| `--tile` | `#FFFFFF` | `#1C1A19` | surface des cartes et tuiles |
| `--ink` | `#131211` | `#F2F0ED` | texte principal, bloc structurel |
| `--ink-2` | `#5C5852` | `#A29D96` | texte secondaire |
| `--ink-3` | `#94908A` | `#706B65` | texte tertiaire, placeholder |
| `--line` | `rgba(19,18,17,.08)` | `rgba(242,240,237,.10)` | bordure de carte |
| `--line-2` | `rgba(19,18,17,.14)` | `rgba(242,240,237,.18)` | bordure de champ |

### Action

`--action: #EC5230` · `--action-lo: #FDEAE4` (sombre : `#3A1D14`)

**Justification réécrite le 10 août 2026.** L'ancienne — « de la famille du corail Todoist, dit filiale sans une ligne de texte » — n'a plus d'objet : il n'y a plus de maison mère. La valeur ne change pas pour autant, et la raison est meilleure : c'est **la seule couleur saturée du système**, et aucune teinte de destination ne s'en approche. Le corail ne peut donc jamais être confondu avec un projet.

**Le corail ne sert qu'à agir.** Micro, bouton d'envoi, onglet actif, focus. Jamais pour décorer, jamais pour désigner un projet. Il reste identique en mode sombre — il tient sur les deux fonds.

### Destinations — les projets

| Nom | Var | Fond clair | Encre claire | Fond sombre | Encre sombre |
|---|---|---|---|---|---|
| Lilas | `p1` | `#E6E0F2` | `#4A3F63` | `#322B44` | `#C9BEE4` |
| Ardoise | `p2` | `#DCE4EF` | `#37475F` | `#262F3D` | `#B4C6DE` |
| Sauge | `p3` | `#DFE8DE` | `#38513E` | `#263129` | `#B3C9B6` |
| Sable | `p4` | `#F0E6D6` | `#5A4830` | `#362D20` | `#DCC69E` |
| Argile | `p5` | `#F3E1DA` | `#6B4034` | `#3A281F` | `#E0B7A5` |
| Acier | `p6` | `#E3E6EB` | `#414A54` | `#2A2E33` | `#C0C7D0` |
| Lin | `p7` | `#EDE6E0` | `#5B4C42` | `#302823` | `#D6C4B8` |
| Glacier | `p8` | `#E0E9EC` | `#33505A` | `#223034` | `#AFCBD3` |

**Justification réécrite le 10 août 2026.** L'ancienne — « cinq teintes parce que le plan gratuit plafonne à cinq projets » — était caduque et en contradiction directe avec « aucun plafond ». Elle est remplacée par un couple à deux dimensions.

### Formes — la seconde dimension d'une destination

`disc` · `square` · `diamond` · `ring` · `capsule`

Huit teintes ne suffisaient pas à un nombre de projets non plafonné, et en inventer une neuvième aurait produit des couleurs qu'on ne distingue pas. La **forme** coûte 8 px et se lit **sans couleur** — donc aussi en mode sombre, où les teintes se rapprochent, et pour un œil daltonien.

**8 teintes × 5 formes = 40 destinations distinguables** avant la moindre répétition. Au-delà, la teinte cycle et la forme change, jamais les deux en même temps.

Attribution : teinte et forme explicites pour les projets d'amorçage, sinon dérivées d'un **hachage stable de l'`id`** — la teinte au rang bas, la forme au rang supérieur, pour qu'elles ne changent jamais ensemble. Voir `skinFor()` et `shapeFor()` dans `src/lib/projects.ts`. Un projet garde son couple d'une session à l'autre : c'est le couple qu'on apprend à reconnaître, pas le libellé.

### Le quatrième état : « en attente d'envoi »

Un item dicté hors ligne n'est pas encore enregistré. Le sémantique n'a que `ok` / `warn` / `error` — et **on n'ajoute pas une quatrième couleur**. L'attente n'est pas un jugement, c'est une **absence** : la ligne n'a pas encore de fond parce qu'elle n'a pas encore de place sur le serveur.

Trois signaux cumulés, dont deux survivent au daltonisme et au mode sombre :

- **contour pointillé** (`1.5px dashed --ink-3`),
- **pas de surface**,
- **pas d'ombre**.

Un bandeau en tête de l'écran Tâches ne disparaît qu'à l'**envoi confirmé par le serveur**. C'est la seule chose entre une note dictée et une note perdue : Safari peut évincer le stockage local sans prévenir.

### `--error-on-ink: #E8836A`

Identique dans les deux thèmes, et **jamais redéclaré**. `--error` (`#B23A22`) posé sur un bloc `--ink` donne 1,9:1 : illisible. Même piège que les touches du pavé PIN — une couleur pensée pour un fond clair, posée sur un fond sombre.

### Sémantique

`--ok: #3F6B4A` · `--warn: #9C6F22` · `--error: #B23A22`
(sombre : `#7FAE87` · `#C9A055` · `#E07C5E`)

### Mode sombre

Redessiner les surfaces, ne pas inverser. Les teintes de destination sont désaturées d'environ 35 % et assombries, l'encre devient le fond. Le corail d'action ne change pas.

## Espacement

- **Base :** 4 px. **Densité :** confortable.
- **Échelle :** `4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 56 · 72`
- **Gouttière mobile :** 20 px. **Écart entre tuiles :** 10 px. **Entre lignes de liste :** 9 px.

## Mise en page

- **Approche :** grille disciplinée, composition bento.
- **Grille mobile :** 2 colonnes, gouttière 20 px. La tuile héroïque occupe les 2 colonnes.
- **Largeur de contenu :** 430 px maximum (au-delà, le cadre iPhone dessiné prend le relais).

### Rayons — une hiérarchie, pas une bulle uniforme

| Token | Valeur | Usage |
|---|---|---|
| `--r-chip` | 10 px | chip projet, badge |
| `--r-field` | 14 px | champ, petit bouton, segmenté |
| `--r-row` | 20 px | ligne de liste, carte |
| `--r-tile` | 28 px | tuile bento |
| `--r-pill` | 999 px | pilule, micro, avatar |

**Règle : le rayon grandit avec l'élément.** C'est précisément ce qui empêche le rendu « tout est un bonbon » des maquettes bento génériques.

### Élévation — trois niveaux, pas plus

- `e0` : aucune ombre, bordure `--line` seule.
- `e1` : `0 1px 2px rgba(19,18,17,.06), 0 4px 12px -8px rgba(19,18,17,.18)` — cartes, lignes.
- `e2` : `0 12px 32px -16px rgba(19,18,17,.35)` — feuilles modales.
- **Ombre colorée :** réservée au micro — `0 12px 28px -12px rgba(236,82,48,.55)`.

## Mouvement

- **Approche :** intentionnel.
- **Durées :** micro 90 ms (couleur, survol) · court 180 ms (état, appui) · moyen 260 ms (feuille, écran).
- **Courbes :** entrée `cubic-bezier(.22, 1, .36, 1)` · sortie `cubic-bezier(.4, 0, 1, 1)`.
- **Retour d'appui :** `scale(.985)`.
- **Une seule animation en boucle dans toute l'app : le halo du micro.** Tout le reste est one-shot.
- `prefers-reduced-motion: reduce` neutralise tout, y compris le halo.

## Icône et identité

L'icône est **l'état d'enregistrement de Brief** : les barres de niveau audio que `CaptureScreen` dessine déjà dans le bouton micro, sorties du bouton. Volontairement pas le pictogramme de micro blanc sur carré coloré — c'est l'icône de Dictaphone, d'Otter et de toutes les apps de dictée.

**Trois barres corail sur fond encre.** Le nombre impair donne un centre. Les barres épaisses survivent à 60 px et à 32 px, ce que ni les anneaux ni quatre barres fines ne font.

### Source (512 × 512)

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#131211"/>
  <g fill="#EC5230">
    <rect x="150" y="196" width="58" height="120" rx="29"/>
    <rect x="227" y="128" width="58" height="256" rx="29"/>
    <rect x="304" y="176" width="58" height="160" rx="29"/>
  </g>
</svg>
```

### Déclinaisons livrées

| Fichier | Taille | Contenu |
|---|---|---|
| `public/icon-512.png` | 512 | trois barres, plein cadre |
| `public/icon-192.png` | 192 | idem |
| `public/apple-touch-icon.png` | 180 | idem |
| `public/icon-maskable-512.png` | 512 | contenu ramené à 84 % pour la zone sûre circulaire Android |
| `public/favicon-32.png` | 32 | **capsule seule** — le signe se simplifie sous 48 px |

### Règles

- **Carré plein, sans transparence, sans coins pré-arrondis.** iOS applique son propre masque : un PNG déjà arrondi produit un liseré.
- **Zone sûre maskable :** le contenu doit tenir dans un cercle de 80 % du canevas. La version `maskable` respecte cette contrainte, la version `any` non (et c'est normal).
- **Sous 48 px, le signe se simplifie** en capsule unique. Trois barres à 16 px deviennent une tache.
- **Justification réécrite le 10 août 2026.** L'ancienne — « évite le doublon visuel avec le carré rouge de Todoist sur le même écran d'accueil » — n'a plus d'objet. La nouvelle : le fond encre tient sur un fond d'écran clair comme sombre, et les trois barres restent le seul signe qui dit « niveau audio » plutôt que « dictaphone ». La forme ne change pas.
- Dans l'app, le bloc de marque utilise `--brand-block` et **non** `--color-ink` : l'encre s'éclaircit en mode sombre, ce qui donnerait un carré blanc sur une page noire. Un filet `--line-2` lui rend sa silhouette en sombre, où le bloc et la page sont deux noirs voisins.

## Deux pièges Tailwind v4 à ne pas réintroduire

Constatés sur le CSS **compilé** le 10 août 2026, pas déduits de la source.

1. **`@theme` ne fonctionne pas dans une media query.** Un `@theme` imbriqué dans `@media (prefers-color-scheme: dark)` est aplati : ses variables sont hissées dans l'unique `@layer theme :root`, la condition disparaît, et les valeurs sombres s'appliquent en permanence. L'app n'avait aucun thème clair compilé. Les surcharges sombres vivent donc dans un `:root` ordinaire, hors `@layer` — du CSS non-layered l'emporte sur toutes les couches.
2. **`@theme static` est obligatoire.** Sans `static`, Tailwind n'émet que les variables qu'il voit référencées dans le source. Les teintes sont construites par interpolation — `var(--color-p${tint})` — invisible au scanner. Résultat mesuré : seules `p2`, `p3` et `p4` étaient émises, et la puce de l'Inbox (teinte 5) était transparente.

## Ce qu'il reste à faire côté code

- [ ] `src/app/favicon.ico` date encore de l'ancienne identité — le régénérer depuis la capsule.
- [ ] `docs/designs/preview-systeme.html` montre encore cinq teintes et pas de formes.
- [ ] La Vision n'a pas d'état « une seule journée chargée » distinct : avec un seul projet, l'horizon reste lisible mais le bloc « ton mur » énonce une évidence.

## Journal des décisions

| Date | Décision | Raison |
|---|---|---|
| 2026-08-09 | Système initial créé | `/design-consultation`, après recherche visuelle sur Todoist, Superlist, Voicenotes, Granola |
| 2026-08-09 | Structure bento reprise d'une référence Dribbble, palette remplacée | Le duo lavande + jaune beurre est le défaut des générateurs d'UI 2026 ; aucun produit livré du domaine ne l'utilise |
| 2026-08-09 | La couleur devient sémantique (une teinte = un projet Todoist) | Brief produit une décision de routage, pas un document : la couleur doit porter la destination |
| 2026-08-09 | Famille typographique unique, mono supprimée | Poids réseau sur une PWA ouverte dix secondes ; la hiérarchie passe par la taille et le poids |
| 2026-08-09 | Corail `#EC5230` de la famille Todoist | Dit la filiation sans texte |
| 2026-08-09 | Icône = barres de niveau audio, pas pictogramme de micro | Le micro blanc sur carré coloré est l'icône générique de la catégorie ; les barres sont propres à Brief |
| 2026-08-09 | Rayons hiérarchisés au lieu d'uniformes | Empêche le rendu « bonbon » des maquettes bento génériques |
| 2026-08-10 | Brief quitte Todoist et possède ses données | Todoist a sorti la même chaîne en natif ; sans service tiers, plus aucun plafond de projets |
| 2026-08-10 | Trois justifications réécrites (corail, icône, cinq teintes) | Elles étaient adossées à une maison mère qui n'existe plus. Deux valeurs survivent avec une meilleure raison, la troisième est remplacée |
| 2026-08-10 | Destination = teinte **+ forme**, 8 × 5 = 40 couples | Cinq teintes venaient du plafond de cinq projets ; inventer des teintes supplémentaires les rendrait indistinctes |
| 2026-08-10 | 4ᵉ état « en attente » sans couleur sémantique | Une 4ᵉ pastille aurait mis l'attente au même rang qu'« enregistré » ; l'attente est une absence, dite par le pointillé |
| 2026-08-10 | Quatrième onglet : Vision | La charge inter-projets n'était nulle part, et c'est la seule raison d'ouvrir l'app après avoir dicté |
| 2026-08-10 | Vision livre **deux** représentations (Charge / Horizon) | Elles répondent à deux questions distinctes et sortent du même appel ; Charge par défaut, la question du matin est « qu'est-ce que je laisse tomber » |
| 2026-08-10 | Touche du pavé PIN : contour au lieu de surface | `--tile` sur `--page` en sombre donne 1,1:1 — les touches étaient invisibles |
