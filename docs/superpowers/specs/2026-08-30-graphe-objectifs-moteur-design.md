# Spec — Graphe & Objectifs : le moteur

| | |
|---|---|
| **Date** | 2026-08-30 |
| **Agent** | Claude Code (Sonnet 5) |
| **Chantier** | A + B fusionnés — graphe des dépendances exploitable + objectifs éditables et reliables |
| **Branche** | `feat/graphe-objectifs-moteur` |
| **Statut** | Design — en attente de relecture Aramis avant `writing-plans` |

## Objectif

Faire du graphe l'outil de planification qu'Aramis décrit dans sa dictée du
30/08 : les objectifs y sont l'ossature (chaînes tâche → objectif → objectif),
les rendez-vous y entrent, la disposition qu'on choisit tient, et une
dépendance se crée **et se défait** au geste. En parallèle, rendre les
objectifs modifiables (horizon, titre, notes) — aujourd'hui bloqués sur
« moyen terme » faute d'écran d'édition.

Périmètre volontairement resserré (dictée Aramis) : **aucun nouvel onglet**,
on polit l'existant jusqu'à ce qu'il soit fluide et sans bug.

## Contexte lu dans le code

| Fichier | Ce qu'il fait aujourd'hui |
|---|---|
| `src/lib/types.ts` | `Objective { id, projectId, title, horizon, createdAt, achievedAt, notes? }`. `Item.dependsOn?: string[]`, `Item.objectiveId?: string \| null`, `Item.kind: "task" \| "event"`. |
| `src/lib/objectives.ts` | Logique pure : `objectiveProgress`, `objectivesByProject`, `objectiveEdges` (tâche → objectif, seulement tâches actives liées). |
| `src/lib/graph.ts` | `graphTasks()` = `kind === "task" && !doneAt` — **exclut events ET tâches faites**. `layoutGraph(list, metrics, pinned)` — `pinned` déjà géré, écrase le calcul. `wouldCreateCycle` garde les cycles à la création. |
| `src/components/desktop/DependencyGraph.tsx` | 1318 l. `pinned` = `useState` local, **jamais persisté**. `onAddDependency` câblé ; **aucun** `onRemoveDependency`. Nœuds objectifs placés à `maxX + W + OBJ_GAP_X` — se chevauchent avec les tâches (bug capture 1). Objectifs sans tâche liée non affichés, ni draggables ni cliquables. |
| `src/components/desktop/DesktopObjectives.tsx` | Création seule. Pas d'édition. « Vue Asana » ligne 118. |
| `src/app/api/objectives/route.ts` | `PATCH` accepte déjà `title / horizon / achievedAt / notes`. |
| `src/app/api/items/[id]/route.ts` | `sanitizePatch` accepte déjà `dependsOn`, `objectiveId`. |
| `src/lib/api.ts` | `updateObjective(id, patch)` prêt (title/horizon/achievedAt/notes). `onSaveItem` = chemin d'écriture unique pour `dependsOn`. |
| `src/lib/store.ts` | Fichiers JSON, écriture atomique, file sérialisée. `readItems()` **normalise à la lecture** sans réécrire (précédent pour la réconciliation). |
| `src/lib/queue.ts`, `BriefApp.tsx` | localStorage déjà utilisé pour des conveniences de vue côté client (file hors-ligne, brouillon de transcription). |
| `src/lib/completion.ts` | Une tâche récurrente n'a jamais `doneAt` tant que la série tourne (elle avance). |

## 1. Modèle de données

**`Objective.dependsOn?: string[]`** — IDs de tâches et d'objectifs. Un ID
d'objectif est préfixé `obj:` (comme `objectiveNodeId()` le fait déjà) pour ne
jamais le confondre avec un `Item.id`.

**`Objective.achievedManually?: boolean`** — distingue « atteint parce que
tout est fait » (auto, réversible) de « je l'ai marqué atteint » (collant,
jamais rouvert tout seul). Posé `true` au clic « marquer atteint », `false`
au clic « rouvrir ».

