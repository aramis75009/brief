# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui que
tu remplaces dans `docs/handoffs/`.

> **Multi-agents** : si tu n'es pas l'agent qui a écrit la dernière passation,
> tu reprends la main explicitement (nouvelle entrée). Lis aussi
> [`docs/coordination.md`](docs/coordination.md) — les copies du dépôt, la
> branche de prod, les règles anti-collision.

---

# Passation — 2026-08-25 (soir) · Cinq chantiers front-end, tous recettés

| | |
|---|---|
| **Agent** | **Claude Code** — *je passe la main à Hermes Agent* (passation précédente : Hermes Agent, 25/08 matin) |
| **Branche** | **`chantiers-frontend-2026-08-25`**, créée depuis `feat/ui-redesign-claude` à `5b42116`. ⚠️ **Ce n'est pas la branche de prod.** |
| **Commits** | `c3ebd53`, `5e07462`, `dcad9ce`, `62ad6a6`, `e696f4f` — **locaux, non poussés** |
| **Base** | `5b42116` (tête d'`origin/feat/ui-redesign-claude`) |

## Goal — l'objectif

Corriger les cinq points remontés par Aramis depuis les captures d'écran de
l'app : l'onde de capture figée, le glisser-déposer du Kanban, le chevauchement
du calendrier, la densité de la fiche tâche, l'illisibilité du graphe. Un
chantier = un commit, avec recette dans un vrai navigateur avant de passer au
suivant.

Le plan d'attaque d'Aramis est dans
[`docs/handoffs/2026-08-25-workflow-frontend-gstack.md`](docs/handoffs/2026-08-25-workflow-frontend-gstack.md).

## Current state — ce qui a été fait

**Les cinq chantiers sont livrés et recettés.** Dans tous les cas la cause racine
était structurelle, jamais cosmétique — et quatre des cinq étaient des **pannes
silencieuses** : rien ne levait d'erreur.

### 1. `c3ebd53` — L'onde de capture ne suivait pas la voix

Deux défauts empilés. **L'onde n'a jamais été branchée au micro, sur aucun
navigateur** : `useRecorder` calcule `levels` à chaque frame via l'analyser,
`BriefApp.tsx:740` passait `seconds` et rien d'autre, et `CaptureSheet` montait
`<WaveformActive />` sans prop. Ce qui bougeait ailleurs était une keyframe
décorative, pas la voix.

Le **gel spécifique à Chrome/Windows** vient de `globals.css:234` : le reset
`prefers-reduced-motion` pose `animation-iteration-count: 1` sur `*`, et Chrome
rapporte `reduce` dès que Windows a « Effets d'animation » désactivé. Sondé sur
la machine d'Aramis : `SPI_GETCLIENTAREAANIMATION = False`. La keyframe `wave`
tournait 0,01 ms puis s'arrêtait. Sur Mac le réglage est off par défaut, d'où
l'illusion que ça marchait.

Le correctif pilote la hauteur en `transform: scaleY` depuis l'état React : plus
d'animation CSS, donc plus rien que le reset puisse figer. `src/lib/waveform.ts`
interpole les 4 bandes de fréquences sur les 20 barres.

### 2. `5e07462` — Les cartes « Non placées » ne se glissaient pas

`DesktopKanban.tsx` rendait les `DraggablePill` **ligne 508**, alors que
`<DndContext>` ne s'ouvrait que **ligne 545**. Leurs hooks `useDraggable`
tournaient hors contexte : activateurs liés à un contexte sans capteur, geste
jamais activé, **aucune erreur levée**. Les cartes déjà en colonne, rendues à
l'intérieur, fonctionnaient — d'où un board à moitié vivant.

Le `DndContext` englobe désormais les deux blocs. `touch-action: none` ajouté sur
la pilule (la barre défile horizontalement).

**C'était le seul geste du Kanban que personne n'avait jamais vérifié à
l'exécution** (`TODOS.md` § Dette connue). Il l'est maintenant, par le geste.

### 3. `dcad9ce` — Le calendrier empilait les événements

Chaque bloc était posé en `left: 4, right: 4`, donc pleine largeur, donc
recouvert par le suivant. Or `DESIGN.md` §7 règle 2 le dit noir sur blanc :
« Les blocs qui se chevauchent se partagent la largeur du jour (voies), ils ne se
recouvrent jamais. » **C'était un écart de conformité, pas une question de design
ouverte** — donc aucune variante générée : `AGENTS.md` interdit de re-débattre une
décision inscrite.

`src/lib/calendarLanes.ts` porte l'algorithme (tri, groupes d'événements qui se
croisent, première voie libérée). Voies visibles plafonnées à 3 — au-delà, une
colonne de jour donne des bandes de 30px illisibles — et le surplus se replie
derrière un « +N » qui **déplie le groupe au clic** (règle d'Aramis du 22/08 : un
bouton mort, on le branche).

