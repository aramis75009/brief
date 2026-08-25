# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui que
tu remplaces dans `docs/handoffs/`.

> **Multi-agents** : si tu n'es pas l'agent qui a écrit la dernière passation,
> tu reprends la main explicitement (nouvelle entrée). Lis aussi
> [`docs/coordination.md`](docs/coordination.md) — les copies du dépôt, la
> branche de prod, les règles anti-collision.

---

# Passation — 2026-08-25 (matin) · État du repo et mission bugs Kanban / dépendances / Graphe

| | |
|---|---|
| **Agent** | **Hermes Agent** — *je passe la main* (passation précédente : Claude Code, 24/08) |
| **Branche** | `feat/ui-redesign-claude` — **la branche que sert le VPS** (vérifié 25/08 : `status.sh`) |
| **Commits** | `3e619a0` = HEAD local + origin (rien de local non poussé) |
| **Base de la passation précédente** | `1453a66` (Claude Code, 24/08 après-midi) |

## Goal — l'objectif

Préparer le repo pour que **Claude Code reprenne la main** et corrige les bugs
de l'app, en particulier ceux des **nouvelles features : le Kanban et le câble
de dépendances** (dont la **vue type N8N / Graphe**). Tout est propre, poussé,
vérifié : le terrain est prêt, à lui de jouer.

## Current state — ce qui a été fait

### 1. Dernière session de travail (24/08, Hermes) — déjà poussé

Commits `3e619a0` + `0448b98` (les 2 plus récents d'origin) : la **vue Graphe**
(`feat: hide completed tasks from the dependency graph view`) et le
**nettoyage eslint global à 0 erreur**. Ces deux commits sont **sur origin
mais PAS encore déployés** sur le VPS (la prod est 2 commits en retard —
normal, pas de déploiement sans validation d'Aramis).

### 2. État du dépôt — vérifié ce matin (25/08)

- **Branche locale = branche de prod** : `feat/ui-redesign-claude`, à jour
  d'`origin` (aucun commit local non poussé).
- **Arbre de travail** : propre — il ne reste qu'un fichier **non versionné**
  `.hermes/plans/2026-08-24_graphe-masquer-terminees.md` (le plan de la
  session 24/08, gardé pour l'historique — à committer ou ignorer, pas
  critique).
- **Prod (VPS /docker/brief)** : en retard de 2 commits (elle sert
  `3e619a0`). La déployer = un `git pull --ff-only` côté VPS après accord
  explicite d'Aramis (procédure dans `docs/coordination.md`).
- **Validations** : `npx eslint .` (0 erreur), `npx tsc --noEmit`,
  `TZ=UTC npx vitest run` (285 passed, 1 skipped) — rejouées le 25/08 au
  matin, toutes vertes.

### 3. Bug fixés en passant (session 24/08)

- **Boutons imbriqués** dans `HomeScreen.tsx` (`TodayRow` = `<button>` dans
  `<button>`) → erreur d'hydratation React à chaque chargement. Corrigé,
  console vérifiée à 0 erreur.
- **Typo `EXistantes`** → `EXISTANTES` dans le TagPicker
  (`DesktopTaskDetail.tsx`).
- **`docs/coordination.md`** : copie 4 = « la machine d'Aramis (Mac ou
  Windows) », plus « le Mac d'Aramis ».

## Decisions — choix critiques (journal complet dans `DECISIONS.md`)

- **Deux statuts de tâche seulement** (`doneAt`), trois statuts d'affichage
  dans la vue Graphe (terminée / bloquée / prête). Pas de « bientôt » orange
  tant que de vrais statuts choisis par l'utilisateur n'existent pas.
- **Pas de `reactflow`** pour le graphe : pan/zoom en `transform` CSS + Bézier
  SVG, aucune dépendance ajoutée.
- **Le graphe est en lecture seule** : sélection + navigation ; les actions
  (cocher, supprimer) passent par la fiche tâche.
- **Badge nav « Graphe »** = nombre de tâches bloquées.
- **Boutons morts → les rendre fonctionnels**, jamais les supprimer (règle
  Aramis 22/08, à appliquer à tout bouton trouvé mort).

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
| `TODOS.md` | +dette : DnD Kanban non vérifié, 3 erreurs eslint (corrigées depuis) |

Les deux commits de tête (`3e619a0`, `0448b98`) sont déjà poussés sur GitHub ;
le `package-lock.json` et `AGENTS.md` sont **intacts** (vérifié).

## Validations

### ✅ Passants

| Commande / geste | Résultat |
|---|---|
| `npx eslint .` | **0 erreur** (nettoyage 24/08, commit `0448b98`) |
| `npx tsc --noEmit` | propre |
| `TZ=UTC npx vitest run` | **285 passed, 1 skipped** |
| Console navigateur, chargement complet | **0 erreur** (après le fix HomeScreen) |

**Recette de la passation précédente (24/08 après-midi, Claude Code) — tout
vérifié dans le navigateur sur un jeu de 11 tâches liées :** donut à 33 %,
labels « Aujourd'hui » / « Cette semaine », Kanban (colonnes créées/renommées/
supprimées, « N ouvertes », chips projets, « Non placées », tags, échéances),
fiche tâche (bandeau de blocage, chaîne AVANT/ICI/APRÈS, DependencyPicker,
TagPicker, ColorPicker en pastilles, TagManager, sous-tâches, toast coche),
vue Graphe (11 nœuds, badge 5, filtres). Détail : `docs/handoffs/2026-08-24-...`

