# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui que
tu remplaces dans `docs/handoffs/`.

Le mode d'emploi complet est dans [`AGENTS.md`](AGENTS.md), section
« Terminer une session ». L'index des passations passées est en bas de page.

---

# Passation — 2026-08-15 · Amélioration du workflow des tâches (tri & filtre terminées)

| | |
|---|---|
| **Agent** | Hermes Agent v0.20.0 · `google/gemini-3.7-flash` via OpenRouter |
| **Branche** | `feat/task-completion` — **la branche que sert le VPS** |
| **Commits** | `feat: add task sorting by urgency/due/priority and done items toggle` |

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

## Decisions — choix critiques ou irréversibles

- **Conserver la vue groupée par Projet par défaut** pour préserver les repères habituels tout en permettant de basculer en un clic sur le tri par Urgence.
- **Masquer les tâches faites par défaut** pour alléger immédiatement la charge cognitive et mettre l'accent sur ce qui reste à accomplir.

## Changed — fichiers et composants

| Fichier | Nature |
|---|---|
| `src/lib/tasks.ts` | **créé** : logique de tri par urgence, priorité, échéance |
| `src/lib/tasks.test.ts` | **créé** : tests unitaires du tri |
| `src/components/TasksScreen.tsx` | enrichi : sélecteur de tri, toggle des items terminés, badges projet |
| `docs/handoffs/2026-08-14-n8n-digest-telegram.md` | **créé** — archive de la passation n8n/digest de Claude |
| `HANDOFF.md` | réécrit — passation courante |

## Validations — passants / échoués / non lancés

Lancées **après** l'implémentation complète :

| Commande | Résultat |
|---|---|
| `npx eslint .` | ✅ aucune erreur, aucun warning |
| `npx tsc --noEmit` | ✅ types stricts validés |
| `npx vitest run` | ✅ **89 tests passent** (7 suites) |

## Blockers — ce qui bloque

Rien. Branche locale saine et propre.

## Next — la prochaine action

Déployer le conteneur en production sur le VPS (`docker compose up -d --build`) et valider l'interaction sur l'iPhone d'Aramis.

---

## Historique des passations

| Date | Sujet | Agent | Fiche |
|---|---|---|---|
| **2026-08-15** | **Amélioration du workflow tâches (tri & terminées)** | **Hermes Agent** | *(cette passation)* |
| 2026-08-14 | Brief parle à n8n, récap du matin sur Telegram | Claude Code | [fiche](docs/handoffs/2026-08-14-n8n-digest-telegram.md) |
| 2026-08-14 | Déploiement prod + correctif projets invisibles | **Hermes** | [fiche](docs/handoffs/2026-08-14-deploiement-et-correctif-projets.md) |
| 2026-08-14 | Système de passation + correctif fuseau | Claude Code | [fiche](docs/handoffs/2026-08-14-systeme-passation-et-fuseau.md) |
| 2026-08-14 | Saisie clavier et modification des items | **Hermes** | [fiche](docs/handoffs/2026-08-14-saisie-clavier-et-edition-items.md) |
| 2026-08-13 | En ligne, en TLS, et le Web Push sonne | Claude Code | [fiche](docs/handoffs/2026-08-13-vps-tls-et-web-push-prouve.md) |
| 2026-08-11 | Projets gérés depuis Réglages | Claude Code | [fiche](docs/handoffs/2026-08-11-projets-en-reglages.md) |
| 2026-08-10 | Le pivot : Brief possède ses données | Claude Code | [fiche](docs/handoffs/2026-08-10-pivot-organiseur-autonome.md) |
| 2026-08-07 | Chaîne dictée → Todoist, et PWA | Claude Code | [fiche](docs/handoffs/2026-08-07-chaine-complete-et-pwa.md) |
| 2026-08-06 | Scaffold, UI, garde PIN et micro | Claude Code | [fiche](docs/handoffs/2026-08-06-scaffold-ui-et-garde-pin.md) |