**`Item.objectiveId` ne change pas.** Une tâche avec `objectiveId = X` est une
dépendance **implicite** de X — jamais dupliquée dans `X.dependsOn`.

**Dépendances effectives d'un objectif** =
`{ items où objectiveId === obj.id } ∪ { obj.dependsOn résolus }`.

`store.ts::normalizeItem` équivalent pour les objectifs : `readObjectives()`
garantit `dependsOn: []` en mémoire sans réécrire le fichier.

## 2. Auto-complétion des objectifs

`src/lib/objectives.ts`, fonctions pures testées :

```
objectiveSatisfied(objective, itemsById, objectivesById): boolean
  - false si 0 dépendance effective (rien à accomplir)
  - false si une dépendance-tâche n'a pas doneAt
    (récurrente = jamais satisfaisante tant que la série tourne — comportement
    déjà en place, on ne le contourne pas)
  - false si une dépendance-objectif n'a pas achievedAt
  - true sinon

reconcileObjectives(items, objectives): Objective[]
  pour chaque objectif :
    - actif + satisfied + !achievedManually        → achievedAt = now
    - achievedAt posé + !achievedManually + !satisfied → achievedAt = null (rouvert)
    - achievedManually                              → intact
  déterministe : ne réécrit que ce qui change.
```

**Où c'est appelé (serveur) :**
- `setItemDone` / `PATCH /api/items/[id]` quand `doneAt`, `dependsOn` ou
  `objectiveId` bougent → `reconcileObjectives` + `writeObjectives` si delta.
- `PATCH /api/objectives` quand `dependsOn` bouge → idem.
- `GET /api/objectives` : garde-fou de lecture (réconcilie et réécrit si delta),
  même esprit que `readItems()`.

**Le lien tâche → objectif ne bloque PAS la tâche.** `graphStatus(item)` ne
regarde toujours que `item.dependsOn` entre items. Ce qui change : l'*objectif*
se complète. → renversement #1 de `DECISIONS.md` (voir §9).

## 3. Graphe — ce qui entre dans la vue

`src/lib/graph.ts` : `graphTasks()` → `graphNodes(items, { showDone, showEvents })`.

- tâches actives (`kind: "task"`, `status: "active"`, `!doneAt`) — inchangé
- **+ events actifs** (`kind: "event"`) si `showEvents` — **un nœud par série**,
  pas par occurrence. Un event récurrent affiche « récurrent · lun+jeu »
  (dérivé de `rrule`) au lieu d'une échéance unique.
- **+ tâches faites** si `showDone`, mais **seulement** celles dont la
  composante connexe (`connectedComponents`) contient ≥1 nœud actif — jamais
  une tâche faite isolée.

`graphStatus` d'un event : `ready` par défaut (engagement debout), `blocked`
si `dependsOn` non satisfaits. Pas de `done` pour un event récurrent.

**Deux toggles** dans la barre de filtres, à côté de « Bloquées » :

| Toggle | Défaut | Raison |
|---|---|---|
| RDV | **ON** | Aramis : le Sport n'est QUE des RDV, il doit les voir |
| Faites | **OFF** | évite le fouillis qui avait motivé la décision de masquage ; ON quand on veut relire l'historique d'une chaîne |

## 4. Graphe — les objectifs comme nœuds

**Phasage** : branche 1 les rend **visibles et bien placés** (statiques) ;
branche 2 les rend **interactifs** (drag / clic / cible de lien).

**Tous les objectifs actifs** apparaissent (fin de la condition « ≥1 tâche
liée visible »).

Nouveau passage de layout **`layoutObjectives(objectives, items, nodePositions, metrics)`**
dans `graph.ts`, testé — renvoie `Map<objNodeId, Point>` :
- couloir dédié : `x = (max x des nœuds placés dans nodePositions) + W + GAP`
  (donc à droite des tâches en branche 1, des tâches + events en branche 2)
- objectif qui dépend d'un autre objectif → colonne encore à droite
  (chaînes objectif → objectif)
