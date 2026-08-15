# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui que
tu remplaces dans `docs/handoffs/`.

Le mode d'emploi complet est dans [`AGENTS.md`](AGENTS.md), section
« Terminer une session ». L'index des passations passées est en bas de page.

---

# Passation — 2026-08-15 · Optimisation complète du workflow des tâches (recherche, sections temporelles, ajout rapide et swipe)

| | |
|---|---|
| **Agent** | Hermes Agent v0.20.0 · `google/gemini-3.7-flash` via OpenRouter |
| **Branche** | `feat/task-completion` — **la branche que sert le VPS** |
| **Commits** | `feat: complete tasks workflow overhaul (search, time sections, quick add, swipe gestures)` |

## Goal — l'objectif

Rendre l'onglet Tâches ultra-fluide, ergonomique et complet :
1. **Recherche instantanée** par mot-clé filtrant sur le titre de la tâche et le nom du projet.
2. **Sections temporelles dynamiques** en vue "Urgence" (`En retard`, `Aujourd'hui`, `Demain`, `À venir`, `Sans date`).
3. **Bouton et modalité d'Ajout rapide direct** (`+`) sans nécessiter la voix, avec sélection de projet, date rapide et priorité.
4. **Gestes Swipe tactiles** sur mobile : swipe droite pour cocher (`Fait` / `Rouvrir`), swipe gauche pour `Reporter à demain`.

## Current state — ce qui a été fait

- **`src/lib/tasks.ts` & `src/lib/tasks.test.ts`** :
  - Implémentation de `groupItemsByTimeSections()` partitionnant les tâches selon le fuseau horaire `Europe/Paris`.
  - Nouveaux tests unitaires passants.
- **`src/components/icons.tsx`** :
  - Ajout du composant `SearchIcon`.
- **`src/components/TasksScreen.tsx`** :
  - Intégration du composant `SwipeableTaskCard` avec résistance tactile fluide et révélation des fonds d'actions (`var(--color-ok)`, `var(--color-warn)`).
  - Ajout de la barre de recherche instantanée.
  - Formulaire d'ajout rapide direct avec raccourcis de date (`aujourd'hui`, `demain`, `après-demain`, etc.).
  - Affichage des sections temporelles en vue Urgence.
- **`src/components/BriefApp.tsx`** :
  - Câblage des callbacks `onQuickAdd` et `onPostponeTomorrow` avec persistance serveur atomique.

## Decisions — choix critiques ou irréversibles

- **Conservation de l'architecture légère** : pas de dépendance externe de swipe (framer-motion, etc.) ajoutée, manipulation d'événements tactiles purs `onTouchStart`, `onTouchMove`, `onTouchEnd` conformes aux standards iOS.

## Changed — fichiers et composants

| Fichier | Nature |
|---|---|
| `src/lib/tasks.ts` | enrichi : `groupItemsByTimeSections`, `TimeSection`, `TimeBucketKey` |
| `src/lib/tasks.test.ts` | enrichi : tests de segmentation temporelle |
| `src/components/icons.tsx` | enrichi : `SearchIcon` |
| `src/components/TasksScreen.tsx` | refondu : swipe cards, recherche, ajout rapide, sections d'urgence |
| `src/components/BriefApp.tsx` | enrichi : intégration callbacks d'ajout rapide et report |
| `docs/handoffs/2026-08-15-dates-naturelles-et-priorites-design.md` | **créé** — archive passation précédente |
| `HANDOFF.md` | réécrit — passation courante |

## Validations — passants / échoués / non lancés

Lancées **après** l'implémentation complète :

| Commande | Résultat |
|---|---|
| `npx eslint .` | ✅ aucune erreur, aucun warning |
| `npx tsc --noEmit` | ✅ types stricts validés |
| `npx vitest run` | ✅ **94 tests passent** (7 test suites) |

## Blockers — ce qui bloque

Rien.

## Next — la prochaine action

Déployer sur le VPS et tester la fluidité tactile sur l'iPhone d'Aramis.

---

## Historique des passations

| Date | Sujet | Agent | Fiche |
|---|---|---|---|
| **2026-08-15** | **Optimisation complète tâches (recherche, sections, ajout direct, swipe)** | **Hermes Agent** | *(cette passation)* |
| 2026-08-15 | Dates langage naturel coloré, priorités & synthèse | Hermes Agent | [fiche](docs/handoffs/2026-08-15-dates-naturelles-et-priorites-design.md) |
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
