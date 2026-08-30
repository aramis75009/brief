# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui
que tu remplaces dans `docs/handoffs/`.

> **Multi-agents** : si tu n'es pas l'agent qui a écrit la dernière passation,
> tu reprends la main explicitement (nouvelle entrée). Lis aussi
> [`docs/coordination.md`](docs/coordination.md).

---

# Passation — 2026-08-30 (nuit) · Graphe & Objectifs déployé + recette round 1 — reprise par Opus 5

| | |
|---|---|
| **Agent** | **Claude Code (Sonnet 5)** — Aramis passe la main à **Opus 5** pour la suite (« tu n'es pas assez puissant »). |
| **Branches** | `main` = `71f31a9` — **déployée en prod** (Hermes, HTTP 202 sur le webhook, `71f31a9`). `fix/deploy-sh-macos` (`6c2a3b3`, poussée, non mergée). |
| **Prod** | `https://brief.srv1899780.hstgr.cloud` — chantier graphe/objectifs EN LIGNE, recette round 1 déployée. |

## Goal

Chantier A+B (graphe = moteur de planification + objectifs éditables) livré,
déployé, et en cours de recette par Aramis sur la prod.

## Current state — ce qui a été fait

**PR #3 « graphe & objectifs — le moteur »** : mergée (`32da200`), déployée.
Détail complet dans `docs/handoffs/2026-08-30-graphe-objectifs-moteur-pr3.md` et
`DECISIONS.md` (entrée 2026-08-30 soir, les 3 renversements).

**Canal de déploiement** : Hermes a monté un webhook. `bash
.claude/commands/deploy.sh "<message>"` → POST signé → Hermes déploie
`main` sur le VPS → confirmation Telegram. Secret `WEBHOOK_SECRET` dans
`.env.local` du Mac (ajouté, gitignoré). **`deploy.sh` avait un bug macOS**
(`head -n -1` GNU-only) — corrigé sur `fix/deploy-sh-macos`, **à merger**.

**Recette round 1 (feedback Aramis sur prod, déployé dans `71f31a9`)** — 4
points corrigés :

1. **Nœud objectif illisible** → agrandi (96 px), titre = élément dominant
   (15 px extrabold, 2 lignes), affiche le **nom du projet** en texte + barre
   de progression. Avant : on ne voyait que « OBJECTIF · COURT TERME » et la
   couleur.
2. **Label de récurrence qui débordait** du nœud tâche (« tous les lundis,
   mardis... ») → ellipsé + tooltip.
3. **Écran Objectifs ne montrait pas les tâches reliées dans le graphe** →
   `objectivesByProject` / `openTasksFor` utilisent `effectiveDeps`
   (implicites `objectiveId` + explicites `dependsOn`). Progression via
   `objectiveEffectiveProgress`.
4. **Copywriting** « court → moyen → long terme » retiré de l'en-tête Objectifs.

## Blockers — ce qui bloque

**QA navigateur authentifiée toujours pas faite.** Le `.env.local` du Mac n'a
pas les clés Supabase (voir mémoire), et l'import de cookie Chrome via
`/browse` attend un clic sur la popup macOS Keychain « Chrome Safe Storage »
qu'Aramis n'a pas encore validé. Seule vérif faite : la prod charge sans crash
JS, l'écran de connexion s'affiche, pas d'erreur console.

## Next — pour Opus 5

1. **Bug ouvert : « Poster 20 » / « Reposter 15 » (récurrences vendredi-
   dimanche) absentes du graphe.** « Poster 10 » / « Reposter 10 » (lun-jeu)
   s'affichent. Vérifier avec les données prod : `GET /api/items` (session
   authentifiée), chercher ces titres, regarder `doneAt` / `status` / `rrule`
   / `kind`. Hypothèses : `doneAt` posé (série marquée finie → exclue par
   `graphNodes`, visible sous le toggle « Faites »), mauvais `status`, ou
   juste hors écran dans la grille des isolées.
2. **Merger `fix/deploy-sh-macos`** (`6c2a3b3`) — 1 ligne, sans quoi `deploy.sh`
   plante sur le Mac d'Aramis.
3. **QA complète** une fois la session prod accessible : créer un objectif →
   Graphe → tirer un lien de l'ancre d'une tâche vers l'objectif ×2 → cocher
   les 2 tâches → l'objectif passe « atteint » ; déplacer des nœuds + recharger
   (disposition tenue) ; survoler une arête → « × » → dépendance retirée ;
   toggles « RDV » et « Faites » ; nœud objectif lisible (titre + projet).
4. Reste des notes de session 30/08 (`TODOS.md` P3) non traité : Kanban Trello,
   raccourcis flèches, calendrier à repenser, réglages→profil, toasts, hover
   global.

## Validations — passants / échoués / non lancés

```
$ npx vitest run     → 426 passants, 1 skipped (32 fichiers)
$ npx tsc --noEmit   → 0 erreur (après next dev + 1 requête)
$ npx eslint .       → 0 erreur (30 warnings préexistants)
```

- **Non lancé** : QA navigateur authentifiée (blocage ci-dessus).
- **Non lancé** : `npm run build` (dev tournait).
- `/code-review high` : 2 passes sur PR #3, 13 constats traités. La recette
  round 1 (`71f31a9`) n'a **pas** été relue par `/code-review`.

## Changed — recette round 1

| Fichier | Nature |
|---|---|
| `src/lib/objectives.ts` | `openTasksFor` + `objectivesByProject` via `effectiveDeps` / `objectiveEffectiveProgress` |
| `src/lib/graph.ts` | `OBJ_METRICS` agrandi (W 264 / H 96) |
| `src/components/desktop/DependencyGraph.tsx` | nœud objectif restructuré (titre dominant + nom projet + barre) ; label récurrence ellipsé |
| `src/components/desktop/DesktopObjectives.tsx` | caption « court → moyen → long » retirée ; `openTasksFor` reçoit `objectives` |
| `.claude/commands/deploy.sh` | (sur `fix/deploy-sh-macos`) `head -n -1` → `sed '$d'` |

---

## Historique des passations

| Date | Sujet | Agent | Lien |
|---|---|---|---|
| 2026-08-30 (nuit) | Graphe & Objectifs déployé + recette round 1 — reprise Opus 5 | Claude Code | (cette passation) |
| 2026-08-30 (soir) | Graphe & Objectifs, le moteur — PR #3 | Claude Code | [fiche](docs/handoffs/2026-08-30-graphe-objectifs-moteur-pr3.md) |
| 2026-08-30 (session) | Chantier Objectifs & Projets codé, recette à faire | Hermes Agent | [fiche](docs/handoffs/2026-08-30-hermes-objectifs-projets-recette.md) |
| 2026-08-30 (pré-session) | Stabilisation déployée + spec Objectifs & Projets | Hermes Agent | [fiche](docs/handoffs/2026-08-30-pre-session-spec-objectifs-projets.md) |
| 2026-08-29 (nuit) | Occurrences manquées visibles — stabilisation 1/2 | Hermes Agent | [fiche](docs/handoffs/2026-08-29-nuit-occurrences-manquees.md) |