- ancre verticale = moyenne des `y` des dépendances placées ; sans dépendance
  placée → prochain créneau libre en haut du couloir
- résolution de collision **dans** le couloir : tri par ancre, empilage avec
  `VGAP` minimum

→ **corrige le bug de superposition** (capture 1) : un nœud objectif ne
partage plus jamais l'espace d'un nœud tâche.

**Objectifs interactifs :**
- **draggables** — `pinned` s'applique aussi aux clés `obj:<id>`
- **cliquables** — panneau de détail léger : dépendances amont (tâches +
  objectifs), progression `done/total`, bouton « Ouvrir l'écran Objectifs ».
  Pas d'édition ici.
- **cible de tirage de lien** : tirer d'une tâche/objectif **vers** un objectif
  → ajoute à `Objective.dependsOn`. Tirer d'un objectif **vers** une tâche →
  l'objectif dépend d'elle. `wouldCreateCycle` étendu aux nœuds `obj:`.

→ renversement #2 de `DECISIONS.md` (voir §9).

## 5. Retirer une dépendance (B2)

- `DependencyGraph` reçoit **`onRemoveDependency(targetId, depId)`** — miroir
  de `onAddDependency`. Câblé dans `DesktopShell::handleRemoveDependency` :
  route vers `updateObjective` (dépendance d'objectif) ou `onSaveItem`
  (dépendance d'item) selon le préfixe `obj:` de `targetId`.
- **geste graphe** : survol d'une arête → petit « × » à mi-tracé → clic
  supprime. Zone de survol = un tracé SVG large invisible (`pointer-events:
  stroke`) doublant chaque arête (le `<svg>` actuel est `pointer-events-none`).
- **panneau de détail** : chaque ligne « DÉPEND DE » gagne un bouton retirer.

## 6. Persistance de la disposition (B1)

**localStorage**, clé `brief:graph-layout` → `{ [nodeId]: { x, y } }`.

- même patron que `src/lib/queue.ts` et le brouillon de transcription —
  précédent établi pour une préférence de vue côté client
- élagage des ids inconnus au chargement (positions de nœuds supprimés)
- écriture **debouncée** à la fin d'un glisser (pas à 60 Hz)
- « Réinitialiser la disposition » vide la clé
- **limite assumée** : ne suit pas d'une machine à l'autre (Mac ↔ Windows).
  Acceptable — cosmétique, et « Ajuster » recalcule une disposition propre.
  Pas un fichier serveur : éviter d'accumuler des positions mortes, et la
  persistance serveur devrait de toute façon être refaite au pivot
  multi-utilisateur.

## 7. Objectifs éditables (A1)

`src/components/desktop/DesktopObjectives.tsx` :

- clic sur une ligne d'objectif → elle se **déplie** : champ titre, sélecteur
  d'horizon segmenté (les 3 boutons existent déjà dans le formulaire de
  création — réutilisés en composant), zone de notes. « Enregistrer » /
  « Annuler » → `updateObjective(id, { title?, horizon?, notes? })`.
- ligne dépliée : liste des dépendances (tâches + objectifs) avec bouton
  retirer ; l'**ajout** se fait par le graphe (tirage de lien) — pas de
  sélecteur ici (YAGNI)
- bouton « **rouvrir** » sur un objectif atteint →
  `updateObjective(id, { achievedAt: null, achievedManually: false })`
- clic « marquer atteint » → `updateObjective(id, { achievedAt: now,
  achievedManually: true })`
- **« Vue Asana » retiré** (ligne 118) — légende réduite à
  « court → moyen → long terme »

## 8. Hors périmètre (YAGNI)

- pas de nouvelle bibliothèque de graphe
- pas de validation de cycle serveur-side (le geste garde déjà à la création)
- pas de nœud occurrence-par-occurrence pour les récurrents
- pas de panneau objectif riche — le détail léger suffit, l'écran Objectifs
  reste le lieu du cycle de vie
- `DetailPanel` du graphe reste en lecture (+ retrait de dépendance)
- pas de synchro de la disposition entre machines
- Kanban Trello, hover global, calendrier, réglages→profil, toasts : chantiers
  séparés, restent dans `TODOS.md`

## 9. Renversements de `DECISIONS.md` à acter

Chacun aura son entrée datée en tête de `DECISIONS.md`, avec son POURQUOI.

1. **Le lien tâche → objectif complète l'objectif (auto), sans bloquer la
   tâche.** La décision du 30/08 posait le lien « non bloquant » quand
   l'objectif était un nœud passif. Aramis (dictée 30/08 soir) veut l'objectif
   comme moteur du graphe — terminus d'une chaîne qui se clôt quand tout est
   fait. Nuance : on ne bloque pas les tâches, on complète l'objectif.

2. **Objectifs draggables et cliquables dans le graphe.** La décision du 30/08
   les figeait (« leur écran gère leur cycle de vie ») quand ils étaient
   décoratifs. Devenus l'ossature du graphe (chaînes objectif → objectif, tous
   visibles), ils doivent être manipulables.

