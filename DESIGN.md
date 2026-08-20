# DESIGN.md — Claude Design v1

Ce fichier décrit le système visuel **qui tourne en production**, tel qu'il est
implémenté dans `src/app/globals.css` et `src/components/`. Il ne propose rien :
il constate. Si le code et ce fichier divergent, l'un des deux est en faute et il
faut trancher, pas contourner.

⚠️ **Ce n'est pas l'ancien `DESIGN.md`.** Celui-là décrivait un système abandonné
(General Sans, corail, 8 teintes × 5 formes de projet) et a été supprimé le
20/08/2026. Rien de ce qui suit n'en vient. Une seule règle en a survécu, parce
qu'elle est dans les types et dans le code : *une teinte désigne, elle ne décore
jamais*.

Source de vérité du rendu : le fichier de design system
`Brief Design System.dc.html` + `globals.css`. Les valeurs ci-dessous sont
extraites du code, pas de maquettes.

---

## 1. Le principe

**Une action, trois destinations.**

L'encre `#101010` porte **tout** ce qui agit : le FAB, le bouton de dictée, les
boutons primaires, les coches, les libellés forts. Les trois teintes de
destination ne servent qu'à dire **ce que devient une note dictée** — une tâche,
un rendez-vous, une idée. Une couleur n'est jamais décorative, jamais un accent
de marque, jamais un dégradé.

Conséquence pratique : sur un écran de Brief, il n'y a **qu'un seul endroit
noir cliquable qui compte**. Si deux éléments se disputent l'encre, l'un des
deux n'est pas une action.

---

## 2. Tokens

Tous déclarés dans `@theme static` (`globals.css`). Le `static` est obligatoire :
sans lui, Tailwind v4 n'émet que les variables qu'il voit référencées, et les
couleurs de destination — construites par interpolation — disparaissent.

### Fonds et encre

| Token | Valeur | Emploi |
|---|---|---|
| `--color-bg` | `#F4F4F2` | fond de page, fond des états actifs de nav |
| `--color-surface` | `#FFFFFF` | cartes, feuilles, barres, pastilles d'icône |
| `--color-ink` | `#101010` | texte principal, **toutes** les actions |
| `--color-ink-muted` | `#8A8A84` | métadonnées, sous-titres, corps secondaire |
| `--color-ink-faint` | `#A9A9A2` | texte barré/terminé, week-end, libellés mono |

### Destinations

| Token | Valeur | Sens |
|---|---|---|
| `--color-task-100` / `-700` | `#CFE0FF` / `#1F4FA8` | tâche (VTODO) |
| `--color-meet-100` / `-700` | `#CBE9D6` / `#1F6B45` | rendez-vous (VEVENT) |
| `--color-idea-100` / `-700` | `#FBE2AE` / `#8A5A10` | idée non triée |

Le `100` est un fond, le `700` un texte ou un filet sur ce fond. Jamais
l'inverse : `700` sur `bg` passe le contraste, `100` sur blanc ne le passe pas.

### Sémantique

| Token | Valeur | Emploi |
|---|---|---|
| `--color-danger` | `#E23A2E` | retard, suppression, enregistrement en cours |

Une seule couleur de danger. Pas de vert « succès » : la coche noire suffit, et
le vert est déjà pris par les rendez-vous.

### Filets

Écrits à la main, pas en tokens de couleur, parce qu'ils sont des opacités
d'encre : `--hairline` `rgba(16,16,16,.06)`, `--hairline-2` `.08`,
`--hairline-3` `.07`. Deux autres valeurs circulent dans les composants et sont
volontaires : `.18` (bordure de coche, 2 px) et `.12` (bouton secondaire).

### Rayons

Le rayon grandit avec l'élément — c'est la règle, pas un goût.

`8` puce/pastille · `12` bloc dans une carte · `18` carte interne, brouillon ·
`20` carte de liste, section · `24` tuile de destination · `30` haut de feuille
modale · `99px` tout ce qui est pilule (bouton, chip, avatar, coche).

### Typographie

Deux familles, chargées par `next/font/google` (`layout.tsx`) :

- **Plus Jakarta Sans** — `400 500 600 700 800`, toute l'interface.
- **JetBrains Mono** — `400 500`, uniquement les micro-libellés de section.

Échelle : `10 11 12 13 15 17 20 22 28 34`. **Huit crans utiles, pas un de plus** —
un `14.5` ou un `13.5` qui apparaît dans un composant est une dette, pas une
nuance.

| Rôle | Taille / graisse | Interlettrage |
|---|---|---|
| Titre d'accueil | 34 / 800 | `-0.03em` |
| Titre de fiche | 28 / 800 | `-0.03em` |
| Titre de section, de feuille | 20 / 700–800 | `-0.02em` |
| Libellé de tuile | 17 / 700 | `-0.02em` |
| Ligne de liste | 15 / 600 | `-0.01em` |
| Métadonnée, sous-titre | 13 / 500–700 | — |
| Chip | 12 / 700 | — |
| Libellé mono de section | 10 / 400 **capitales** | `0.09em` |

