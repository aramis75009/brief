# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui que
tu remplaces dans `docs/handoffs/`.

> **Multi-agents** : si tu n'es pas l'agent qui a écrit la dernière passation,
> tu reprends la main explicitement (nouvelle entrée). Lis aussi
> [`docs/coordination.md`](docs/coordination.md) — les copies du dépôt, la
> branche de prod, les règles anti-collision.

---

# Passation — 2026-08-24 (après-midi) · Vue Graphe et recette de l'existant

| | |
|---|---|
| **Agent** | **Claude Code** — *je reprends la main* sur `feat/ui-redesign-claude` (passation précédente : Hermes Agent) |
| **Branche** | `feat/ui-redesign-claude` — **la branche que sert le VPS** |
| **Commits** | **aucun** — tout est dans l'arbre de travail local, voir Blockers |
| **Base** | `1453a66` |

## Goal — l'objectif

Implémenter le prototype Claude Design « Graphe des dépendances », puis
**vérifier à l'exécution** ce que la passation précédente affirmait livrer.

## Current state — ce qui a été fait

### 1. La vue Graphe (neuve)

Prototype récupéré via le MCP Claude Design (projet
`09ade92e-adc6-425f-a0d6-965b4638eeea`) et porté intégralement.

**`src/lib/graph.ts`** — la logique pure, sans React ni DOM :
`graphStatus()` (trois statuts), `graphTasks()` (jamais les RDV),
`visibleTasks()` (filtre projet + « bloquées », qui garde le bloqué **et toute
son ascendance**, y compris à travers les projets), `graphEdges()`, `depths()`
(plus long chemin = colonne, **tolérant aux cycles** — `dependsOn` n'est
contraint nulle part, A → B → A ferait boucler un parcours naïf),
`layoutGraph()` (tri par barycentre, positions épinglées prioritaires),
`boundingBox()`, `unlocks()`.

**`src/components/desktop/DependencyGraph.tsx`** — pan, zoom molette ancré au
pointeur, nœuds déplaçables, arêtes Bézier (couleur du projet source, **plein =
dépendance levée / pointillé = elle bloque encore**), sélection qui estompe tout
sauf le voisinage, panneau de détail 428 px, filtres, légende, état vide.
Nœuds calqués sur `KanbanCard`.

### 2. Recette de la passation précédente — tout vérifié dans le navigateur

Chaque affirmation de Hermes a été rejouée sur un jeu d'essai de 11 tâches
liées. **Tout tient.** Détail dans Validations.

### 3. Trois correctifs trouvés en passant

- **Boutons imbriqués (`HomeScreen.tsx`)** — `TodayRow` était un `<button>`
  contenant `RowCheckbox`, lui-même un `<button>`. HTML invalide, **erreur
  d'hydratation React à chaque chargement**. La ligne est maintenant un
  conteneur neutre avec deux boutons frères ; le rendu est identique. Console
  vérifiée : **plus aucune erreur**.
- **Typo `EXistantes`** dans le TagPicker (`DesktopTaskDetail.tsx:175`) →
  `EXISTANTES`, avec le `letter-spacing: 0.09em` des autres libellés mono.
- **`docs/coordination.md`** disait « le Mac d'Aramis » ; cette session tournait
  sous Windows. Copie 4 = « la machine d'Aramis (Mac ou Windows) ».

## Decisions — choix critiques

- **Deux statuts de tâche, trois statuts affichés.** Arbitrage d'Aramis, entrée
  complète dans `DECISIONS.md`. Pas d'orange « bientôt » tant que de vrais
  statuts n'existent pas. Quand ils arriveront, **seule `graphStatus()` change**
  — la vue, la légende et le panneau lisent tous leur statut par elle.

- **Pas de `reactflow`.** La passation précédente le prévoyait, avant que le
  prototype n'existe. Le prototype décrit lui-même son pan/zoom en `transform`
  CSS et ses Bézier en SVG : une centaine de lignes lisibles, contre une
  dépendance qu'il aurait fallu reskinner entièrement pour retomber sur ce
  dessin. **Aucune dépendance ajoutée — `package.json` est inchangé.**

- **Le double-clic ouvre la vraie fiche** (`DesktopTaskDetail`), il ne rejoue
  pas la modale du prototype. Claude Design ne pouvait pas naviguer, il a donc
  dessiné une fiche de substitution ; Brief en a déjà une, plus riche.

