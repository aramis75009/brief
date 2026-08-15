# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui que
tu remplaces dans `docs/handoffs/`.

Le mode d'emploi complet est dans [`AGENTS.md`](AGENTS.md), section
« Terminer une session ». L'index des passations passées est en bas de page.

---

# Passation — 2026-08-15 · Dates en langage naturel coloré, design priorités et synthèse de tâches

| | |
|---|---|
| **Agent** | Hermes Agent v0.20.0 · `google/gemini-3.7-flash` via OpenRouter |
| **Branche** | `feat/task-completion` — **la branche que sert le VPS** |
| **Commits** | `feat: natural language relative due dates with colored chips, redesigned priorities and overdue/today summary counters` |

## Goal — l'objectif

Améliorer la lisibilité et la fluidité visuelle de l'onglet Tâches sur Brief :
1. Afficher les dates d'échéance en langage naturel dynamique (« Aujourd'hui », « Demain », « Après-demain », « Hier » / retard) avec sémantique de couleur (`formatRelativeDue`).
2. Rendre les badges de priorité plus design, précis et lisibles (`p1 · Urgent`, `p2 · Élevé`, `p3 · Normal`, `p4 · Basse`).
3. Ajouter une barre de synthèse compacte en tête d'écran avec badges d'alerte pour les tâches en retard et du jour.

## Current state — ce qui a été fait

- **`src/lib/due.ts` & `src/lib/due.test.ts`** :
  - Création de `formatRelativeDue(due, allDay, now)` qui calcule les jours calendaires relatifs en fuseau `Europe/Paris` et applique la charte de couleurs sémantique.
  - 4 nouveaux tests unitaires dédiés, tous passants.
- **`src/lib/projects.ts` & `src/lib/projects.test.ts`** :
  - Enrichissement de `PRIORITIES` avec libellés courts (`short`) et ajustement des contrastes bento (`Basse`, `Normal`, `Élevé`, `Urgent`).
- **`src/components/TasksScreen.tsx`** :
  - Intégration des badges de synthèse en haut de page (`N en retard`, `N aujourd'hui`).
  - Rendu visuel soigné des chips d'échéance naturelle et des priorités sur chaque carte d'item.

## Decisions — choix critiques ou irréversibles

- **Formatage naturel dynamique (Option C)** : calcul des jours calendaires via `zonedParts` / `zonedTime` de `src/lib/zoned.ts` pour garantir que minuit correspond bien au fuseau de Paris sans bug d'UTC.

## Changed — fichiers et composants

| Fichier | Nature |
|---|---|
| `src/lib/due.ts` | enrichi : `formatRelativeDue()` et type `RelativeDueInfo` |
| `src/lib/due.test.ts` | enrichi : tests de formatage naturel |
| `src/lib/projects.ts` | enrichi : refonte design/labels des priorités |
| `src/lib/projects.test.ts` | mis à jour suite au renommage `Basse` |
| `src/components/TasksScreen.tsx` | enrichi : compteurs de synthèse + rendu cartes |
| `docs/handoffs/2026-08-15-tri-et-filtre-taches-faites.md` | **créé** — archive passation précédente |
| `HANDOFF.md` | réécrit — passation courante |

## Validations — passants / échoués / non lancés

Lancées **après** l'implémentation complète :

| Commande | Résultat |
|---|---|
| `npx eslint .` | ✅ aucune erreur, aucun warning |
| `npx tsc --noEmit` | ✅ types stricts validés |
| `npx vitest run` | ✅ **93 tests passent** (7 test suites) |

## Blockers — ce qui bloque

Rien.

## Next — la prochaine action

Déployer sur le VPS et vérifier l'affichage sur l'iPhone.

---

## Historique des passations

| Date | Sujet | Agent | Fiche |
|---|---|---|---|
| **2026-08-15** | **Dates langage naturel coloré, priorités & synthèse** | **Hermes Agent** | *(cette passation)* |
| 2026-08-15 | Tri multi-critères et filtre des tâches terminées | Hermes Agent | [fiche](docs/handoffs/2026-08-15-tri-et-filtre-taches-faites.md) |
| 2026-08-14 | Brief parle à n8n, récap du matin sur Telegram | Claude Code | [fiche](docs/handoffs/2026-08-14-n8n-digest-telegram.md) |
| 2026-08-14 | Déploiement prod + correctif projets invisibles | **Hermes** | [fiche](docs/handoffs/2026-08-14-deploiement-et-correctif-projets.md) |
| 2026-08-14 | Système de passation + correctif fuseau | Claude Code | [fiche](docs/handoffs/2026-08-14-systeme-passation-et-fuseau.md) |
| 2026-08-14 | Saisie clavier et modification des items | **Hermes** | [fiche](docs/handoffs/2026-08-14-saisie-clavier-et-edition-items.md) |
| 2026-08-13 | En ligne, en TLS, et le Web Push sonne | Claude Code | [fiche](docs/handoffs/2026-08-13-vps-tls-et-web-push-prouve.md) |
| 2026-08-11 | Projets gérés depuis Réglages | Claude Code | [fiche](docs/handoffs/2026-08-11-projets-en-reglages.md) |
| 2026-08-10 | Le pivot : Brief possède ses données | Claude Code | [fiche](docs/handoffs/2026-08-10-pivot-organiseur-autonome.md) |
| 2026-08-07 | Chaîne dictée → Todoist, et PWA | Claude Code | [fiche](docs/handoffs/2026-08-07-chaine-complete-et-pwa.md) |
| 2026-08-06 | Scaffold, UI, garde PIN et micro | Claude Code | [fiche](docs/handoffs/2026-08-06-scaffold-ui-et-garde-pin.md) |
