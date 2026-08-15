# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui que
tu remplaces dans `docs/handoffs/`.

Le mode d'emploi complet est dans [`AGENTS.md`](AGENTS.md), section
« Terminer une session ». L'index des passations passées est en bas de page.

---

# Passation — 2026-08-15 · Refonte de la page Vision (focus actionable, horizon interactif et copywriting direct)

| | |
|---|---|
| **Agent** | Hermes Agent v0.20.0 · `google/gemini-3.7-flash` via OpenRouter |
| **Branche** | `feat/task-completion` — **la branche que sert le VPS** |
| **Commits** | `feat: overview screen overhaul with actionable priority focus, interactive 7-day horizon and direct copywriting` |

## Goal — l'objectif

Transformer l'onglet **Vision** pour qu'il réponde immédiatement et clairement à « Qu'est-ce que je dois faire maintenant ? » :
1. **Suppression du jargon anxiogène** ou abstrait (*"dimanche 16 août est ton mur"*...) au profit d'un **Focus du jour clair et orienté action** (ex: *Priorité : apurer Frip & Trend*, *Objectif : N tâches aujourd'hui*).
2. **Horizon 7 jours interactif** : possibilité de cliquer sur n'importe quel jour de la semaine pour inspecter instantanément les tâches associées, avec leurs badges d'échéance et de priorité.
3. **Cartes de charge par projet affinées** avec compteurs précis et jauges lisibles.

## Current state — ce qui a été fait

- **`src/lib/types.ts` & `src/app/api/overview/route.ts`** :
  - Enrichissement de `OverviewDay` pour renvoyer la liste complète des `items` associés à chaque jour de l'horizon dans la même lecture disque unique.
- **`src/components/OverviewScreen.tsx`** :
  - Remplacement du bloc brut par une **carte Bento de pilotage** mettant en avant l'action prioritaire et le bilan chiffré (`Aujourd'hui`, `Cette semaine`, `Total en cours`).
  - Graphique d'horizon interactif avec sélection dynamique du jour et liste détaillée des tâches planifiées.
  - Cartes projets en conteneurs surélevés (`rounded-row`, jauge colorée).

## Decisions — choix critiques ou irréversibles

- **Conservation du calcul à la volée** côté serveur sans cache pour maintenir la cohérence absolue avec `items.json`.

## Changed — fichiers et composants

| Fichier | Nature |
|---|---|
| `src/lib/types.ts` | enrichi : `items` dans `OverviewDay` |
| `src/app/api/overview/route.ts` | enrichi : injection des items par jour d'horizon |
| `src/components/OverviewScreen.tsx` | refondu : carte de pilotage, horizon interactif, nouveau copywriting |
| `docs/handoffs/2026-08-15-workflow-taches-complet.md` | **créé** — archive passation précédente |
| `HANDOFF.md` | réécrit — passation courante |

## Validations — passants / échoués / non lancés

Lancées **après** l'implémentation complète :

| Commande | Résultat |
|---|---|
| `npm run lint` | ✅ aucune erreur, aucun warning |
| `npx tsc --noEmit` | ✅ types stricts validés |
| `npx vitest run` | ✅ **94 tests passent** (7 test suites) |

## Blockers — ce qui bloque

Rien.

## Next — la prochaine action

Déployer sur le VPS et tester la page Vision sur l'iPhone d'Aramis.

---

## Historique des passations

| Date | Sujet | Agent | Fiche |
|---|---|---|---|
| **2026-08-15** | **Refonte page Vision (focus actionable, horizon interactif)** | **Hermes Agent** | *(cette passation)* |
| 2026-08-15 | Optimisation complète tâches (recherche, sections, ajout direct, swipe) | Hermes Agent | [fiche](docs/handoffs/2026-08-15-workflow-taches-complet.md) |
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
