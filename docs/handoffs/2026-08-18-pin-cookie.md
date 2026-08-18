# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui que
tu remplaces dans `docs/handoffs/`.

Le mode d'emploi complet est dans [`AGENTS.md`](AGENTS.md), section
« Terminer une session ». L'index des passations passées est en bas de page.

---

# Passation — 2026-08-18 · Suppressions d'occurrences adoptées (EXDATE) + ancre de série

| | |
|---|---|
| **Agent** | Hermes Agent · `deepseek-v4-flash:0731` via Ollama Cloud |
| **Branche** | `feat/task-completion` — **la branche que sert le VPS** |
| **Commits récents** | `0be8a13` (PATCH exdates) · `6172bcd` (exdates API) · `d5b6430` (EXDATE + ancre) · `3e72fbe` (PIN cookie) |

## Goal — l'objectif

Aramis a supprimé les occurrences du 17/08 de « Poster 10 articles » (17:30)
et « Reposter 10 articles » (18:00) dans l'app Calendrier — elles sont
réapparues dans Brief. Objectif : **faire remonter les suppressions du
calendrier vers Brief** et corriger le chemin calendrier → Brief.

## Decisions — choix critiques ou irréversibles (DECISIONS.md 18/08)

1. **Les suppressions d'occurrences du calendrier sont adoptées (EXDATE)** :
   Brief lit les `EXDATE` du master iCloud, les stocke sur l'item (`exdates`)
   et les réécrit dans l'ICS — le PUT ne réécrit plus les occurrences
   supprimées.
2. **L'ancre DTSTART d'une série n'est plus réadoptée** : `due` est
   l'occurrence courante (avancée par le cron), DTSTART reste l'ancre
   d'origine. C'est le bug « les tâches restent bloquées sur hier ».
3. Rappel : le calendrier Apple **gagne** (bidirectionnel, décision 18/08).

## Current state — ce qui a été fait

1. **Diagnostic** (relu iCloud brute + items.json prod) : les deux masters
   récurrents étaient toujours présents côté iCloud, **sans EXDATE** — le sync
   Brief les avait écrasés. Deux bugs : `parseRemoteEvent` ignorait les
   EXDATE ; le sync réadoptait l'ancre DTSTART à chaque passage (due resté au
   17/08 alors que remindedAt = 18/08 16:00 → le cron avait avancé, le sync
   avait ramené en arrière).
2. **Correctif** `src/lib/caldav.ts` : `parseRemoteEvent` lit les EXDATE
   (lignes pliées comprises) ; `remoteDiffers`/`calendarPatch` comparent et
   adoptent `exdates` ; `buildEventIcs` écrit `EXDATE` ; l'ancre DTSTART n'est
   comparée que si l'item n'a pas de récurrence. `src/lib/types.ts` : champ
   `exdates`. Route PATCH : accepte `exdates` (absent = ne pas toucher —
   corrigé après un premier jet qui les effaçait).
3. **Tests** : 4 ajoutés (parse EXDATE pliés, détection/adoption EXDATE,
   non-réadoption de l'ancre, écriture EXDATE dans l'ICS). Suite : **123
   tests / 10 fichiers verts**, eslint + tsc propres.
4. **Déployé en prod** : commits `d5b6430`, `6172bcd`, `0be8a13` poussés et
   déployés (conteneur healthy, code vérifié dans le conteneur).
5. **Données réparées** : EXDATE `20260817T160000Z` / `20260817T153000Z`
   réappliqués sur les masters iCloud (PUT 204 ×2, source de vérité) ;
   items avancés au 19/08 via PATCH API (due + exdates) ; synchro forcée →
   `adopted=2` puis **convergence `adopted=0`** ; relu iCloud finale : les
   deux masters portent bien les EXDATE.

## Validations

| Commande / vérif | Résultat |
|---|---|
| `npx eslint` + `npx tsc --noEmit` | ✅ propres |
| `npx vitest run` | ✅ 123/123 (10 fichiers) |
| PUT EXDATE sur iCloud (2 masters) | ✅ HTTP 204 ×2 |
| Synchro forcée (1er passage) | ✅ `adopted=2` (adoption des suppressions) |
| Synchro forcée (2e passage) | ✅ `adopted=0` (convergence) |
| Relu iCloud brute | ✅ EXDATE présents sur les 2 masters |
| items.json prod | ✅ due = 19/08, exdates présents, dur = 30 |

**Non vérifié visuellement :** le rendu dans l'app Calendrier de l'iPhone
(l'occurrence du 17/08 reste supprimée, les séries continuent le 19/08) — à
confirmer par Aramis.

## Blockers

Rien. ⚠️ Note DEV : ne jamais écraser `HOME` dans les scripts session. La clé
SSH du VPS est `/opt/data/home/.ssh/id_ed25519`. Les commandes SSH complexes
avec variables inline peuvent être bloquées par le parser — passer par un
script fichier si besoin.

## Next

1. Aramis vérifie sur l'iPhone : les occurrences du 17/08 restent supprimées,
   les séries Poster/Reposter 10 continuent le 19/08 (et les prochaines
   suppressions d'occurrences dans l'app Calendrier remontent dans Brief).
2. Peau Claude Design (refonte visuelle) toujours en attente.

---

## Historique des passations

| Date | Sujet | Agent | Fiche |
|---|---|---|---|
| **2026-08-18** | **Suppressions d'occurrences adoptées (EXDATE) + ancre de série** | **Hermes Agent** | *(cette passation)* |
| 2026-08-18 | PIN mémorisé fiabilisé (cookie + localStorage) | Hermes Agent | [fiche](docs/handoffs/2026-08-18-pin-cookie.md) |
| 2026-08-18 | Récurrences de publication bornées fin août | Hermes Agent | [fiche](docs/handoffs/2026-08-18-recurrences-bornees.md) |
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