Les chiffres alignés (heures, compteurs) portent `.tnum`
(`font-variant-numeric: tabular-nums`). Sans ça une liste d'heures tremble au
scroll.

### Ombres

| Token | Valeur | Emploi |
|---|---|---|
| `--shadow-card` | `0 6px 20px rgba(16,16,16,.07)` | carte détachée |
| `--shadow-nav` | `0 10px 28px rgba(16,16,16,.1)` | barre de navigation flottante |
| `--shadow-fab` | `0 8px 20px rgba(16,16,16,.28)` | FAB `+` |
| `--shadow-mic` | `0 12px 30px rgba(16,16,16,.26)` | gros bouton micro |

Une ombre marque **ce qui flotte au-dessus du contenu**. Une carte posée dans le
flux prend un filet `1px`, pas une ombre.

### Mouvement

Déclarés en `--animate-*` + `@keyframes` dans `globals.css`.

| Nom | Durée / courbe | Ce que ça dit |
|---|---|---|
| `wave` | `.95s ease-in-out ∞` | le micro capte |
| `idle` | `1.6s ease-in-out ∞` | le micro attend |
| `collapse` | `.7s cubic-bezier(.4,0,.2,1)` | l'onde retombe : c'est transcrit |
| `pop` | `.45s cubic-bezier(.2,.9,.3,1)` | un élément structuré apparaît |
| `rail` | `.5s cubic-bezier(.4,0,.2,1)` | le trait de séparation se tire |
| `shimmer` | `1.1s linear ∞` | on attend le serveur |
| `ping` | `1.4s ease-out ∞` | ça enregistre, là, maintenant |
| `fade` | `.3s` | changement d'écran |
| `sheet` | `.3s cubic-bezier(.2,.9,.3,1)` | une feuille monte |

Deux courbes seulement : `cubic-bezier(.4,0,.2,1)` pour ce qui obéit,
`cubic-bezier(.2,.9,.3,1)` pour ce qui arrive. `prefers-reduced-motion` réduit
tout à `0.01ms` — sans casser la lecture du niveau audio.

---

## 3. Composants

Mesures relevées dans `src/components/`. Elles font partie du système : les
changer, c'est changer le design.

### Tuile de destination — `HomeScreen`
`min-height 132` · rayon `24` · padding `16` · flex colonne, `justify-between`.
Pastille d'icône `44×44`, ronde, `surface`, icône `20` en encre. Libellé `17/700`,
sous-titre `13/500` en `ink-muted`. Grille `2×2`, `gap 12`.
La quatrième tuile (IA) inverse : fond `ink`, texte blanc, sous-titre
`rgba(255,255,255,.6)`.

### Bouton d'icône d'en-tête
`44×44` rond, `surface`, filet `.08`, icône `17–19`. Le point de notification :
`8px` `danger`, bordure `2px` de la **couleur du fond** — c'est ce qui le
détache, pas une ombre.

### Avatar de compte
`46` rond, fond `task-100`, initiales `task-700`, `13/800`.

### Ligne de liste — `TodayRow`
Padding `12px 14px`, `gap 12`. Coche `26` ronde, filet `2px` d'encre à `.18`,
coche `13` en `strokeWidth 3.4`. Titre `15/600`. Métadonnée : pastille de projet
`6px` + nom `13` en `ink-muted` + badge vocal. Heure `13/700` `.tnum` à droite.
Terminé : titre en `ink-faint` + `line-through`.
Conteneur : `surface`, rayon `20`, padding `6px 4px`, filet `.06`. Séparateurs
`1px` de hairline, **retraits de 14 px** à gauche et à droite.

### Chip — `Chip.tsx`
Pilule `px 12 / py 7`, `12/700`. Quatre variantes : `task`, `meet`, `idea`
(fond `100`, texte `700`), `neutral` (fond `surface`, filet `.08`, texte encre).

### Navigation basse — `BottomNav`
Pilule `surface` flottante, filet `.07`, `shadow-nav`, padding `6`, `gap 6`.
Quatre entrées de `52×48` arrondies ; l'active prend un fond `#F4F4F2`, l'icône
passe de `ink-faint` à `ink`. FAB central `60×60`, encre, `margin-top -14`,
`shadow-fab`, `+` en `22`.

