# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui que
tu remplaces dans `docs/handoffs/`.

Le mode d'emploi complet est dans [`AGENTS.md`](AGENTS.md), section
« Terminer une session ». L'index des passations passées est en bas de page.

---

# Passation — 2026-08-18 · Cookie PIN posé par le serveur (Set-Cookie)

| | |
|---|---|
| **Agent** | Hermes Agent · `deepseek-v4-flash:0731` via Ollama Cloud |
| **Branche** | `feat/task-completion` — **la branche que sert le VPS** |
| **Commits récents** | `cb8c2c7` (clear Secure) · `e2868c5` (Set-Cookie serveur) · `0be8a13` (PATCH exdates) · `d5b6430` (EXDATE + ancre) |

## Goal — l'objectif

Après le correctif EXDATE (les tâches d'hier sont bien supprimées ✅), Aramis
signale que **l'écran PIN revient à chaque fermeture/relance** de la PWA sur
l'iPhone. Objectif : faire persister la mémorisation du PIN à travers les
fermetures de l'app.

## Decisions — choix critiques ou irréversibles (DECISIONS.md 18/08)

1. **Le cookie PIN est posé par le serveur** (`Set-Cookie` HTTP sur
   `POST /api/session`), pas par JavaScript : sur iOS, les cookies posés par
   `document.cookie` dans une PWA standalone peuvent être purgés à la
   fermeture de l'app — le Set-Cookie HTTP persiste, lui.
2. Rappel : le calendrier Apple **gagne** (bidirectionnel, décision 18/08).

## Current state — ce qui a été fait

1. **Diagnostic** : serveur sain (0 erreur 401 en 24h, bundle servi contient
   `brief_pin`, PIN serveur inchangé). Cause : le serveur ne posait AUCUN
   cookie (`/api/session` renvoyait juste `{ok:true}`) — toute la mémorisation
   était côté JavaScript, purgée par iOS à la fermeture de la PWA.
2. **Correctif** `src/app/api/session/route.ts` : Set-Cookie `brief_pin`
   (Max-Age ~13 mois, SameSite=Lax, Secure en HTTPS) à chaque vérification
   réussie. `src/lib/pin.ts` : `clearCookie` efface avec l'attribut `Secure`
   correspondant (sinon « Verrouiller » ne déverrouillerait pas).
3. **Tests** : suite complète **123/123 verte**, eslint + tsc propres.
4. **Déployé en prod** : commits `e2868c5` + `cb8c2c7`, conteneur healthy.
5. **Vérifié en prod** : `POST /api/session` avec PIN → HTTP 200 +
   `set-cookie: brief_pin=030920; Max-Age=34560000; Path=/; SameSite=Lax; Secure` ;
   sans PIN → HTTP 401, pas de cookie.

## Validations

| Commande / vérif | Résultat |
|---|---|
| `npx eslint` + `npx tsc --noEmit` | ✅ propres |
| `npx vitest run` | ✅ 123/123 (10 fichiers) |
| POST /api/session avec PIN (prod) | ✅ 200 + Set-Cookie Secure |
| POST /api/session sans PIN (prod) | ✅ 401, pas de cookie |
| Déploiement VPS | ✅ `brief-app-1 Healthy` |

**Vérifié par Aramis (18/08 au soir) :** fermer/relancer la PWA sur l'iPhone ne
fait plus réapparaître l'écran PIN — le cookie serveur tient.

## Blockers

Rien. ⚠️ Note DEV : ne jamais écraser `HOME` dans les scripts session. La clé
SSH du VPS est `/opt/data/home/.ssh/id_ed25519`. Les commandes SSH complexes
avec variables inline peuvent être bloquées par le parser — passer par un
script fichier si besoin.

## Next

1. Aramis ferme et relance la PWA sur l'iPhone : l'écran PIN ne doit plus
   réapparaître (le cookie serveur est posé à la première saisie du PIN).
2. Peau Claude Design (refonte visuelle) toujours en attente.

---

## Historique des passations

| Date | Sujet | Agent | Fiche |
|---|---|---|---|
| **2026-08-18** | **Cookie PIN posé par le serveur (Set-Cookie)** | **Hermes Agent** | *(cette passation)* |
| 2026-08-18 | Suppressions d'occurrences adoptées (EXDATE) + ancre de série | Hermes Agent | [fiche](docs/handoffs/2026-08-18-exdate-adoption.md) |
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