- **Le graphe est en lecture seule.** On y sélectionne, on y navigue ; on n'y
  coche ni ne supprime rien. Les actions appartiennent à la fiche.

- **Badge de nav « Graphe » = nombre de tâches bloquées** — le seul chiffre que
  cette vue apprend et qu'aucun autre onglet ne montre.

## Changed — fichiers et composants

| Fichier | Nature |
|---|---|
| `src/lib/graph.ts` | **NEW** — logique pure du graphe (statuts, filtres, colonnes, positions) |
| `src/lib/graph.test.ts` | **NEW** — 24 tests |
| `src/components/desktop/DependencyGraph.tsx` | **NEW** — la vue (canvas, nœuds, arêtes, panneau) |
| `src/components/desktop/DesktopHeader.tsx` | +onglet « Graphe » dans `NAV_ITEMS` |
| `src/components/desktop/DesktopShell.tsx` | +écran `graphe`, +badge « bloquées » |
| `src/components/desktop/DesktopTaskDetail.tsx` | fix typo `EXistantes` → `EXISTANTES` |
| `src/components/HomeScreen.tsx` | fix `<button>` imbriqué dans `TodayRow` |
| `docs/coordination.md` | copie 4 : Mac **ou Windows** |
| `DECISIONS.md` | +entrée « Deux statuts de tâche, pas quatre » |
| `TODOS.md` | +dette : DnD Kanban non vérifié, 3 erreurs eslint dans `DesktopTaskDetail` |

## Validations

### ✅ Passants

| Commande / geste | Résultat |
|---|---|
| `npx tsc --noEmit` | propre |
| `TZ=UTC npx vitest run` | **285 passed, 1 skipped** (+24 vs 261) |
| `npx eslint` sur les 5 fichiers du graphe | **0 erreur, 0 warning** |
| Console navigateur, chargement complet | **0 erreur** (2 avant le fix HomeScreen) |

**Vérifié à l'exécution** (`next dev`, Chrome 1920×911, jeu d'essai de 11 tâches) :

| Affirmation de la passation précédente | Constat |
|---|---|
| Donut « Aujourd'hui » ne compte plus 0 % | **33 %** avec 1 tâche du jour sur 3 cochée |
| Label « Cette semaine », projets en barres | présents, IA à 1/2 en vert |
| Kanban : « N ouvertes », chips projets, « Non placées » | 7 ouvertes, 4 chips, 7 cartes non placées |
| Kanban : créer / supprimer une colonne | « En relecture » créée puis supprimée, persistée en API |
| `sanitizePatch` accepte `columnId`/`tags`/`dependsOn`/`subtasks` | les 4 acceptés et persistés |
| Carte Kanban : tags, pastille, échéance, progression | 2 barres de tags, 3/4 affiché |
| Fiche : bandeau de blocage, chaîne AVANT/ICI/APRÈS | présents, `×` par dépendance |
| Fiche : DependencyPicker | recherche « Rechercher une tâche… » + projet + échéance courte |
| Ajout / retrait de dépendance | persisté ; bandeau passe à « 2 tâches » puis « 1 tâche » |
| Fiche : TagPicker + click-outside | s'ouvre, se ferme au clic extérieur |
| ColorPicker en pastilles françaises | Jaune…Bleu ciel, en `title` sur les 10 pastilles |
| TagManager (Réglages) : créer / supprimer | tag `test-qa` créé en Turquoise puis supprimé |
| Sous-tâches éditables | ajout persisté |
| Toast de validation | « Tâche terminée ✓ » puis « Tâche rouverte » |
| Vue Graphe (neuve) | 11 nœuds en 5 colonnes, badge 5, filtre bloquées 11→10, filtre projet → 3 tâches · 2 dépendances |

### ❌ Échoués

Aucun.

### ⚠️ Non lancés

- **Le drag & drop du Kanban** (`@dnd-kit`) — ne se simule pas fidèlement en
  automatisation. Reporté dans `TODOS.md` § Dette connue. **C'est le seul geste
  du Kanban dont personne ne sait s'il marche** : le placement de carte a été
  prouvé par l'API, pas par le glisser.
- **`npm run build`** — `AGENTS.md` l'interdit tant qu'un `next dev` tourne.
- **La synchro CalDAV** — pas de `.env.local` de production ici ; le test
  d'intégration `caldav.integration.test.ts` reste skipped.
