# Prompt — Brief v6 : évolution de la direction « Instrument » + nouvelles fonctionnalités

> À coller tel quel dans une IA de design puissante (Claude Design, Kimi K3…).
> Objectif : un preview HTML cliquable, desktop + mobile, qui part de la
> direction artistique **validée** « Instrument » et y ajoute les nouvelles
> fonctionnalités décrites ci-dessous. La créativité et le savoir-faire de
> l'IA sont attendus sur les fonctionnalités et leur intégration — la peau de
> base est validée, on l'évolue, on ne la jette pas.

---

## Le produit, en une phrase

Brief est un organiseur personnel piloté à la voix : on parle, une transcription
est découpée en tâches et rendez-vous datés, on relis, Brief les garde et les
rappelle. Un seul utilisateur (Aramis), sur iPhone en PWA **et désormais sur
desktop**. La chose mémorable : « Je parle, c'est rangé. » Le micro est le
héros, tout le reste s'efface.

## La base validée : la direction « Instrument » (ne pas jeter)

La direction artistique « Instrument » a été **validée par l'utilisateur**.
Elle est visible en ligne : **https://brief.srv1899780.hstgr.cloud/preview-v5/index.html**
(ouvre-la : boutons « Mobile » / « Sombre » en haut à gauche pour basculer).

Ses traits (à conserver comme fondation) :
- **Papier chaud** (`#F3F0E9` clair / `#16140F` sombre), surfaces crème, filets
  fins plutôt que cartes et ombres.
- **Typographie Space Grotesk** (Google Fonts), chiffres tabulaires, hiérarchie
  par taille/poids/blanc.
