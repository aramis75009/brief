# Prompt — Nouvelle direction artistique Brief (v5)

> À coller tel quel dans Claude Design (ou tout outil de design IA).
> Objectif : un preview HTML cliquable d'une direction artistique ENTIÈREMENT
> nouvelle, desktop + mobile. Liberté créative maximale sur la peau ; le
> modèle produit et la disposition mobile sont verrouillés.

---

## Le produit, en une phrase

Brief est un organiseur personnel piloté à la voix : on parle, une transcription
est découpée en tâches et rendez-vous datés, on relit, Brief les garde et les
rappelle. Un seul utilisateur (Aramis), sur iPhone en PWA — et désormais aussi
sur desktop. La chose mémorable : « Je parle, c'est rangé. » Le micro est le
héros, tout le reste s'efface.

## Ta mission

Invente une **direction artistique entièrement nouvelle** pour Brief. Les
tentatives précédentes (bento sombre, tableau de départs, v4) ont été rejetées :
ne t'en inspire pas, ne les « améliore » pas. Pars de zéro, avec du vrai parti
pris. Tu es libre sur : la typographie, la palette, la composition, le
traitement des surfaces, la densité, le mouvement, la personnalité visuelle.

Ce qui doit se sentir en ouvrant l'app : un outil qu'on ouvre dix secondes,
calme, dense en information, jamais bavard. Pas un espace où l'on s'installe.

## Format du livrable

Un **preview HTML cliquable, self-contained** (CSS + JS embarqués, aucune
dépendance externe, polices système ou une seule Google Font), qui montre :

1. **Desktop** (largeur ~1280 px) — Brief n'a jamais eu de version desktop :
   c'est une vraie nouveauté. Propose une composition qui exploite la largeur
   (vision globale de charge inter-projets, registre, plan du jour) sans être
   un simple mobile étiré.
2. **Mobile** (largeur ~390 px) — la disposition est verrouillée : liste
   verticale, hiérarchie « Maintenant » d'abord, barre d'onglets à 3 entrées
   avec micro central, panneaux qui montent par le bas.

Le preview est **cliquable** : on peut naviguer entre les écrans, ouvrir une
fiche, cocher une tâche, déclencher au moins une transition d'état visible.

## Les écrans à couvrir

**Mobile (obligatoire) :**
- Accueil-réponse : sections « Maintenant » / « Ensuite » / « Rendez-vous » /
  « En retard » / « Plus tard »
- Dictée (le micro, plein écran, l'état d'enregistrement)
- « C'est noté » (la confirmation après dictée)
- Triage à une seule question (quand la confiance est basse)
- Plan du jour
- Fiche d'une tâche (avec la note d'origine toujours visible)
- Registre « Tout »
- États : vide, micro refusé, hors-ligne, échec IA, chargement

**Desktop (obligatoire) :**
- La même app, réimaginée pour grand écran : au minimum l'accueil-réponse
  (vision de charge), le registre, le plan du jour, la dictée

## Contraintes dures (non négociables)

- **Hiérarchie par taille, poids et blanc** — pas par cartes, ombres et
  bordures. Les cartes ne sont pas interdites, mais elles ne doivent pas être
  le seul moyen de structurer.
- **Un seul accent d'action** (couleur saturée unique, réservée à agir :
  micro, bouton d'envoi, onglet actif). Plus un rouge pour « En retard » et
  un vert pour « fait ». Rien d'autre ne doit être saturé.
- **La couleur n'est jamais décorative** : chaque teinte désigne un projet
  (8 teintes × 5 formes = 40 destinations distinguables, y compris sans
  couleur et en mode sombre).
- **Lisible en plein soleil sur iPhone** : contrastes WCAG AA sur le texte
  important, cibles tactiles ≥ 44 px.
- **Thèmes sombre ET clair**, tous deux dessinés (pas une simple inversion).
- `prefers-reduced-motion` respecté.
- **Copywriting** : tutoiement, phrases courtes, ton calme et humain. Zéro
  jargon produit (« triage », « structuration », « embarquement » interdits
  côté utilisateur). Zéro emoji, zéro point d'exclamation. Chaque écran dit
  UNE chose. Les libellés de section sont des mots ordinaires.
- **Jamais inventer** : pas de métriques factices, pas de stats décoratives,
  pas de contenu de remplissage. Si un écran a besoin de données, utilise des
  tâches réalistes et banales (ex. « Poster 10 articles », « Aller courir »,
  « Entretien Epitech »).

## Interdits absolus (le « slop » IA)

- Dégradés bleu/violet/indigo brillants
- Accent indigo/violet par défaut
- Grilles de 3 cartes à icône + titre + phrase, toutes égales
- Bandeau coloré sur le bord gauche des cartes
- Verre dépoli / flou sans système d'élévation réel
- Chiffres monumentaux qui remplacent le contenu
- Icône dans un carré arrondi au-dessus de chaque titre
- Tout centré par défaut
- Inter (ou system-ui) par défaut — choisis une vraie typographie
- Emojis, illustrations SVG décoratives, fausses photos

## Ce qui est verrouillé (ne pas rediscuter)

- Le modèle produit : accueil-réponse, dictée, confirmation, triage à une
  question, plan du jour, fiche, registre, états.
- La disposition mobile : liste verticale, « Maintenant » d'abord, tabbar 3
  entrées avec micro central, sheets par le bas.
- Les principes : friction proportionnelle à la confiance ; jamais inventer ;
  la note d'origine toujours conservée et montrée ; chaque panne a une issue.

## Livre

Un seul fichier HTML (ou un index qui enchaîne les écrans), ouvert directement
dans un navigateur, avec un moyen simple de basculer desktop ↔ mobile (bouton
ou redimensionnement). Pas de build, pas de dépendances.

---

*Contexte technique pour toi (pas pour l'utilisateur) : Brief est une PWA
Next.js 16 / React 19 / Tailwind v4. Les polices actuelles sont General Sans
(Fontshare). Le preview est une exploration — le code de production suivra
après validation d'Aramis.*
