# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui que
tu remplaces dans `docs/handoffs/`.

> **Multi-agents** : si tu n'es pas l'agent qui a écrit la dernière passation,
> tu reprends la main explicitement (nouvelle entrée). Lis aussi
> [`docs/coordination.md`](docs/coordination.md) — les copies du dépôt, la
> branche de prod, les règles anti-collision.

---

# Passation — 2026-08-19 (fin de soirée) · Deux correctifs d'affichage + terrain préparé

| | |
|---|---|
| **Agent** | Claude Code (Sonnet 5) |
| **Branche** | `feat/ui-redesign-claude` — **la branche que sert le VPS** |
| **Commits** | `63031b1`, `2787383` — tous deux déployés |
| **Prod** | https://brief.srv1899780.hstgr.cloud — `brief-app-1 Healthy`, vérifiée saine post-déploiement |

## Goal — l'objectif

Fin d'une longue soirée de corrections (voir `docs/handoffs/2026-08-19-calendrier-intouche-occurrences-fantomes.md`
pour le gros du travail : types explicites, édition complète, accueil↔Rendez-vous
unifiés, calendrier Apple intouché, fin des occurrences fantômes — tout est
déployé et sain). Cette dernière tranche : deux petits correctifs d'affichage
demandés dans la foulée, plus la préparation du terrain pour la prochaine
session, quel que soit l'agent qui la mène.

**Aramis, dans ses mots, en fin de session** : « on a bien avancé. Le
calendrier maintenant, on n'est plus touché [par Brief]. Comme avant,
l'application est viable, elle marche, etc. On a très très bien avancé. »

## Current state — ce qui a été fait

**1. Tuile « Rendez-vous » de l'accueil — texte incohérent avec « Tâches ».**
`HomeScreen.tsx` affichait `"N · Calendrier Apple"` alors que la tuile
Tâches affiche `"N aujourd'hui"`. Aramis : « change pour "3 aujourd'hui",
comme pour le KPI tâche ». Fix d'une ligne, commit `63031b1`.

**2. Écran Compte — âge de synchro calendrier en dur.** Le sous-titre
« Calendrier Apple » sous le compte affichait `"Synchronisé il y a 4 min"` —
un texte **littéralement figé dans le JSX**, jamais relié à une vraie
donnée. Nouvelle route `GET /api/caldav-status` (PIN-gardée) qui expose
`readSyncState().lastSyncAt` (maintenant exporté depuis `caldav.ts`) ; le
sheet Compte le récupère à l'ouverture et calcule l'âge réel
(`formatSyncAge`, dans `AccountSheet.tsx`). Commit `2787383`.

**3. Terrain préparé pour la prochaine session** (cette passation) :
nouvelle entrée `TODOS.md`, en tête de la section P2, annoncée par Aramis
comme le prochain chantier — **stocker les enregistrements vocaux bruts**,
pas seulement leur transcription. Vérifié dans le code avant d'écrire
l'entrée (pas supposé) : `src/app/api/transcribe/route.ts` reçoit l'audio
et le transmet tel quel à Groq Whisper, **il n'est enregistré nulle part** —
perdu dès que la réponse part. `Item.audioOrigin` ne garde que des
métadonnées texte. Le bouton « Écouter l'extrait » existe déjà dans
`TaskDetailScreen.tsx` (conçu pour ça) mais n'a aucun handler — rien à lire.
**Prérequis explicite d'Aramis avant de s'y attaquer** : vérifier d'abord
que l'enregistrement (`useRecorder.ts`) et la transcription
(`/api/transcribe`) fonctionnent bien, avant d'ajouter le stockage
par-dessus. Voir l'entrée complète dans `TODOS.md` pour les questions
d'architecture à trancher (où stocker, rétention, câblage du bouton Play,
confidentialité) — **c'est un sujet architectural, à passer par
`superpowers:brainstorming` avant tout code**, pas un fix ponctuel.

## Decisions — choix critiques ou irréversibles

Aucune nouvelle cette tranche — les deux fixes sont des corrections de
présentation pures, aucun comportement de données ni de synchro touché.

## Changed — fichiers et composants

| Fichier | Nature |
|---|---|
| `src/components/HomeScreen.tsx` | subtitle tuile Rendez-vous : `"N · Calendrier Apple"` → `"N aujourd'hui"` |
| `src/lib/caldav.ts` | `readSyncState` exporté (était interne) |
| `src/app/api/caldav-status/route.ts` | nouveau — expose `lastSyncAt` réel, PIN-gardé |
| `src/lib/api.ts` | `fetchCalDavStatus()` |
| `src/components/BriefApp.tsx` | `openAccount` (fetch + ouverture groupés), état `calendarSyncAt` |
| `src/components/AccountSheet.tsx` | prop `calendarSyncAt`, `formatSyncAge()` remplace le texte figé |
| `TODOS.md` | nouvelle entrée P2 : stockage des enregistrements vocaux (prochain chantier annoncé) |

## Validations — passants / échoués / non lancés

| Commande | Résultat |
|---|---|
| `npx vitest run` | ✅ 218 passed \| 1 skipped (219) — aucun test nouveau, aucune régression (changements UI/route non couverts par la suite existante, cohérent avec le reste du fichier `AccountSheet.tsx`/`HomeScreen.tsx`, jamais testés unitairement) |
| `npx tsc --noEmit` | ✅ propre |
| `npx eslint .` | ✅ 23 problèmes — identiques à la baseline |
| Déploiement VPS (`63031b1`) | ✅ `git rev-parse HEAD` côté VPS, `brief-app-1 Healthy`, `GET /` 200 |
| Déploiement VPS (`2787383`) | ✅ `git rev-parse HEAD` côté VPS, `brief-app-1 Healthy`, `GET /` 200, `GET /api/caldav-status` 200 (PIN) |
| Backups avant chaque déploiement | ✅ `20260819-220933`, `20260819-222309` |

**Non vérifié en navigateur réel** : l'affichage de `formatSyncAge()` dans le
sheet Compte n'a pas été confirmé visuellement (pas de session `/browse`
cette tranche, juste le déploiement + vérification HTTP de la route). Le
code est simple et typé correctement, mais « ça compile » n'est pas « ça
s'affiche bien » — à vérifier à l'ouverture du sheet Compte à la prochaine
occasion.

## Blockers — ce qui bloque

Rien. Prod saine, tout déployé.

## Next — la prochaine action

1. **Le prochain chantier, tel qu'annoncé par Aramis** : stocker les
   enregistrements vocaux. Voir l'entrée détaillée dans `TODOS.md` (section
   P2, en tête) — commencer par vérifier la fiabilité de l'enregistrement
   et de la transcription existants, PUIS passer par
   `superpowers:brainstorming` pour la conception du stockage (c'est
   architectural, pas un fix ponctuel).
2. Vérifier en navigateur réel (`/browse` ou manuellement) que
   `formatSyncAge()` s'affiche correctement dans le sheet Compte — jamais
   confirmé visuellement cette tranche.
3. Rien d'urgent ni de cassé par ailleurs.

---

## Historique des passations

| Date | Sujet | Agent | Fiche |
|---|---|---|---|
| **2026-08-19 (fin de soirée)** | **Deux correctifs d'affichage + terrain préparé** | **Claude Code** | *(cette passation)* |
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
