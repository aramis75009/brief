# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui que
tu remplaces dans `docs/handoffs/`.

> **Multi-agents** : si tu n'es pas l'agent qui a écrit la dernière passation,
> tu reprends la main explicitement (nouvelle entrée). Lis aussi
> [`docs/coordination.md`](docs/coordination.md) — les copies du dépôt, la
> branche de prod, les règles anti-collision.

---

# Passation — 2026-08-20 (jour) · Accès agents aux tâches/RDV + query token pour claude.ai

| | |
|---|---|
| **Agent** | Hermes Agent |
| **Branche** | `feat/ui-redesign-claude` — **la branche que sert le VPS** |
| **Commits** | `8821445` (HEAD prod) — `49b50e5` (query token digest) + `3e017e7` (script brief-agents.sh) + `8821445` (fix URL-encode) |
| **Prod** | https://brief.srv1899780.hstgr.cloud — `brief-app-1 Healthy`, déployée et vérifiée |

## Goal — l'objectif

Aramis veut que **Claude (claude.ai, abo Pro 20€/mo)** ait accès à ses tâches
et rendez-vous Brief, comme Hermes. Claude ne peut poser que des **URLs nues**
(pas de header HTTP) : il fallait donc que l'API accepte le jeton en query
param, puis déployer et documenter pour que Claude Code sache tout en
repremant la main.

## Current state — ce qui a été fait

1. **Constat** : les routes existaient déjà — `GET /api/digest` (Bearer
   `BRIEF_DIGEST_TOKEN`, lecture seule, conçu pour un automate) et
   `GET /api/agenda?date=` (header `x-brief-pin`). Testées depuis internet :
   OK. Mais aucune n'acceptait de token en URL → inutilisable par claude.ai.
2. **`src/lib/cron-auth.ts`** : `requireMachineToken` accepte une option
   `{ allowQueryToken?: boolean }`. Quand elle est activée ET qu'aucun header
   n'est fourni, le jeton est lu dans `?token=` et comparé en temps constant.
   **Opt-in strict** : seul `/api/digest` l'active. Le PIN n'est JAMAIS
   accepté en query ; aucune route d'écriture (capture, items) ne l'active.
3. **`src/app/api/digest/route.ts`** : option activée.
4. **`src/lib/cron-auth.test.ts`** (nouveau, 8 tests) : Bearer valide/invalide,
   503 sans env, query token accepté/rejeté, query ignoré sans l'option,
   header prioritaire sur query parasite.
5. **`scripts/brief-agents.sh`** : nouvelle commande `url` — génère
   `https://brief.srv1899780.hstgr.cloud/api/digest?token=<URL-encodé>`.
   ⚠️ **Le token est base64 (contient `+ / =`) : il DOIT être URL-encodé**,
   sinon le serveur reçoit un token tronqué → 401 (piège rencontré et corrigé
   en prod, commit `8821445`).
6. **`docs/agent-calendar-access.md`** : doc complète (script, secrets,
   claude.ai, limites).
7. **`DECISIONS.md`** : nouvelle entrée 2026-08-20 (décision + pourquoi +
   comment + statut).
8. **Déploiement prod** : merge fast-forward sur `feat/ui-redesign-claude`,
   push GitHub, bundle git → VPS (le remote de la prod est HTTPS SANS
   credentials — voir piège ci-dessous), backup `20260820-113949`, rebuild,
   `brief-app-1 Healthy`.

## Decisions — choix critiques ou irréversibles

- **Le jeton machine digest est accepté en query param `?token=`** (opt-in
  strict, lecture seule uniquement, PIN jamais en query). Voir `DECISIONS.md`
  (entrée 2026-08-20) pour le POURQUOI complet — ne pas re-débattre.

## Changed — fichiers et composants

| Fichier | Nature |
|---|---|
| `src/lib/cron-auth.ts` | `requireMachineToken` + option `allowQueryToken` (query token si aucun header) |
| `src/app/api/digest/route.ts` | `allowQueryToken: true` |
| `src/lib/cron-auth.test.ts` | **nouveau** — 8 tests de la garde machine |
| `scripts/brief-agents.sh` | **nouveau** — `digest` / `agenda [date]` / `url` (token URL-encodé) |
| `docs/agent-calendar-access.md` | **nouveau** — doc d'accès agents |
| `DECISIONS.md` | entrée 2026-08-20 (query token claude.ai) |
| `CLAUDE.md` / `HERMES.md` | section « Lire les tâches et rendez-vous d'Aramis » |

## Validations — passants / échoués / non lancés

