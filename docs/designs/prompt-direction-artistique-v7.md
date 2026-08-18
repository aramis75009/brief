# Prompt — Brief : direction artistique libre

> À coller tel quel dans une IA de design puissante (Claude Design, Kimi K3…).
> Objectif : un preview HTML cliquable, desktop + mobile, avec une direction
> artistique QUE TU CHOISIS. Le produit et les fonctionnalités sont décrits
> ci-dessous ; la créativité visuelle est entièrement la tienne.

---

## Le produit, en une phrase

Brief est un organiseur personnel piloté à la voix : on parle, une transcription
est découpée en tâches et rendez-vous datés, on relit, Brief les garde et les
rappelle. Un seul utilisateur (Aramis), sur iPhone en PWA et sur desktop.
La chose mémorable : « Je parle, c'est rangé. » Le micro est le héros, tout le
reste s'efface.

## Les fonctionnalités à montrer

1. **Dictée vocale** : micro → transcription → découpage en tâches datées →
   confirmation « C'est noté » → triage par projet.
2. **Triage coloré** : après l'ajout ou la coche d'une tâche, proposer de
   choisir le projet avec un sélecteur coloré. Chaque projet a une couleur ;
   les projets restent distinguables même sans couleur (couleur + forme/icône)
   et en mode sombre.
3. **Plan du jour** : les tâches du jour organisées par urgence (en retard /
   maintenant / rendez-vous / ensuite…). Les tâches en retard sautent aux yeux
   et proposent des actions directes : « Fait », « Décaler », et une
   confirmation « As-tu fait cette tâche ? » avec deux issues.
4. **Fiche de tâche** : détails, note d'origine toujours conservée et montrée,
   sous-tâches cochables.
5. **Kanban** : tableaux type Trello avec cartes déplaçables par glisser-déposer,
   plusieurs tableaux possibles.
6. **Vue calendrier** : semaine/mois montrant les tâches datées et les
   rendez-vous, reliée au calendrier Apple (source de vérité des horaires,
   synchronisation bidirectionnelle, latence ~15 min).
7. **Plusieurs vues** : liste, plan, registre, kanban, vision — l'utilisateur
   bascule selon ce qu'il fait.
8. **Registre** : toutes les tâches et rendez-vous passés.

## Positionnement

Une app desktop et mobile utilisable tout le temps, indispensable pour le
travail, pensée pour être le plus productif possible : on l'ouvre dix fois par
jour, elle répond en une seconde, elle ne cache jamais l'information.

## Contraintes de qualité (non négociables)

- Lisibilité en plein soleil sur iPhone : contrastes WCAG AA sur le texte
  important, cibles tactiles ≥ 44 px.
- Thèmes sombre ET clair, tous deux dessinés (pas une simple inversion).
- `prefers-reduced-motion` respecté.
- Copywriting : tutoiement, phrases courtes, ton calme et humain. Zéro jargon
  produit. Zéro emoji, zéro point d'exclamation. Chaque écran dit UNE chose.
  Les libellés de section sont des mots ordinaires.
- Jamais inventer : pas de métriques factices, pas de stats décoratives, pas de
  contenu de remplissage. Utilise des tâches réalistes et banales
  (ex. « Poster 10 articles », « Aller courir », « Entretien Epitech »).
- Hiérarchie par taille, poids et blanc — pas par cartes, ombres et bordures.
- Un seul accent d'action + rouge « En retard » + vert « fait ».
  Rien d'autre de saturé.
- La couleur n'est jamais décorative : chaque teinte désigne un projet.

## Interdits absolus (le « slop » IA)

- Dégradés bleu/violet/indigo brillants
- Accent indigo/violet par défaut
- Grilles de 3 cartes à icône + titre + phrase, toutes égales
- Bandeau coloré sur le bord gauche des cartes
- Verre dépoli / flou sans système d'élévation réel
- Chiffres monumentaux qui remplacent le contenu
- Icône dans un carré arrondi au-dessus de chaque titre
- Tout centré par défaut
- Emojis, illustrations SVG décoratives, fausses photos

## Format du livrable

Un preview HTML cliquable, self-contained (CSS + JS embarqués, aucune
dépendance externe, une seule Google Font au maximum), qui montre :

1. **Desktop** (~1280 px) : toutes les vues (liste, kanban avec drag & drop
   réel, calendrier, registre), fiche avec sous-tâches.
2. **Mobile** (~390 px) : plan du jour, tâches en retard avec actions, triage
   coloré, dictée.

Le preview est **cliquable** : navigation entre écrans, cocher une tâche,
déplacer une carte kanban, ouvrir une fiche, déclencher les notifications de
triage, au moins une transition d'état visible partout.

Un moyen simple de basculer desktop ↔ mobile (bouton ou redimensionnement).
Pas de build, pas de dépendances.

## Ta liberté

La direction artistique est entièrement à toi : palette, typographie,
disposition, style. Choisis ce qui rend ce produit le plus clair, le plus
agréable et le plus mémorable possible. Surprends-moi — mais reste lisible,
calme et humain.

---

*Contexte technique (pas pour l'utilisateur) : Brief est une PWA Next.js 16 /
React 19 / Tailwind v4, données sur VPS, synchronisation CalDAV bidirectionnelle
avec le calendrier Apple iCloud (source de vérité des horaires). Le preview est
une exploration — le code de production suivra après validation d'Aramis.*
