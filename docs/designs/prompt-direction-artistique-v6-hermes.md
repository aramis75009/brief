# Prompt — Brief v6 · variante Hermes : « Instrument, version outil »

> À coller tel quel dans une IA de design (Kimi K3, Claude Design…).
> Objectif : un preview HTML cliquable, desktop + mobile, qui **évolue** la
> direction « Instrument » validée — on ne la jette pas, on la fait passer
> d'app de poche à outil de travail.

---

## 1. Mission

Produis un preview HTML self-contained, cliquable, desktop (~1280 px) et
mobile (~390 px), de Brief v6 : l'organiseur vocal d'Aramis. La fondation
visuelle « Instrument » est validée et en ligne — pars d'elle, ajoute les
fonctionnalités ci-dessous, garde l'âme.

## 2. Le produit

Brief est un organiseur personnel piloté à la voix : on parle, la transcription
est découpée en tâches et rendez-vous datés, on relit, Brief garde et rappelle.
Un seul utilisateur (Aramis), iPhone en PWA + desktop. La chose mémorable :
« Je parle, c'est rangé. » Le micro est le héros, tout le reste s'efface.

## 3. La fondation : « Instrument » (validée — à conserver)

Ouvre d'abord **https://brief.srv1899780.hstgr.cloud/preview-v5/index.html**
(boutons « Mobile » / « Sombre » en haut à gauche). C'est la base. Extrais-en
l'ADN, ne le remplace pas.

**ADN à conserver :**
- **Papier chaud** : `#F3F0E9` (clair) / `#16140F` (sombre). Surfaces crème,
  filets fins — pas de cartes ni d'ombres.
- **Space Grotesk**, chiffres tabulaires. Hiérarchie par taille, poids et blanc.
- **Un seul accent d'action** : outremer `#2B3FE0` (clair) / `#7C8AFF` (sombre).
  Rouge = en retard, vert = fait. Rien d'autre de saturé.
- **Jauge de charge du jour** (« 3 de 8 faites ») avec graduations.
- **La couleur n'est jamais décorative** : chaque teinte désigne un projet
  (8 teintes × 5 formes = 40 destinations distinguables, même sans couleur,
  même en sombre). Reprends les 8 teintes et formes déjà définies dans
  preview-v5.
