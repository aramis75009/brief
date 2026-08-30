# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui
que tu remplaces dans `docs/handoffs/`.

> **Multi-agents** : si tu n'es pas l'agent qui a écrit la dernière passation,
> tu reprends la main explicitement (nouvelle entrée). Lis aussi
> [`docs/coordination.md`](docs/coordination.md).

---

# Passation — 2026-08-30 (soir) · Graphe & Objectifs, le moteur — codé, PR ouverte, recette à faire

| | |
|---|---|
| **Agent** | **Claude Code (Sonnet 5)** — reprend la main depuis Hermes (passation « Objectifs & Projets », archivée). |
| **Branche** | `feat/graphe-objectifs-moteur` — **11 commits**, poussée, **PR [#3](https://github.com/aramis75009/brief/pull/3)** ouverte vers `main`. NON mergée. |
| **Prod** | **Inchangée.** `main` (post-PR #2). Rien de ce chantier n'est déployé. |
| **Bloqueur recette** | QA navigateur **non lancée** — pas d'accès session Supabase depuis le Mac (`.env.local` local date du 14/08, sans clés Supabase). |

## Goal — l'objectif

Rendre le graphe des dépendances utilisable comme outil de planification
(dictée Aramis du 30/08) : objectifs éditables et reliables, RDV dans le
graphe, disposition qui tient, dépendances qui se créent **et** se retirent au
geste. Chantiers A (objectifs) + B (graphe) fusionnés — Aramis les voulait
ensemble.

## Current state — ce qui a été fait

**Tout le code du chantier A+B est écrit, testé unitairement, relu deux fois
par `/code-review high`, et poussé en PR #3.** Détail dans la description de
la PR et dans `docs/superpowers/specs/2026-08-30-graphe-objectifs-moteur-design.md`.

Livré :

- **Modèle** : `Objective.dependsOn` (ids de tâches + d'objectifs `obj:`),
  `Objective.achievedManually`. `readObjectives` normalise les deux en mémoire
  (dont le rétro-remplissage `achievedManually = achievedAt != null` — sans
  quoi les objectifs historiques seraient rouverts en masse au 1er GET).
- **Auto-complétion** : `objectiveSatisfied` + `reconcileObjectives` (pures,
  testées, point fixe pour les chaînes). Réconcilié serveur-side **après toute
  mutation d'item** (POST/PATCH/[id] PATCH/[id] DELETE) en lecture-modification-
  écriture atomique (`store.updateObjectivesAtomically`). `reconcileObjectives`
  rend la même référence quand rien ne bouge → pas d'écriture inutile.
- **Écran Objectifs** : édition inline (titre / horizon / notes), bouton
  « rouvrir », section « atteints » repliable, « Vue Asana » retiré.
- **`layoutObjectives`** : couloir dédié à droite → **bug de superposition
  corrigé** (capture 1). Colonnes en cascade pour les chaînes objectif→objectif.
- **Graphe** : tous les objectifs actifs visibles ; objectifs draggables +
  ancre de tirage + double-clic → écran Objectifs + losange plein « atteint »
  (via `objectiveEffectiveProgress`, qui compte AUSSI les `dependsOn` explicites).
- **RDV** : toggle « RDV » (ON) — un nœud par série, chip « RDV », récurrence
  en clair (`describeRrule`). **Tâches faites** : toggle « Faites » (OFF) —
  seulement celles reliées à une chaîne active (`doneTasksInActiveChains`).
- **Retrait de dépendance** : « × » au survol d'une arête (tâche→tâche ET
  →objectif, y compris les liens implicites via `objectiveId`), bouton dans le
  panneau de détail.
- **Disposition persistée** : localStorage `brief:graph-layout`, par appareil.
  **Pas d'élagage au chargement** (l'ensemble des nœuds est incomplet au
  montage) ; « Réinitialiser » vide tout.

**Ce qui N'A PAS été fait :**

- **QA navigateur** — impossible sans session Supabase locale. Personne n'a vu
  ces écrans tourner. **C'est la première chose à faire en recette.**
- **`wouldCreateCycle` n'est pas étendu aux nœuds `obj:`** — décision assumée :
  une boucle d'objectifs ne bloque rien (elle ne se satisfait jamais), le point
  fixe de `reconcileObjectives` et le garde-cycle de `layoutObjectives`
  terminent tous les deux. Documenté dans le `onUp` de `DependencyGraph`.
- Liste des dépendances **dans l'éditeur d'objectif** (écran Objectifs) — le
  retrait se fait par le « × » du graphe. Reporté (voir `TODOS.md`).

## Decisions — choix critiques ou irréversibles

Trois entrées ajoutées en tête de `DECISIONS.md` (2026-08-30, avec leur
POURQUOI) :

1. **Le lien tâche → objectif complète l'objectif (auto), sans bloquer la
   tâche.** On ne bloque pas les tâches ; l'objectif, lui, est « satisfait »
   quand ses dépendances effectives le sont. Renverse la nuance « non bloquant »
   du 30/08 (posée quand l'objectif était un nœud passif).
2. **Objectifs draggables et cliquables dans le graphe.** Renverse « ni
   draggable ni cliquable » du 30/08 — devenus l'ossature du graphe.
3. **Tâches faites de retour dans le graphe, sous condition.** Toggle OFF par
   défaut, chaîne active seulement. Restaure le contexte sans le fouillis qui
   avait motivé le masquage total.

`AGENTS.md` mis à jour en conséquence (section « Interface — mobile et
desktop » et « Données et dates »).

## Changed — fichiers et composants

| Fichier | Nature |
|---|---|
| `src/lib/types.ts` | `Objective.dependsOn?`, `Objective.achievedManually?` |
| `src/lib/store.ts` | `normalizeObjective` (rétro-remplissage), `updateObjectivesAtomically` (RMW sérialisée) |
| `src/lib/objectives.ts` | `effectiveDeps`, `objectiveSatisfied`, `reconcileObjectives`, `objectiveGraphEdges`, `objectiveEffectiveProgress` — tous testés |
| `src/lib/objective-reconcile.ts` | **neuf** — `reconcileObjectivesInStore` (colle serveur) |
| `src/lib/graph.ts` | `graphNodes` (+ `doneTasksInActiveChains`), `layoutObjectives` (+ `OBJ_METRICS`), `visibleTasks` prend `showDone`/`showEvents` |
| `src/lib/graphLayout.ts` | **neuf** — localStorage de la disposition |
| `src/app/api/objectives/route.ts` | GET = pure lecture ; POST/PATCH/DELETE via `updateObjectivesAtomically` ; `cleanDeps` ; DELETE élague les liens `obj:<id>` |
| `src/app/api/items/route.ts`, `src/app/api/items/[id]/route.ts` | réconciliation **inconditionnelle** après chaque écriture d'item |
| `src/components/desktop/DependencyGraph.tsx` | persistance disposition, tous les objectifs, objectifs interactifs, toggles RDV/Faites, retrait de dépendance, nœuds RDV/faites |
| `src/components/desktop/DesktopObjectives.tsx` | édition inline, rouvrir, « atteints », `HorizonPicker` extrait, « Vue Asana » retiré |
| `src/components/desktop/DesktopShell.tsx` | `handleRemoveDependency`, `handleEditObjective`, `handleReopenObjective`, `refreshObjectives`, effet `itemsObjectiveSig`, `onOpenObjectives` |
| `src/lib/api.ts` | `updateObjective` accepte `dependsOn` + `achievedManually` |
| `docs/superpowers/specs/…`, `docs/superpowers/plans/…` | spec + plan du chantier |

## Validations — passants / échoués / non lancés

```
$ npx vitest run
 Test Files  31 passed | 1 skipped (32)
      Tests  425 passed | 1 skipped (426)

$ npx tsc --noEmit
(0 erreur — après `next dev` + 1 requête, piège LayoutProps)

$ npx eslint .
✖ 30 problems (0 errors, 30 warnings)   ← les 30 warnings sont préexistants
```

- **Non lancé : QA navigateur** (`/browse`) — pas de session Supabase locale.
  À faire en recette : créer un objectif, changer son horizon, le lier à
  2 tâches dans le graphe (ancre de tirage), cocher les tâches → objectif
  auto-atteint ; déplacer des nœuds + recharger → disposition tenue ; retirer
  une dépendance (× sur l'arête) ; activer « RDV » puis « Faites ».
- **Non lancé : `npm run build`** (un `npm run dev` tournait — règle du repo).
- `/code-review high` : **2 passes**, 13 constats, tous traités (commits
  `6d4a0ae` et `0c8f1bb`). Le plus grave : réouverture en masse des objectifs
  historiques au déploiement — corrigé par le rétro-remplissage `achievedManually`.

## Blockers — ce qui bloque

**La recette navigateur est bloquée côté Claude Code** : le `.env.local` du
Mac (14/08) n'a pas les clés Supabase (`NEXT_PUBLIC_SUPABASE_URL` /
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). Pour débloquer : Aramis ou Hermes
recette sur un environnement authentifié (prod-like ou VPS), OU Aramis ajoute
les clés au `.env.local` local.

Rien d'autre ne bloque — la PR est prête à être recettée puis mergée.

## Next — la prochaine action

**Hermes / Aramis** : recette la PR #3 sur un environnement authentifié
(scénario ci-dessus dans « Validations »). Si OK → merge PR #3 → déploie
(`ssh root@186.241.16.37 'cd /docker/brief && git pull origin main &&
docker compose --env-file .env.production up -d --build'` puis
`bash scripts/coord/status.sh`).

---

## Historique des passations

| Date | Sujet | Agent | Lien |
|---|---|---|---|
| 2026-08-30 (soir) | Graphe & Objectifs, le moteur — PR #3, recette à faire | Claude Code | (cette passation) |
| 2026-08-30 (session) | Chantier Objectifs & Projets codé, recette à faire | Hermes Agent | [fiche](docs/handoffs/2026-08-30-hermes-objectifs-projets-recette.md) |
| 2026-08-30 (pré-session) | Stabilisation déployée + spec Objectifs & Projets | Hermes Agent | [fiche](docs/handoffs/2026-08-30-pre-session-spec-objectifs-projets.md) |
| 2026-08-29 (nuit) | Occurrences manquées visibles — stabilisation 1/2 | Hermes Agent | [fiche](docs/handoffs/2026-08-29-nuit-occurrences-manquees.md) |
| 2026-08-29 (soir) | Landing SaaS `/landing` + logo vectoriel — déployé prod | Hermes Agent | [fiche](docs/handoffs/2026-08-29-landing-saas-deployee.md) |