### Feuille de capture — `CaptureSheet`
Voile `rgba(16,16,16,.34)`. Feuille `surface`, coins hauts `30`, padding
`12 20 32`. Poignée `5×42` en `ink/.14`. Quatre étapes, jamais deux à la fois :
- **idle** — micro `104` rond encre `shadow-mic`, titre `16/700`, aide `13/500`
  centrée à `250px` max, séparateur « OU », champ pilule `52` sur fond `bg` avec
  bouton `40` encre.
- **listening** — point `9px` `danger` + `ping`, `J'écoute…` `14/700`, horloge
  mono `13`, onde animée, bouton `Terminer` `52` pleine largeur.
- **transcribing** — onde `collapse`, trois barres `12px` en `shimmer`
  (`92% / 74% / 48%`, décalées de `-.2s`).
- **done** — citation sur fond `bg` rayon `18`, rail + libellé mono
  `N ÉLÉMENTS STRUCTURÉS`, cartes de brouillon (rayon `18`, filet `.09`, `pop`
  décalé de `.15s` par carte), puis `Rejouer` / `Ajouter`.

### Fiche — `TaskDetailScreen`
Chips en tête, titre `28/800` `-0.03em`. Cartes `surface` rayon `20` filet `.06`
padding `16`. Le **fil d'origine** : libellé mono
`FIL D'ORIGINE · 18 AOÛT · 34 S`, bouton lecture `32` encre, onde statique de
24 barres dont le segment actif est en encre, citation avec l'extrait surligné en
`idea-100` (rayon `5`, padding `1px 4px`). Sous-tâches : barre de progression
`5px` sur `ink/.07`, transition `.35s`.
Actions : `Terminer` `52` encre pleine largeur, puis `Reporter` (filet `.12`) et
`Supprimer` (filet `rgba(226,58,46,.25)`, texte `danger`) côte à côte en `48`.

### Agenda — `AgendaScreen`
Bandeau : deux boutons ronds `44`, mois `15/700` capitalisé, badge
`Calendrier Apple` `10.5/700` en `meet-700` avec point `5px`.
Semaine : 7 colonnes, `gap 6`, initiale `11/700`, jour `38×44` rayon `16`
`14/700` ; aujourd'hui en encre sur blanc inversé, week-end en `#C4C4BD`.
Événements groupés par jour puis par demi-journée, libellés mono
`MATIN` / `APRÈS-MIDI`. Ligne : gouttière d'heure `46px` `13/700` `ink-faint`,
carte `surface` rayon `20` filet `.06`, **filet gauche `4px`** de la couleur de
destination (`task-700` ou `meet-700`).

### Squelettes et vides
Squelette = `shimmer` sur la géométrie réelle du contenu à venir, jamais un
spinner centré. État vide = icône, titre `16/700`, phrase `13/500` en
`ink-muted`, une action unique.

---

## 4. Iconographie

`src/components/icons.tsx` — tracés maison, `viewBox 24`, `fill none`,
`stroke currentColor`, `linecap/linejoin round`. **Ne pas substituer une
librairie d'icônes.** L'épaisseur est fonction de la taille :

| Emploi | Taille | `strokeWidth` |
|---|---|---|
| Coche de ligne | 13 | 3.4 |
| Chevron, croix, flèche | 16–18 | 2.4–2.6 |
| Nav, tuile, micro petit | 20 | 2.1–2.2 |
| Micro grand | 34 | 1.9 |
| Réglages, aperçu | 22 | 1.7 |

Les icônes pleines (`PlayIcon`, `StopIcon`, `StarIcon`) sont en `fill`, sans
contour — trois exceptions, pas une famille.

### Icône PWA (écran d'accueil, favicon)

Distincte de l'iconographie in-app ci-dessus : c'est l'icône installée, pas un
pictogramme d'interface. **Remplacée le 20 août 2026** — variante « Trois
destinations » du projet Claude Design « Brief PWA et desktop »
(`BriefIcon.dc.html`, variante B) : trois traits arrondis décroissants,
alignés à gauche, un par nature d'item (`--color-task-100` / `--color-meet-100`
/ `--color-idea-100`), sur fond `--color-ink` (`#101010`).

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#101010"/>
  <g>
    <rect x="112" y="142" width="288" height="54" rx="27" fill="#CFE0FF"/>
    <rect x="112" y="229" width="218" height="54" rx="27" fill="#CBE9D6"/>
    <rect x="112" y="316" width="148" height="54" rx="27" fill="#FBE2AE"/>
  </g>