### 4. `62ad6a6` — La fiche tâche était plate et dense

Le titre arrivait en cinquième position. Nouvel ordre : bandeau de blocage (c'est
une alerte), chips, **étiquettes**, **titre**, description, audio, sous-tâches,
chaîne de dépendances **en dernier** (c'est de la navigation vers d'autres
tâches). L'espacement n'est plus un `12px` uniforme.

Le « popup mal intégré » n'était pas un popup : le panneau de 320px était
**enfant flex d'une rangée horizontale**, il étirait la ligne. Il vit maintenant
sur sa propre ligne. La création passe de trois gestes à un : un champ unique
filtre les étiquettes existantes **et** nomme la nouvelle, Entrée valide, et le
libellé du bouton dit lequel des deux va se produire.

Deux bugs de lisibilité corrigés au passage : les pastilles posaient de l'encre
`#101010` sur des fonds saturés (`#FF3B30`, `#007AFF`) — `tagTextOn()` choisit par
luminance ; et la sidebar affichait `item.tags.join(", ")`, soit des identifiants
bruts (`tag-mt917nrp`) dès qu'une étiquette venait de l'app.

### 5. `e696f4f` — Le graphe empilait 42 tâches en colonne

`layoutGraph` plaçait chaque nœud à la colonne de sa **profondeur**, et une tâche
sans dépendance a une profondeur de 0 : **toutes les tâches isolées atterrissaient
en colonne 0**. Sur un jeu réel où une poignée seulement sont liées, ça donne une
colonne de plusieurs milliers de pixels avec les chaînes noyées dedans.

Chaque composante connexe est maintenant disposée pour elle-même (colonnes par
profondeur **locale**, tri par barycentre) et les composantes s'empilent en
bandes ; les tâches vraiment isolées vont en grille compacte sous les chaînes.

**Tirage de lien** ajouté : une ancre sur le bord droit de chaque nœud, on tire de
A vers B pour dire « A d'abord, puis B ». `wouldCreateCycle()` **refuse** un lien
qui refermerait une boucle, avec un message — A → B → A laisserait les deux tâches
bloquées pour toujours, chacune attendant l'autre, sans que rien dans l'interface
puisse l'expliquer.

Le style des arêtes était **du code mort** : il choisissait plein ou pointillé sur
`from.doneAt`, mais `graphTasks()` exclut les tâches terminées, donc `doneAt` était
toujours nul et le trait plein ne pouvait jamais s'afficher. La légende annonçait
une distinction inexistante. Les arêtes encodent désormais le statut de la source
(« à faire maintenant » / « plus loin dans la chaîne »).

`DesktopShell` : le `onAddDependency` inline est devenu `handleAddDependency`
nommé, partagé par la fiche et le graphe, avec garde anti-doublon.

## Decisions — choix critiques

- **Aucune variante de design générée pour le calendrier.** `DESIGN.md` §7.2
  prescrivait déjà les voies : générer des variantes aurait re-débattu une
  décision inscrite. Pour la fiche et le graphe, où la latitude était réelle, la
  direction vient de `DESIGN.md` + `frontend-design`, et j'ai tranché seul comme
  Aramis l'a demandé (il était absent).
- **Un contrat de test a été changé volontairement.** `graph.test.ts` exigeait que
  deux tâches isolées partagent une colonne — c'était la description fidèle du
  bug. Remplacé par la nouvelle règle, plus un cas à 42 tâches qui interdit le
  retour de la colonne unique.