- **Le rendu mobile** — seul le desktop a été parcouru.

## Blockers

**Rien ne bloque techniquement. Une seule décision t'appartient : commiter ou non.**

Rien n'est commité — `AGENTS.md` dit « ne pas commiter ni pousser sans demande
explicite d'Aramis », et cette branche sert la prod.

```
 M DECISIONS.md
 M HANDOFF.md
 M TODOS.md
 M docs/coordination.md
 M src/components/HomeScreen.tsx
 M src/components/desktop/DesktopHeader.tsx
 M src/components/desktop/DesktopShell.tsx
 M src/components/desktop/DesktopTaskDetail.tsx
?? docs/handoffs/2026-08-24-kanban-tags-dependances-fiche.md
?? src/components/desktop/DependencyGraph.tsx
?? src/lib/graph.ts
?? src/lib/graph.test.ts
```

`package-lock.json` et `AGENTS.md` sont **intacts** — vérifié.

## Points à connaître

1. **`npm install` sous Windows abîme `package-lock.json`** : il retire les
   champs `libc` que le lockfile généré sous Linux contient (144 suppressions,
   aucune dépendance touchée). Restauré. **Avant tout commit depuis Windows :
   `git diff --stat package-lock.json` doit être vide** si aucune dépendance
   n'a bougé.

2. **`npx tsc --noEmit` sort une erreur `LayoutProps` sur un checkout froid** —
   type généré par Next dans `.next/types`, absent tant qu'aucun `next dev` /
   `next build` n'a tourné. Pas une régression.

3. **`.env.local` créé en local** (gitignoré) : `BRIEF_PIN=1234` et un
   `BRIEF_DATA_DIR` pointant hors dépôt. **Le `data/` du dépôt n'a pas été
   touché** — il ne contient que 3 items et aucune tâche, donc aucune
   dépendance à afficher. Pour revoir la vue, refaire un jeu d'essai.

4. **`/browse` n'existe pas dans cet environnement** alors que `CLAUDE.md`
   l'impose pour naviguer le site. J'ai utilisé le MCP `claude-in-chrome`
   (skill `claude-in-chrome`). À trancher : rétablir `/browse` ou corriger le
   tableau d'arbitrage de `CLAUDE.md`.

5. Les points de la passation précédente restent valables : calendrier desktop
   buggé, priorités retirées de l'affichage, `DESIGN.md` §7 non corrigé,
   Horizon / Ton mur / Idées / Chaîne & sync retirés du Dashboard.

## Next — la prochaine action

1. **Décider du commit / push** (Aramis). Si oui : commit signé `Claude Code`,
   puis déploiement VPS selon `docs/coordination.md`.
2. **Tester le drag & drop du Kanban à la main** — le seul trou de la recette.
3. **Corriger le calendrier desktop** (gros chantier, toujours reporté).
4. **Scraper les concurrents** — `docs/research/concurrents-matrix-2026-08-23.md`.
5. **Quand les vrais statuts de tâche arriveront** : ne toucher que
   `graphStatus()` dans `src/lib/graph.ts`, et rétablir l'orange « bientôt ».

---

## Historique des passations

| Date | Sujet | Agent | Fiche |
|---|---|---|---|
| **2026-08-24 (après-midi)** | **Vue Graphe et recette de l'existant** | **Claude Code** | *(cette passation)* |
| 2026-08-24 (matin) | Kanban, tags, dépendances, fiche tâche, donut fix | Hermes Agent | [fiche](docs/handoffs/2026-08-24-kanban-tags-dependances-fiche.md) |
| 2026-08-23 (matin, 2e) | Desktop V1.1 : Réglages, priorités, IA, projets | Hermes Agent | [fiche](docs/handoffs/2026-08-23-hermes-kanban-tags-deps.md) |
| 2026-08-23 (matin) | Déploiement desktop V1 + audio/IA du 22/08 | Hermes Agent | [fiche](docs/handoffs/2026-08-23-hermes-deploy-desktop-v1.md) |
| 2026-08-23 (nuit) | Version desktop V1 (5 écrans, nav pilule, dashboard 3 cartes) | Claude Code | [fiche](docs/handoffs/2026-08-23-claude-code-desktop-v1.md) |