- **Un seul accent : outremer** (`#2B3FE0` clair / `#7C8AFF` sombre), réservé
  à agir (micro, bouton d'envoi, onglet actif, jauge). Rouge pour « En
  retard », vert pour « fait ».
- **Jauge de charge du jour** (ex. « 3 de 8 faites ») avec graduations.
- **Desktop 3 colonnes** : rail gauche (date, jauge, navigation, bouton
  Dicter) · liste centrale (sections En retard / Maintenant / Rendez-vous /
  Ensuite / Plus tard / Fait) · panneau droit (fiche de la tâche sélectionnée
  avec sa note d'origine).
- **Mobile** : liste verticale, « Maintenant » d'abord, barre d'onglets à 3
  entrées avec micro central, panneaux qui montent par le bas, dictée plein
  écran → « C'est noté » → triage par projet en chips colorées.
- **La couleur n'est jamais décorative** : chaque teinte désigne un projet
  (8 teintes × 5 formes = 40 destinations distinguables, y compris sans couleur
  et en mode sombre).

## Ce que tu dois AJOUTER (le cœur de la mission)

### 1. Mobile — adoucir vers le familier, sans perdre l'âme

- **Palette plus claire** : éclaircir encore les fonds et surfaces du mobile.
- **Style plus standard, plus Apple/Samsung/Android** : des patterns familiers
  et immédiatement compréhensibles, moins « spectaculaire », plus clair et
  rassurant. Le desktop peut garder plus de caractère ; le mobile doit se
  sentir comme une app native qu'on utilise sans y penser.
- **Tâches en retard très visibles** : elles doivent sauter aux yeux (rouge,
  traitement distinct) et proposer des **actions directes** :
  - « Fait » (cocher)
  - « Décaler » (reporter à plus tard / demain / choisir une date)
  - « As-tu fait cette tâche ? » — une petite confirmation avec les deux
    issues : « Oui, c'est fait » ou « Non, je décale »
- **Après avoir ajouté ou coché une tâche** : une petite notification propose
  de **choisir le projet**, avec un sélecteur très coloré (les 8 teintes de
  projets bien visibles). Ce triage coloré est déjà adoré dans la dictée —
  l'étendre à l'ajout manuel et à la coche.
- **La dictée reste le moment magique** : micro plein écran → « C'est noté »
  avec la liste des tâches retenues → triage par projet en chips colorées.
  Conserver ce flow tel quel, il est validé.

### 2. Desktop — devenir un vrai outil de travail

- **Tableaux type Trello (kanban)** : des colonnes (ex. À faire / En cours /
  Fait, ou par jour de la semaine) avec des **cartes déplaçables par
  glisser-déposer** d'une colonne à l'autre. Plusieurs tableaux possibles
  (par projet, par semaine…).
- **Sous-tâches** : une tâche peut contenir des sous-tâches cochables
  (ex. « Poster 10 articles » → « photos », « descriptions », « mise en
  ligne »).
- **Plusieurs vues au choix** : liste du jour, plan, registre, kanban,
  vision — l'utilisateur bascule selon ce qu'il fait.
- **La vision = le calendrier** : un panneau/une vue calendrier (semaine ou
  mois) qui montre les tâches datées et les rendez-vous. C'est la même vision
  que le calendrier Apple — Brief la pilote.

### 3. Le calendrier Apple est la base de la vision, piloté par Brief

- Le calendrier Apple (iCloud) est la **source de vérité des horaires** :
  Brief écrit les nouvelles tâches dedans, et toute édition faite directement
  dans l'app Calendrier est adoptée par Brief (synchronisation bidirectionnelle,
  latence ~15 min).
- Dans le preview, montre cette **vue calendrier** (semaine/mois) avec les
  tâches datées, et l'idée que tout est relié : cocher une tâche dans Brief
  la marque dans le calendrier, déplacer un rendez-vous dans le calendrier
  le met à jour dans Brief.

### 4. Positionnement

Une app **desktop et mobile utilisable tout le temps**, indispensable pour le
travail, pensée pour être le plus productif possible : on l'ouvre dix fois par
jour, elle répond en une seconde, elle ne cache jamais l'information.

## Format du livrable

Un **preview HTML cliquable, self-contained** (CSS + JS embarqués, aucune
dépendance externe, une seule Google Font au maximum), qui montre :

1. **Desktop** (~1280 px) : la base 3 colonnes + les nouveautés (kanban avec
   drag & drop réel, sous-tâches, vue calendrier, bascule entre vues).
2. **Mobile** (~390 px) : la base + palette éclaircie, style standard,
   tâches en retard avec actions « Fait / Décaler / As-tu fait ? », triage
   coloré après ajout/coche, dictée.

Le preview est **cliquable** : navigation entre écrans, cocher une tâche,
déplacer une carte kanban, ouvrir une fiche, déclencher les notifications de
triage, au moins une transition d'état visible partout.

## Contraintes dures (non négociables)

- **Hiérarchie par taille, poids et blanc** — pas par cartes, ombres et
  bordures.
- **Un seul accent d'action** (outremer) + rouge « En retard » + vert « fait ».
  Rien d'autre de saturé.
- **La couleur n'est jamais décorative** : chaque teinte désigne un projet.
- **Lisible en plein soleil sur iPhone** : contrastes WCAG AA sur le texte
  important, cibles tactiles ≥ 44 px.
- **Thèmes sombre ET clair**, tous deux dessinés (pas une simple inversion).
- `prefers-reduced-motion` respecté.
- **Copywriting** : tutoiement, phrases courtes, ton calme et humain. Zéro
  jargon produit (« triage », « structuration », « embarquement » interdits
  côté utilisateur). Zéro emoji, zéro point d'exclamation. Chaque écran dit
  UNE chose. Les libellés de section sont des mots ordinaires.
- **Jamais inventer** : pas de métriques factices, pas de stats décoratives,
  pas de contenu de remplissage. Utilise des tâches réalistes et banales
  (ex. « Poster 10 articles », « Aller courir », « Entretien Epitech »).

## Interdits absolus (le « slop » IA)

- Dégradés bleu/violet/indigo brillants
- Accent indigo/violet par défaut
- Grilles de 3 cartes à icône + titre + phrase, toutes égales
- Bandeau coloré sur le bord gauche des cartes
- Verre dépoli / flou sans système d'élévation réel
- Chiffres monumentaux qui remplacent le contenu
- Icône dans un carré arrondi au-dessus de chaque titre
- Tout centré par défaut
- Inter (ou system-ui) par défaut — la typographie est Space Grotesk
- Emojis, illustrations SVG décoratives, fausses photos

## Ce qui est verrouillé (ne pas rediscuter)

- Le modèle produit : accueil-réponse, dictée, confirmation, triage à une
  question, plan du jour, fiche avec note d'origine, registre, états.
- La disposition mobile : liste verticale, « Maintenant » d'abord, tabbar 3
  entrées avec micro central, sheets par le bas.
- Les principes : friction proportionnelle à la confiance ; jamais inventer ;
  la note d'origine toujours conservée et montrée ; chaque panne a une issue.
- La direction artistique « Instrument » comme fondation (voir plus haut).

## Livre

Un seul fichier HTML (ou un index qui enchaîne les écrans), ouvert directement
dans un navigateur, avec un moyen simple de basculer desktop ↔ mobile (bouton
ou redimensionnement). Pas de build, pas de dépendances.

---

*Contexte technique (pas pour l'utilisateur) : Brief est une PWA Next.js 16 /
React 19 / Tailwind v4, données sur VPS, synchronisation CalDAV bidirectionnelle
avec le calendrier Apple iCloud (source de vérité des horaires). Le preview est
une exploration — le code de production suivra après validation d'Aramis.*