3. **Tâches faites de retour dans le graphe, sous condition.** Le masquage
   total faisait perdre l'historique d'une chaîne. Retour *scopé* : toggle OFF
   par défaut, et seulement les tâches faites appartenant à une chaîne encore
   active — jamais une tâche faite isolée. Restaure le contexte sans le
   fouillis d'origine.

## 10. Découpage pour `writing-plans`

### Branche 1 — `feat/graphe-objectifs-moteur` (≈ « B‑1 + A‑1 »)

Fondations + corrections, zéro nouvelle interaction risquée.

1. Modèle : `Objective.dependsOn`, `Objective.achievedManually`, types + normalisation lecture
2. `objectives.ts` : dépendances effectives, `objectiveSatisfied`, `reconcileObjectives` — **TDD**
3. `graph.ts` : `layoutObjectives` (corrige superposition), tous les objectifs visibles — **TDD**
4. API : `PATCH /api/objectives` accepte `dependsOn` ; `reconcileObjectives` branché sur routes items + objectives + garde-fou `GET`
5. `DesktopObjectives` : édition inline (titre / horizon / notes), « rouvrir », « Vue Asana » retiré
6. Persistance localStorage de la disposition + élagage
7. Retrait de dépendance : `onRemoveDependency`, geste sur l'arête, bouton dans le panneau

### Branche 2 — 2ᵉ PR du même chantier (≈ « B‑2 + A‑2 »)

Les interactions.

8. `graph.ts` : `graphNodes(items, { showDone, showEvents })` — events (nœud série) + tâches faites scopées composante
9. Deux toggles « RDV » / « Faites » dans la barre de filtres
10. Objectifs interactifs : draggables, panneau de détail léger, cible de tirage de lien, chaînes objectif → objectif, `wouldCreateCycle` étendu aux `obj:`
11. Retour visuel d'auto-complétion (état « atteint auto » dans le graphe et l'écran Objectifs)

## 11. Validation

- `objectives.ts` et `graph.ts` : suites Vitest neuves, tournent en UTC
  (`vitest.config.mts`), rouge → vert
- `npx tsc --noEmit` (après `next dev` + 1 requête — piège `LayoutProps`)
- `npx eslint .`
- QA live via `/browse` : créer un objectif, changer son horizon, le lier à
  2 tâches dans le graphe, cocher les tâches → objectif auto-atteint ;
  déplacer des nœuds, recharger → disposition tenue ; retirer une dépendance ;
  afficher les RDV et les tâches faites
- relecture du diff via `/code-review`
- merge + PR via `/ship`
- déploiement : **Hermes** (pas d'accès VPS depuis le Mac)
- passation : process `AGENTS.md` à la main (archive `HANDOFF.md`, nouveau
  `HANDOFF.md` 7 sections, `DECISIONS.md` pour les 3 renversements,
  `AGENTS.md` si un invariant bouge, `TODOS.md` pour le différé)