- **Les arêtes ne portent plus la couleur du projet.** `DESIGN.md` : une teinte
  désigne, elle ne décore jamais ; le liseré du nœud porte déjà le projet.
- **Le « +N autres » du calendrier déplie**, il ne compte pas. Aucun contrôle mort.
- **Palette d'étiquettes laissée saturée**, seul le contraste a été corrigé : la
  ramener au système à 3 destinations est un arbitrage produit pour Aramis.

## Changed — fichiers et composants

| Fichier | Nature |
|---|---|
| `src/lib/waveform.ts` | **NEW** — interpolation des niveaux sur les barres (+ `waveform.test.ts`, 6 tests) |
| `src/lib/calendarLanes.ts` | **NEW** — répartition en voies (+ `calendarLanes.test.ts`, 14 tests) |
| `src/lib/graph.ts` | `layoutGraph` refondu ; **NEW** `connectedComponents`, `wouldCreateCycle` |
| `src/lib/graph.test.ts` | 27 → **44 tests** ; un contrat changé (voir Decisions) |
| `src/components/Waveform.tsx` | `WaveformActive` accepte `levels`, pilotée en `scaleY` |
| `src/components/CaptureSheet.tsx` | prop `levels` transmise jusqu'à `ListeningStage` |
| `src/components/BriefApp.tsx` | `levels={recorder.levels}` — la ligne qui manquait |
| `src/components/desktop/DesktopKanban.tsx` | `DndContext` hissé au-dessus des deux blocs |
| `src/components/desktop/DesktopCalendar.tsx` | voies, plafond à 3, chip « +N » dépliable |
| `src/components/desktop/DesktopTaskDetail.tsx` | ordre refondu, `TagComposer`, `tagTextOn`, noms d'étiquettes en sidebar |
| `src/components/desktop/DependencyGraph.tsx` | ancres, tirage de lien, refus de boucle, arêtes par statut, légende |
| `src/components/desktop/DesktopShell.tsx` | `handleAddDependency` partagé, `onAddDependency` passé au graphe |

`package-lock.json` et `AGENTS.md` **intacts** (vérifié : `git diff --stat` vide).

## Validations

### ✅ Passants