- **Desktop 3 colonnes** : rail gauche (date, jauge, navigation, Dicter) ·
  liste centrale · panneau droit (fiche + note d'origine).
- **Mobile** : liste verticale, « Maintenant » d'abord, tabbar 3 entrées avec
  micro central, panneaux par le bas, dictée plein écran → « C'est noté » →
  triage en chips colorées.

**Échelle proposée (ajuste au feeling, ne la casse pas) :**
- Rayons : petits (4–10 px), jamais de pilules partout.
- Ombres : quasi absentes ; l'élévation se lit par le fond et les filets.
- Durées : 150–250 ms, une seule courbe d'easing.
- Cibles tactiles ≥ 44 px, texte important en WCAG AA même en plein soleil.

## 4. Ce qu'on ajoute — spec par écran

### Mobile (~390 px) — adoucir vers le familier

Le mobile doit se sentir comme une app native qu'on utilise sans y penser :
patterns standard Apple/Android, palette encore plus claire, moins
« spectaculaire ». Le desktop garde plus de caractère.

**Écran A — Liste du jour** (sections dans l'ordre : En retard / Maintenant /
Rendez-vous / Ensuite / Plus tard / Fait) :
- **En retard** : traitement rouge distinct, elles sautent aux yeux. Chaque
  tâche en retard porte 2 actions directes : « Fait » (coche) et « Décaler »
  (sheet : plus tard / demain / choisir une date).
- Après 2–3 secondes sans action, une confirmation discrète : « As-tu fait
  cette tâche ? » avec « Oui, c'est fait » / « Non, je décale ».
- Coche d'une tâche : passage en Fait (vert), la jauge monte.

**Écran B — Triage coloré après ajout/coche** : petite notification (sheet ou
toast) proposant de choisir le projet, sélecteur très coloré avec les 8 teintes
bien visibles. Même plaisir que le triage de dictée, étendu à l'ajout manuel
et à la coche.

**Écran C — Dictée (inchangée, validée)** : micro plein écran → transcription →
« C'est noté » avec la liste des tâches retenues → triage par projet en chips
colorées. Ne touche à rien.

**Écran D — Fiche tâche** (sheet par le bas) : titre, projet, échéance,
sous-tâches cochables, note d'origine toujours visible, actions
(Fait / Décaler / supprimer).

**Tabbar** : 3 entrées, micro central (Aujourd'hui / Plan / Registre — libellés
ordinaires).

### Desktop (~1280 px) — devenir un vrai outil de travail

Base 3 colonnes conservée, plus une bascule de vues en haut de la liste
centrale : **Liste du jour · Plan · Registre · Kanban · Vision**.

**Vue Kanban** : colonnes « À faire / En cours / Fait » (ou par jour de la
semaine), cartes déplaçables par glisser-déposer réel. Une carte = titre +
teinte projet + échéance si datée. Ouvrir une carte → fiche dans le panneau
droit avec sous-tâches cochables. Possibilité de plusieurs tableaux (par
projet, par semaine).

**Vue Vision (calendrier)** : semaine ou mois, montre les tâches datées et les
rendez-vous. C'est la même vision que le calendrier Apple — Brief la pilote.
Dans le preview : déplacer un événement dans le calendrier le met à jour dans
Brief (et inversement, cocher une tâche dans Brief la marque dans le
calendrier). Montre la liaison, même simulée.

**Sous-tâches** : une tâche peut contenir des sous-tâches cochables
(« Poster 10 articles » → photos, descriptions, mise en ligne).

## 5. Les flows à démontrer (le preview doit être cliquable de bout en bout)

1. **Dictée** : micro → « C'est noté » → triage chips → retour liste.
2. **Tâche en retard** : elle apparaît rouge → « As-tu fait ? » → Oui (coche,
   vert) ou Non (décaler).
3. **Ajout/coche → triage coloré** : la notification apparaît, on choisit un
   projet, la teinte s'applique.
4. **Kanban** : glisser une carte d'une colonne à l'autre, ouvrir la fiche,
   cocher une sous-tâche.
5. **Vision** : basculer semaine/mois, déplacer un événement, voir la tâche
   mise à jour.

## 6. Données du prototype (réalistes, banales — jamais inventer de stats)

Modèle : **Tâche** (titre, projet, échéance ou rien, état : à faire / en cours /
fait / en retard, sous-tâches, note d'origine) · **Rendez-vous** (titre, date,
heure, durée) · **Projet** (nom, teinte, forme) · **Registre** (tâches faites,
datées).

Exemples à utiliser (et à décliner) :
- « Poster 10 articles » — projet Frip & Trend — sous-tâches : photos,
  descriptions, mise en ligne — en retard.
- « Aller courir » — projet Sport — aujourd'hui 16h.
- « Entretien Epitech » — rendez-vous daté.
- « Reposter 15 articles » — Frip & Trend.
- « Push » / « Pull » — Sport (lun/jeu/dim, mar/ven).
- « Remplir la fiche de paie », « Appeler le plombier » — tâches banales sans
  échéance.

Aucune métrique factice, aucun contenu de remplissage. Chaque tâche affichée
doit ressembler à une vraie journée d'Aramis.

## 7. Copywriting (règles absolues)

- Tutoiement, phrases courtes, ton calme et humain.
- Zéro emoji, zéro point d'exclamation.
- Zéro jargon produit : « triage », « structuration », « embarquement »
  interdits côté utilisateur. On dit « Choisis un projet », pas « Triage ».
- Chaque écran dit UNE chose. Les libellés de section sont des mots ordinaires
  (En retard, Maintenant, Rendez-vous, Ensuite, Plus tard, Fait).

## 8. Contraintes dures

- Hiérarchie par taille, poids et blanc — pas par cartes, ombres, bordures.
- Un seul accent d'action (outremer) + rouge « en retard » + vert « fait ».
  Rien d'autre de saturé.
- La couleur n'est jamais décorative : chaque teinte désigne un projet.
- WCAG AA sur le texte important, cibles tactiles ≥ 44 px (mobile).
- Thèmes sombre ET clair, tous deux dessinés (pas une simple inversion).
- `prefers-reduced-motion` respecté.
- Jamais inventer : pas de métriques factices, pas de stats décoratives, pas
  de contenu de remplissage.

## 9. Interdits (le « slop » IA — chacun a une raison)

- Dégradés bleu/violet/indigo brillants → casse le papier chaud.
- Accent indigo/violet par défaut → l'accent est l'outremer, un seul.
- Grilles de 3 cartes icône + titre + phrase → pattern générique, pas une
  hiérarchie.
- Bandeau coloré sur le bord gauche des cartes → la couleur est le projet,
  pas un décor.
- Verre dépoli / flou sans système d'élévation réel → l'élévation se lit par
  le fond.
- Chiffres monumentaux qui remplacent le contenu → la jauge suffit.
- Icône dans un carré arrondi au-dessus de chaque titre → pattern générique.
- Tout centré par défaut → l'alignement suit la lecture.
- Inter (ou system-ui) par défaut → la typographie est Space Grotesk.
- Emojis, illustrations SVG décoratives, fausses photos → le réel suffit.

## 10. Livrable

Un seul fichier HTML self-contained (CSS + JS embarqués, aucune dépendance
externe, une seule Google Font au maximum), ouvert directement dans un
navigateur, avec un moyen simple de basculer desktop ↔ mobile (bouton ou
redimensionnement). Pas de build, pas de dépendances. Le preview est une
exploration — le code de production suivra après validation.

## 11. Auto-vérification avant de rendre

- [ ] L'ADN « Instrument » est reconnaissable au premier coup d'œil (papier,
      Space Grotesk, outremer, filets).
- [ ] Les 5 flows sont cliquables de bout en bout.
- [ ] Une tâche en retard saute aux yeux et offre Fait / Décaler / As-tu fait ?
- [ ] Le triage coloré apparaît après ajout et après coche.
- [ ] Le kanban drag & drop fonctionne ; les sous-tâches se cochent.
- [ ] La vue Vision montre la liaison calendrier ↔ Brief.
- [ ] Sombre et clair sont tous deux dessinés.
- [ ] Aucun interdit de la section 9, aucun emoji, aucun « ! », aucun jargon.
- [ ] Aucune donnée inventée : tout ressemble à une vraie journée.

---

*Contexte technique (pas pour l'utilisateur) : Brief est une PWA Next.js 16 /
React 19 / Tailwind v4, données sur VPS, synchronisation CalDAV bidirectionnelle
avec le calendrier Apple iCloud (source de vérité des horaires).*