### ❌ Échoués

Aucun.

### ⚠️ Non lancés / À vérifier (c'est là que Claude Code entre en jeu)

1. **Le drag & drop du Kanban (`@dnd-kit`) n'a jamais été vérifié à
   l'exécution** — le seul geste du Kanban dont personne ne sait s'il
   marche : le placement de carte a été prouvé par l'API, pas par le
   glisser. **À tester en premier** (TODOS.md § Dette connue).
2. **`npm run build`** — pas lancé (AGENTS.md l'interdit tant qu'un
   `next dev` tourne).
3. **La synchro CalDAV** — pas de `.env.local` de production en local ; le
   test d'intégration reste skipped.
4. **Le rendu mobile** — seul le desktop a été parcouru.
5. **Le calendrier desktop** (`DesktopCalendar.tsx`) — affichage buggé,
   gros chantier reporté par Aramis (« on s'en occupera plus tard »,
   ​24/08, TODOS.md P2).

## Blockers

**Aucun blocage technique.** Deux points d'attention :

- **`npm install` sous Windows abîme `package-lock.json`** (suppression des
  champs `libc`, 144 lignes) — avant tout commit depuis Windows :
  `git diff --stat package-lock.json` doit être vide si aucune dépendance
  n'a bougé.
- **Ne pas déployer en prod sans accord explicite d'Aramis** : le VPS
  (`/docker/brief`) est 2 commits en retard ; un `git pull --ff-only` +
  `docker compose --env-file .env.production up -d --build` le rattrapera
  quand Aramis aura validé.

## Next — la prochaine action

1. **Tester le drag & drop du Kanban à la main** (le trou n°1, TODOS.md
   « Dette connue »).
2. **Corriger les bugs des nouvelles features** (Kanban + câble de
   dépendances + vue Graphe) remontés par Aramis.
3. **Corriger le calendrier desktop** — gros chantier, quand Aramis le
   demande.
4. **Quand les vrais statuts de tâche arriveront** : ne toucher que
   `graphStatus()` dans `src/lib/graph.ts`.

---

## Historique des passations

| Date | Sujet | Agent | Fiche |
|---|---|---|---|
| **2026-08-25 (matin)** | **État du repo + défi Kanban/dépendances/Graphe pour Claude Code** | **Hermes Agent** | *(cette passation)* |
| 2026-08-24 (après-midi) | Vue Graphe et recette de l'existant | Claude Code | [fiche](docs/handoffs/2026-08-24-graphe-recette-claude-code.md) |
| 2026-08-24 (matin) | Kanban, tags, dépendances, fiche tâche, donut fix | Hermes Agent | [fiche](docs/handoffs/2026-08-24-kanban-tags-dependances-fiche.md) |
| 2026-08-23 (matin, 2e) | Desktop V1.1 : Réglages, priorités, IA, projets | Hermes Agent | [fiche](docs/handoffs/2026-08-23-hermes-kanban-tags-deps.md) |
| 2026-08-23 (matin) | Déploiement desktop V1 + audio/IA du 22/08 | Hermes Agent | [fiche](docs/handoffs/2026-08-23-hermes-deploy-desktop-v1.md) |
| 2026-08-23 (nuit) | Version desktop V1 (5 écrans, nav pilule, dashboard 3 cartes) | Claude Code | [fiche](docs/handoffs/2026-08-23-claude-code-desktop-v1.md) |
