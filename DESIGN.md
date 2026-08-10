# Système de design — Brief

> Source de vérité visuelle du produit. Toute décision d'UI se lit ici avant d'être codée.
> Écrit par `/design-consultation` le 9 août 2026.

## Contexte produit

- **Ce que c'est :** une app de dictée vocale. Tu parles, Whisper transcrit, un LLM découpe la note en tâches, tu relis, ça part dans Todoist.
- **Pour qui :** un utilisateur unique (Aramis), sur iPhone, en PWA installée sur l'écran d'accueil.
- **Positionnement :** filiale de Todoist. Brief ne stocke rien à long terme, il **aiguille**. Todoist reste le système de vérité des tâches.
- **Type de projet :** app mobile web (PWA), Next.js 16 / React 19 / Tailwind v4.
- **La chose mémorable :** le micro est la fonction. Tout le reste s'efface derrière lui. L'écran Tâches sert de vision globale, pas de gestionnaire.

## Direction esthétique

- **Direction :** console bento douce — la structure joyeuse des tuiles, disciplinée par une typographie sobre.
- **Niveau de décoration :** intentionnel. **Zéro ornement.** Le seul pixel non fonctionnel de l'app est le halo du micro.
- **Ambiance :** calme, dense en information, jamais bavarde. L'app doit donner l'impression d'un outil qu'on ouvre dix secondes, pas d'un espace où l'on s'installe.
- **Référence de départ :** maquette d'assistant IA type Dribbble (structure bento, lignes en pilule, bloc noir contrasté). Structure conservée, peau remplacée.
- **Recherche menée le 9 août 2026 :** [Todoist](https://www.todoist.com), [Superlist](https://www.superlist.com), [Voicenotes](https://voicenotes.com), [Granola](https://www.granola.ai).

### Le premier principe qui gouverne tout

Les concurrents traitent leur sortie comme un **document** : notes, résumé, action items en prose. Brief ne produit pas un document, il produit une **décision de routage** — quel projet, quelle date, quelle priorité.

**Conséquence directe : la couleur n'est jamais décorative.** Chaque surface teintée de l'app encode un projet Todoist. Si une teinte apparaît sans désigner une destination, c'est un bug de design.

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

De la famille du corail Todoist (`#E44332`), plus chaud et plus saturé : dit « filiale » sans une ligne de texte.

**Le corail ne sert qu'à agir.** Micro, bouton d'envoi, onglet actif, focus. Jamais pour décorer, jamais pour désigner un projet. Il reste identique en mode sombre — il tient sur les deux fonds.

### Destinations — les projets Todoist

| Nom | Fond clair | Encre claire | Fond sombre | Encre sombre |
|---|---|---|---|---|
| Lilas | `#E6E0F2` | `#4A3F63` | `#322B44` | `#C9BEE4` |
| Ardoise | `#DCE4EF` | `#37475F` | `#262F3D` | `#B4C6DE` |
| Sauge | `#DFE8DE` | `#38513E` | `#263129` | `#B3C9B6` |
| Sable | `#F0E6D6` | `#5A4830` | `#362D20` | `#DCC69E` |
| Argile | `#F3E1DA` | `#6B4034` | `#3A281F` | `#E0B7A5` |

Attribution : par nom pour les projets connus, sinon par hachage stable de l'`id` Todoist (voir `skinFor()` dans `src/lib/todoist.ts`). Un projet garde sa couleur d'une session à l'autre — c'est ce qui rend l'écran Tâches lisible sans lire les libellés.

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
- Le fond encre est délibéré : il détache l'icône sur les fonds d'écran clairs comme sombres, et évite le doublon visuel avec le carré rouge de Todoist sur le même écran d'accueil.

## Ce qu'il reste à faire côté code

Ce fichier décrit la cible. L'app ne s'y conforme pas encore.

- [ ] Remplacer les tokens de `src/app/globals.css` (palette actuelle terracotta/crème) par ceux de ce document, et ajouter le bloc mode sombre.
- [ ] Passer de `Outfit` + `JetBrains_Mono` (`next/font/google`) à `General Sans` (`next/font/local`), dans `src/app/layout.tsx`.
- [ ] Aligner `theme_color` et `background_color` de `src/app/manifest.ts` sur `#F5F3F0` (actuellement `#FAF8F5`), ainsi que `viewport.themeColor` dans `layout.tsx`.
- [ ] Remplacer les tailles arbitraires inline des six écrans par l'échelle à huit crans.
- [ ] Remplacer les rayons arbitraires (`13px`, `18px`, `22px`…) par les cinq tokens.
- [ ] `ReviewScreen` : passer de la transcription en prose à la table de tri (chaque ligne = une destination).
- [ ] `src/app/favicon.ico` date encore de l'ancienne identité — le régénérer depuis la capsule.

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