| Commande | Résultat |
|---|---|
| `npx vitest run` | ✅ **239 passed** (8 tests neufs cron-auth) |
| `npx tsc --noEmit` | ✅ propre |
| `npx eslint .` | ✅ 23 problèmes — baseline inchangée (1 erreur préexistante `TaskDetailScreen.tsx`) |
| URL prod `?token=` (encodé) | ✅ 200 + JSON digest (8 échéances aujourd'hui) |
| URL prod sans token / token invalide | ✅ 401 |
| Conteneur prod | ✅ `brief-app-1 Healthy` |

## Blockers — ce qui bloque

Rien. Prod saine, tout déployé.

## Next — la prochaine action

1. **Donner l'URL à Claude (claude.ai)** : Aramis doit lui coller
   `https://brief.srv1899780.hstgr.cloud/api/digest?token=<BRIEF_DIGEST_TOKEN
   URL-encodé>` — générée par `bash scripts/brief-agents.sh url` (sur le VPS
   ou avec le token en env). Claude testera et confirmera qu'il voit les
   échéances du jour.
2. **Vérifier en navigateur réel** (reporté de la nuit) : Séance push jeudi
   doit s'afficher à 17:00 dans l'accueil et Rendez-vous (fix overrides
   `c0d0c23` jamais confirmé visuellement).
3. **Le prochain chantier annoncé par Aramis** (TODOS.md, P2) : stocker les
   enregistrements vocaux bruts. Vérifier `useRecorder.ts` + `/api/transcribe`
   existants, PUIS `superpowers:brainstorming` pour la conception.

---

## Historique des passations

| Date | Sujet | Agent | Fiche |
|---|---|---|---|
| **2026-08-20 (jour)** | **Accès agents aux tâches/RDV + query token claude.ai** | **Hermes Agent** | *(cette passation)* |
| 2026-08-20 (nuit) | Occurrences décalées adoptées (RECURRENCE-ID) + terrain préparé | Hermes Agent | [fiche](docs/handoffs/2026-08-20-occurrences-decalees-adoptees.md) |
| 2026-08-19 (fin de soirée) | Deux correctifs d'affichage + terrain préparé | Claude Code | [fiche](docs/handoffs/2026-08-19-deux-correctifs-affichage-terrain-prepare.md) |
| 2026-08-19 (soir) | Calendrier intouché + fin des occurrences fantômes | Claude Code | [fiche](docs/handoffs/2026-08-19-calendrier-intouche-occurrences-fantomes.md) |
| 2026-08-19 | Types explicites, édition complète, accueil↔Rendez-vous unifiés | Claude Code | [fiche](docs/handoffs/2026-08-19-types-edition-agenda-unifie.md) |
| 2026-08-19 | DTSTART mobile des séries récurrentes corrigé | Claude Code | [fiche](docs/handoffs/2026-08-19-dtstart-mobile-series-recurrentes.md) |
| 2026-08-19 | Rendez-vous reconstruite + adoption calendrier externe | Claude Code | [fiche](docs/handoffs/2026-08-19-rendezvous-reconstruite-adoption-calendrier.md) |
| 2026-08-19 | Crash CalDAV corrigé + coordination mergée | Hermes Agent | [fiche](docs/handoffs/2026-08-19-crash-caldav-corrige-coordination.md) |
| 2026-08-19 | Bug de prod : DTSTART flottant (cause, fix, leçons) | Hermes Agent | [fiche](docs/handoffs/2026-08-19-caldav-floating-dtstart.md) |
| 2026-08-19 | Refonte UI Claude Design (en cours) | Hermes Agent | [fiche](docs/handoffs/2026-08-19-refonte-ui-claude-design.md) |
| 2026-08-19 | CalDAV priorité + bugs UI | Hermes Agent | [fiche](docs/handoffs/2026-08-19-caldav-priorite-et-bugs-ui.md) |
| 2026-08-18 | Cookie PIN posé par le serveur (Set-Cookie) | Hermes Agent | [fiche](docs/handoffs/2026-08-18-pin-cookie.md) |
| 2026-08-18 | Suppressions d'occurrences adoptées (EXDATE) + ancre de série | Hermes Agent | [fiche](docs/handoffs/2026-08-18-exdate-adoption.md) |
| 2026-08-18 | PIN mémorisé fiabilisé (cookie + localStorage) | Hermes Agent | [fiche](docs/handoffs/2026-08-18-pin-cookie.md) |
| 2026-08-18 | Récurrences de publication bornées fin août | Hermes Agent | [fiche](docs/handoffs/2026-08-18-recurrences-bornees.md) |
| 2026-08-18 | Calendrier = source de vérité + semaine récurrente | Hermes Agent | [fiche](docs/handoffs/2026-08-18-caldav-source-de-verite.md) |
| 2026-08-18 | CalDAV multi-calendriers déployé + routage vérifié | Hermes Agent | [fiche](docs/handoffs/2026-08-18-caldav-multicalendriers-deploye.md) |
| 2026-08-18 | CalDAV multi-calendriers (un calendrier par projet) — implémenté, à déployer | Hermes Agent | [fiche](docs/handoffs/2026-08-18-caldav-multicalendriers.md) |
| 2026-08-17 | PIN mémoire + synchro CalDAV Apple | Hermes Agent | [fiche](docs/handoffs/2026-08-17-pin-memoire-et-caldav-apple.md) |
| 2026-08-16 | Audit complet et refonte produit | Claude Code | [fiche](docs/handoffs/2026-08-16-audit-complet-et-refonte-produit.md) |
| 2026-08-15 | Workflow Telegram et n8n | Hermes Agent | [fiche](docs/handoffs/2026-08-15-workflow-telegram-n8n.md) |
| 2026-08-14 | Déploiement prod + correctif projets invisibles | Hermes Agent | [fiche](docs/handoffs/2026-08-14-deploiement-et-correctif-projets.md) |
| 2026-08-13 | En ligne, en TLS, et le Web Push sonne | Claude Code | [fiche](docs/handoffs/2026-08-13-vps-tls-et-web-push-prouve.md) |
| 2026-08-11 | Projets gérés depuis Réglages | Claude Code | [fiche](docs/handoffs/2026-08-11-projets-en-reglages.md) |
| 2026-08-10 | Le pivot : Brief possède ses données | Claude Code | [fiche](docs/handoffs/2026-08-10-pivot-organiseur-autonome.md) |
| 2026-08-07 | Chaîne dictée → Todoist, et PWA | Claude Code | [fiche](docs/handoffs/2026-08-07-chaine-complete-et-pwa.md) |
| 2026-08-06 | Scaffold, UI, garde PIN et micro | Claude Code | [fiche](docs/handoffs/2026-08-06-scaffold-ui-et-garde-pin.md) |
