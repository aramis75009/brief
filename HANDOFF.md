# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui que
tu remplaces dans `docs/handoffs/`.

Le mode d'emploi complet est dans [`AGENTS.md`](AGENTS.md), section
« Terminer une session ». L'index des passations passées est en bas de page.

---

# Passation — 2026-08-18 · Récurrences de publication bornées fin août

| | |
|---|---|
| **Agent** | Hermes Agent · `deepseek-v4-flash:0731` via Ollama Cloud |
| **Branche** | `feat/task-completion` — **la branche que sert le VPS** |
| **Commits récents** | `b98c73d` (calendrier = source de vérité) … |

## Goal — l'objectif

Aramis a recréé à la main ses événements de publication Frip & Trend dans Apple
Calendar (après suppression), sans récurrence. Les récurrences existantes
tournaient **à l'infini**. Objectif : **borner toutes les récurrences de
publication à la fin du mois d'août** (`UNTIL=20260831T235959Z`), en respectant
le principe « le calendrier est la source de vérité ».

## Decisions — choix critiques ou irréversibles (DECISIONS.md 18/08)

1. **Les récurrences de publication sont bornées** (fin de mois ou date
   explicite) — jamais d'infini. Règle de fond pour les prochaines sessions.
2. Rappel : le calendrier Apple **gagne** (bidirectionnel, décision 18/08) —
   toute édition dans l'app Calendrier écrase Brief.

## Current state — ce qui a été fait

1. **Audit iCloud complet** (REPORT calendar-query brut sur « Vinted
   Frip&Trend ») : 3 récurrences infinies identifiées :
   - `brief-it_1787066667909_reposter15` (Reposter 15, FR,SA,SU)
   - `brief-it_1787066667912_poster20` (Poster 20, FR,SA,SU)
   - `1B3A002E-D9FF-4D00-8CB7-209638B12364` (Reposter 10 manuel, MO,TU,WE,TH)
2. **PUT iCloud** (source de vérité) : `UNTIL=20260831T235959Z` ajouté aux 3
   (HTTP 204). Les one-shots manuels des 17→27/08 et le sport (infini voulu)
   sont intacts.
3. **Synchro forcée** (reset garde-fou + `/api/cron/caldav-sync`) :
   `adopted=3` — Brief a adopté les nouvelles RRULE.
4. **Vérifié des deux côtés** : items.json prod (7 items avec rrule, 4 bornés
   dont 3 nouveaux) + relu iCloud brute (convergence, pas d'oscillation).
5. **DECISIONS.md** : entrée « Récurrences de publication bornées » ajoutée.

## Validations

| Commande / vérif | Résultat |
|---|---|
| PUT iCloud (3 événements) | ✅ HTTP 204 ×3 |
| Synchro forcée | ✅ `adopted=3`, `failures=[]` |
| items.json prod | ✅ `reposter15` + `poster20` → `UNTIL=20260831T235959Z` |
| Relu iCloud brute | ✅ mêmes RRULE côté iCloud, convergence |
| One-shots manuels Aramis | ✅ intacts (17→27/08, sans récurrence) |

**Non vérifié visuellement :** le rendu réel dans l'app Calendrier de l'iPhone
(les récurrences s'arrêtent bien le 31/08) — à confirmer par Aramis.

## Blockers

Rien. ⚠️ Note DEV : ne jamais écraser `HOME` dans les scripts session. La clé
SSH du VPS est `/opt/data/home/.ssh/id_ed25519`. Les commandes SSH complexes
avec variables inline peuvent être bloquées par le parser — passer par un
script fichier si besoin.

## Next

1. Aramis vérifie sur l'iPhone : les récurrences poster/reposter s'arrêtent le
   31/08, et le sport continue (infini voulu).
2. Peau Claude Design (refonte visuelle) toujours en attente.

---

## Historique des passations

| Date | Sujet | Agent | Fiche |
|---|---|---|---|
| **2026-08-18** | **Récurrences de publication bornées fin août** | **Hermes Agent** | *(cette passation)* |
| 2026-08-18 | Calendrier = source de vérité + semaine récurrente | Hermes Agent | [fiche](docs/handoffs/2026-08-18-caldav-source-de-verite.md) |
| 2026-08-18 | CalDAV multi-calendriers déployé + routage vérifié | Hermes Agent | [fiche](docs/handoffs/2026-08-18-caldav-multicalendriers-deploye.md) |
| 2026-08-18 | CalDAV multi-calendriers (un calendrier par projet) — implémenté, à déployer | Hermes Agent | [fiche](docs/handoffs/2026-08-18-caldav-multicalendriers.md) |
| 2026-08-17 | PIN mémoire + synchro CalDAV Apple | Hermes Agent | [fiche](docs/handoffs/2026-08-17-pin-memoire-et-caldav-apple.md) |
| 2026-08-16 | Audit complet et refonte produit | Claude Code | [fiche](docs/handoffs/2026-08-16-audit-complet-et-refonte-produit.md) |
| 2026-08-15 | Workflow Telegram et n8n | Hermes Agent | [fiche](docs/handoffs/2026-08-15-workflow-telegram-n8n.md) |
| 2026-08-14 | Déploiement prod + correctif projets invisibles | **Hermes** | [fiche](docs/handoffs/2026-08-14-deploiement-et-correctif-projets.md) |
| 2026-08-13 | En ligne, en TLS, et le Web Push sonne | Claude Code | [fiche](docs/handoffs/2026-08-13-vps-tls-et-web-push-prouve.md) |
| 2026-08-11 | Projets gérés depuis Réglages | Claude Code | [fiche](docs/handoffs/2026-08-11-projets-en-reglages.md) |
| 2026-08-10 | Le pivot : Brief possède ses données | Claude Code | [fiche](docs/handoffs/2026-08-10-pivot-organiseur-autonome.md) |
| 2026-08-07 | Chaîne dictée → Todoist, et PWA | Claude Code | [fiche](docs/handoffs/2026-08-07-chaine-complete-et-pwa.md) |
| 2026-08-06 | Scaffold, UI, garde PIN et micro | Claude Code | [fiche](docs/handoffs/2026-08-06-scaffold-ui-et-garde-pin.md) |