</svg>
```

Version maskable : même tracé, `<g transform="translate(51.2 51.2) scale(0.8)">`.
Déclinaisons dans `public/` : `icon-{192,512}.png`, `apple-touch-icon.png`
(180, sans coin pré-arrondi — iOS masque lui-même), `icon-maskable-512.png`
(zone sûre 80 %), `favicon-32.png` (la variante se réduit telle quelle) ;
`src/app/favicon.ico` (16 + 32, PNG embarqué). Couleurs figées dans les PNG,
pas des `var()` — un asset raster ne suit pas un changement de thème ; si ces
tokens changent dans `globals.css`, régénérer à la main (script `sharp`
ponctuel, non conservé dans le dépôt). Détail et pourquoi : `DECISIONS.md`
(entrée du 20/08).

---

## 5. Règles non négociables

1. **Cible tactile : 44 px minimum.** Une coche visuellement de 26 px vit dans
   une zone de 44.
2. **Priorité 1 = la plus haute** (RFC 5545). Une seule échelle dans tout le
   code. Ne pas en réintroduire une seconde sans conversion testée.
3. **Le classement tâche / rendez-vous est visible et modifiable à la revue.**
   Une erreur du modèle ne se signale nulle part ailleurs.
4. **Une date illisible devient « pas d'échéance »**, jamais une date approchée.
   Un rappel absent se voit ; un rappel au mauvais moment ne se voit pas.
5. **Focus visible imposé :** `outline: 2px solid ink; outline-offset: 2px`.
6. **Le reset CSS reste dans `@layer base`.** Hors layer il l'emporte sur les
   utilitaires Tailwind — c'est ce qui affichait un bouton noir sur noir.
7. **Les safe areas passent par `.safe-top` / `.safe-bottom` / `.safe-x`.**
   Tailwind v4 ne compile pas les utilitaires arbitraires contenant `env()`.
   `.safe-top` vaut `max(env(safe-area-inset-top), 22px)` + `12px` en bas.
8. **Pas de dégradé, pas d'emoji, pas d'illustration.** Le seul dégradé du code
   est celui du `shimmer`, et c'est une mécanique, pas un décor.

---

## 6. Écarts connus, assumés ou à corriger

À signaler en revue tant qu'ils ne sont pas traités.

- **`skinFor()` renvoie des variables inexistantes.** `src/lib/projects.ts`
  produit `var(--color-p1)` … `var(--color-p8)` ; ces tokens ne sont **pas** dans
  `globals.css` v1 (ils venaient de l'ancien système). Les pastilles de projet
  sont donc transparentes aujourd'hui. Deux issues : réintroduire huit teintes de
  projet — et entrer en collision avec task/meet/idea —, ou garder la palette à
  quatre couleurs et confier l'identité du projet à la `Shape` déjà typée
  (`disc / square / diamond / ring / capsule`), en encre. **Recommandé :** la
  seconde. La forme se lit sans couleur, donc aussi pour un œil daltonien et en
  mode sombre ; `shapeFor()` existe déjà.
- **Barres de défilement masquées** (`::-webkit-scrollbar { width: 0 }`).
  Acceptable sur téléphone, gênant sur une fenêtre haute où plus rien n'indique
  qu'il reste du contenu. À restreindre au mobile par media query.
- **Tailles hors échelle** dans plusieurs composants (`14.5`, `13.5`, `12.5`,
  `10.5`, `15.5`). Toléré aujourd'hui, à ramener sur les dix crans.
- **Mode sombre : non traité, volontairement reporté.** `color-scheme: light` est
  posé en dur dans `:root`, et `layout.tsx` annonce pourtant un `theme-color`
  sombre — l'incohérence est connue. À faire en un seul bloc
  `@media (prefers-color-scheme: dark)` dans `@theme static`, quand l'app sera
  stable. Rien ne doit être écrit en blanc littéral pour un fond de carte d'ici
  là : toujours `--color-surface`.

---

## 7. Desktop

Le système ci-dessus est mobile-first et le reste : le téléphone est la
référence. Le desktop **prolonge** ces tokens, il n'en crée aucun. Seules des
mesures de disposition s'ajoutent :

| Mesure | Valeur |
|---|---|
| Rail de navigation | `248px`, `surface`, filet à droite |
| Panneau de détail | `428px`, drawer superposé — pas une troisième colonne |
| Modale de capture | `620px` |
| Palette de commandes | `640px` |
| Grille horaire | `56px` par heure, `7h → 21h` |
| Segment d'empilement (charge) | `26px` par élément |

Deux règles propres au desktop :

1. **La revue de capture devient éditable.** Sur mobile, la revue montre le
   découpage ; sur desktop, elle le corrige ligne à ligne (titre, nature,
   destination, échéance, priorité). C'est le seul endroit où le desktop fait
   plus que le mobile par nature d'entrée, pas par confort.
2. **Les blocs qui se chevauchent se partagent la largeur du jour** (voies), ils
   ne se recouvrent jamais. À `56px/heure`, deux éléments posés à moins de 50 min
   d'écart se croisent : c'est la règle, pas un cas limite.

Le clavier fait partie du design : `D` dicter, `⌘K` chercher/agir, `1…6` écrans,
`L` verrouiller, `Esc` fermer, `?` la liste.
