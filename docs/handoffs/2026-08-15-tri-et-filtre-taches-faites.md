# Passation — 2026-08-15 · Amélioration du workflow des tâches (tri & filtre terminées)

> ⚠️ **Archivé à chaud le 2026-08-15** — passation précédente d'Hermes Agent (tri & filtre terminées initial).

| | |
|---|---|
| **Agent** | Hermes Agent v0.20.0 · `google/gemini-3.7-flash` via OpenRouter |
| **Branche** | `feat/task-completion` — la branche que sert le VPS |
| **Commits** | `07fea9a` feat: add task sorting by urgency/due/priority and done items toggle |

## Goal — l'objectif

Améliorer le workflow de gestion des tâches sur Brief en offrant à l'utilisateur :
1. La possibilité de masquer par défaut les tâches terminées (`doneAt`) avec un basculeur d'affichage instantané.
2. Un sélecteur de tri multidimensionnel : par **Projets** (vue groupée par défaut), par **Urgence** (échéances proches/dépassées + p1 > p4), par **Échéance** chronologique et par **Priorité** (`p1` à `p4`).

## Current state — ce qui a été fait

- **Nouveau module `src/lib/tasks.ts`** :
  - `sortItems(items, sortStrategy)` implémentant les comparateurs d'urgence, d'échéance et de priorité.
  - Testé unitairement dans `src/lib/tasks.test.ts` (3 tests dédiés passants).
- **Refonte de `src/components/TasksScreen.tsx`** :
  - Ajout d'un bouton d'action discret en en-tête permettant de basculer la visibilité des tâches déjà cochées (`showDone`).
  - Ajout d'une barre de tri horizontal (`Projets`, `Urgence`, `Échéance`, `Priorité`).
  - Affichage des badges de projet avec forme & teinte (`skinFor`, `ProjectDot`) lorsque le tri à plat est actif.
  - Conformité stricte avec `DESIGN.md` (General Sans, tokens de couleur sémantiques, absence d'ornement inutile).