| Commande | Résultat |
|---|---|
| `npx tsc --noEmit` | **0 erreur** |
| `npx eslint .` | **0 erreur** (30 warnings d'imports morts, antérieurs) |
| `npx vitest run` | **325 passed, 1 skipped** (285 au début de la session) |

**Recette dans un vrai Chromium** (Playwright, assertions mesurées et non
visuelles — géométrie des rectangles, coordonnées, contenu du disque) :

| Chantier | Preuve |
|---|---|
| Waveform | `prefers-reduced-motion: reduce` **actif dans la page**, 20 barres en `scaleY`, **18/20 bougent** (amplitude 0,65). Témoin de contrôle : les 5 barres animées en CSS de `WaveformIdle`, même page même instant, **0 qui bougent** |
| Kanban | **3 cartes** déplacées au geste sur 3 passages : `PATCH /api/items/…`, `columnId = col-doing` sur disque, sortie de la barre confirmée dans le DOM |
| Calendrier | 3 blocs côte à côte à 15h (`40/40/43px` contre `130px` seul), **0 paire qui se recouvre** ; déplié → 4 blocs `29/29/29/32px`, **0 recouvrement** |
| Fiche | Étiquette `y=270` **au-dessus** du titre `y=354` ; chaîne descendue à `y=937` ; panneau `x=210 w=756` (bouton `w=91`) donc sur sa ligne ; filtre `pho` → `["photo"]` ; Entrée crée + attache + persiste |
| Graphe | 37 tâches actives : **7 abscisses distinctes, 8 ordonnées, 0 recouvrement** (le modèle précédent donnait 1 et 37). Lien tiré → `dependsOn` écrit sur disque. Sens inverse → **refusé**, `dependsOn` inchangé avant/après |

Console navigateur : **0 erreur** sur les cinq recettes.

### ❌ Échoués

Aucun. Quatre faux négatifs sont venus de **mes scripts de recette**, jamais des
correctifs : sélecteurs trop larges, élément de sidebar confondu avec celui de la
colonne principale, et un passage sur un bundle pas encore recompilé par
`next dev`. Corrigés puis rejoués.

### ⚠️ Non lancés / À vérifier — **c'est là qu'il faut regarder d'abord**

1. **`npm run build` — jamais lancé.** `AGENTS.md` l'interdit tant qu'un
   `next dev` tourne, et il en tournait un pendant toute la session. **Un
   `next dev` peut encore tourner sur le port 3000** : l'arrêter avant. C'est le
   seul portail non franchi.
2. **Le rendu mobile.** Seul le desktop a été parcouru. Les chantiers 3/4/5 ne
   touchent que des composants `desktop/`, mais le **chantier 1 modifie
   `CaptureSheet.tsx` et `BriefApp.tsx`, qui servent le mobile.**
3. **Le tirage de lien au doigt.** Les ancres écoutent `mousedown` : sur écran
   tactile le geste n'est pas branché. Le graphe est desktop, mais c'est à savoir.
4. **La synchro CalDAV** — pas de `.env.local` de production en local, test
   d'intégration toujours skipped.
5. **Le « +N » du calendrier au-delà de 4 voies** — testé à 4 événements
   simultanés, pas à 10.

## Blockers

**Aucun blocage technique.** Trois points d'attention :

- **Rien n'est poussé.** Les 5 commits sont locaux sur
  `chantiers-frontend-2026-08-25`. Aramis relit avant tout push, tout merge et
  tout déploiement — consigne explicite, `/ship` interdit.
- **La prod est maintenant 8 commits en retard** (le VPS sert `3e619a0`).
- **`npm install` sous Windows abîme `package-lock.json`.** Avant tout commit
  depuis Windows : `git diff --stat package-lock.json` doit être vide.

## Next — la prochaine action

1. **Arrêter le `next dev` s'il tourne, puis lancer `npm run build`.** Le seul
   portail non franchi.
2. **Vérifier le rendu mobile de l'écran de capture** — le seul endroit où un
   chantier de cette session touche du code partagé avec le mobile.
3. **Faire relire les 5 commits à Aramis** avant push/merge. Le diff est lisible
   commit par commit : chaque message porte la cause racine et les mesures de
   recette.
4. **Trancher les deux arbitrages produit** consignés dans `TODOS.md` : le filtre
   projet de la ligne « Non placées », et la palette d'étiquettes.

---

## Historique des passations

| Date | Sujet | Agent | Fiche |
|---|---|---|---|
| **2026-08-25 (soir)** | **Cinq chantiers front-end : waveform, DnD Kanban, calendrier, fiche, graphe** | **Claude Code** | *(cette passation)* |
| 2026-08-25 (matin) | État du repo + défi Kanban/dépendances/Graphe pour Claude Code | Hermes Agent | [fiche](docs/handoffs/2026-08-25-hermes-etat-repo-mission-bugs.md) |
| 2026-08-24 (après-midi) | Vue Graphe et recette de l'existant | Claude Code | [fiche](docs/handoffs/2026-08-24-graphe-recette-claude-code.md) |
| 2026-08-24 (matin) | Kanban, tags, dépendances, fiche tâche, donut fix | Hermes Agent | [fiche](docs/handoffs/2026-08-24-kanban-tags-dependances-fiche.md) |
| 2026-08-23 (matin, 2e) | Desktop V1.1 : Réglages, priorités, IA, projets | Hermes Agent | [fiche](docs/handoffs/2026-08-23-hermes-kanban-tags-deps.md) |
| 2026-08-23 (matin) | Déploiement desktop V1 + audio/IA du 22/08 | Hermes Agent | [fiche](docs/handoffs/2026-08-23-hermes-deploy-desktop-v1.md) |
| 2026-08-23 (nuit) | Version desktop V1 (5 écrans, nav pilule, dashboard 3 cartes) | Claude Code | [fiche](docs/handoffs/2026-08-23-claude-code-desktop-v1.md) |
