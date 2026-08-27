# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui que
tu remplaces dans `docs/handoffs/`.

> **Multi-agents** : si tu n'es pas l'agent qui a écrit la dernière passation,
> tu reprends la main explicitement (nouvelle entrée). Lis aussi
> [`docs/coordination.md`](docs/coordination.md) — les copies du dépôt, la
> branche de prod, les règles anti-collision.

---

# Passation — 2026-08-20 (nuit) · Occurrences décalées adoptées (RECURRENCE-ID) + terrain préparé

| | |
|---|---|
| **Agent** | Hermes Agent |
| **Branche** | `feat/ui-redesign-claude` — **la branche que sert le VPS** |
| **Commits** | `c0d0c23` (fix overrides, déployé) + `95322c1` (suppression DESIGN.md) |
| **Prod** | https://brief.srv1899780.hstgr.cloud — `brief-app-1 Healthy`, vérifiée saine post-déploiement |

## Goal — l'objectif

Aramis a remonté un bug de synchro avec captures à l'appui (Brief vs vraie app
Calendrier macOS, 20/08 00:29) : « quand je change quelque chose sur le
calendrier cela se met bien à jour sur Brief, mais pour les tâches récurrentes
comme aller à la salle de sport et la séance push ça ne marche pas sur Brief,
pareil pour les post et repost ». Les événements ponctuels passaient, les
séries récurrentes non. Ensuite : « prépare le terrain pour un autre agent
comme toujours pour ne pas avoir de problème de synchro ».

En cours de session, deuxième chantier : **suppression de l'ancien
`DESIGN.md`** (système corail/General Sans d'avant la spec v1) — Claude
Design l'a détecté en conflit avec la prod pendant ses maquettes
profil/urgence, et Aramis a confirmé : « Celle-là faut vraiment plus en
parler ».

## Current state — ce qui a été fait

**Cause racine, confirmée par lecture brute des ICS iCloud (pas supposée).**
Quand Aramis décale UNE occurrence d'une série dans l'app Calendrier (Séance
push jeudi 16h→17h, Poster 10 18h→19h, Reposter 10 17:30→18:30), iCloud écrit
un **VEVENT override avec `RECURRENCE-ID`** dans le même ICS que le master.
`parseRemoteEvent` ne lisait que le **premier VEVENT** (le master) → Brief
voyait la série « identique » → `skip` → l'édition n'était jamais adoptée,
l'agenda affichait l'ancienne heure, les rappels sonnaient à l'ancienne heure,
et un PUT réécrivait l'ICS SANS les overrides (perte définitive). Preuve
terrain : les 3 séries modifiées avaient un override dans leur ICS iCloud
(`RECURRENCE-ID:20260820T140000Z` → DTSTART 15:00Z pour Séance push, etc.).

**Fix complet (commit `c0d0c23`, 11 fichiers, 12 tests neufs) :**

1. **`Item.overrides`** (`types.ts`) : `RECURRENCE-ID` → nouveau DTSTART (UTC
   RFC 5545), adopté depuis le calendrier.
2. **`parseRemoteEvent`** (`caldav.ts`) : découpe l'ICS en blocs VEVENT
   (`splitVeEvents`), lit le master + tous les overrides.
3. **Adoption** : `remoteDiffers`/`calendarPatch` comparent et adoptent les
   overrides (sans toucher au master — pas de `due`/`seriesAnchor` dérivé) ;
   `decideExternalSync` idem pour les événements adoptés.
4. **Réécriture** : `buildEventIcs` réécrit un VEVENT override par occurrence
   décalée (garde : seulement si `rrule` existe encore).
5. **Affichage** : `buildDayAgenda` applique overrides + EXDATE par occurrence
   (accueil ET Rendez-vous) ; `HomeScreen` affiche l'heure effective de
   l'entrée agenda (`TodayRow` reçoit `due` de l'AgendaItem, plus `item.due`).
6. **Rappels** : `pendingReminders`/`payloadFor` utilisent l'heure effective ;
   l'avancement des séries part de `seriesAnchor` (l'ancre stable) au lieu de
   `due` (qui peut être décalé par un override) et applique l'override à
   l'occurrence suivante.
7. **PATCH** : `sanitizePatch` accepte `overrides` (absent = ne pas toucher,
   `null` = effacer — même règle que `exdates`).
8. **Module partagé** `src/lib/overrides.ts` : `applyOverride`, `icalUtc`,
   `remoteDueToItem` extraits de `caldav.ts` (server-only) pour être
   utilisables côté client (HomeScreen). `caldav.ts` les ré-exporte.

**Vérification prod (réelle, pas seulement les logs) :** après déploiement,
passage forcé puis lecture de `items.json` : les 3 séries modifiées portent
leur override (`Séance push` → `{"20260820T140000Z":"20260820T150000Z"}`,
`Poster 10` → `…T160000Z→…T170000Z`, `Reposter 10` → `…T153000Z→…T163000Z`).
Relu iCloud indépendante : les ICS contiennent toujours master + override,
rien d'écrasé. `adopted=0` au passage forcé = latence iCloud ~15 min (le
passage a vu l'ancienne version), mais l'adoption a bien eu lieu au passage
cron suivant (les overrides sont dans items.json).

## Decisions — choix critiques ou irréversibles

Deux nouvelles entrées `DECISIONS.md` (2026-08-20) :
- **Les occurrences décalées d'une série dans Calendrier sont adoptées
  (RECURRENCE-ID)** — le calendrier gagne par occurrence, pas seulement pour
  le master. Voir le POURQUOI complet dans le fichier — ne pas re-débattre.
- **L'ancien `DESIGN.md` est supprimé** (20/08) — le design system Claude
  Design v1 est LA source de vérité visuelle. DESIGN.md décrivait l'ancien
  système (General Sans + corail + 8 teintes × 5 formes) d'AVANT la spec v1 ;
  il contredisait la spec ET la prod, et a failli faire construire les
  maquettes profil/urgence à Claude Design sur les mauvais tokens. Aramis :
  « je veux pas du tout qu'il suive le design.md de l'ancienne version...
  Celle-là faut vraiment plus en parler. » `git rm DESIGN.md`, références
  retirées d'`AGENTS.md` + `CLAUDE.md`.

## Changed — fichiers et composants

| Fichier | Nature |
|---|---|
| `DESIGN.md` | **supprimé** (ancien système corail/General Sans — voir Decisions) |
| `AGENTS.md` | ligne DESIGN.md retirée du tableau ; note « design system Claude Design v1 = source de vérité, DESIGN.md supprimé » ajoutée ; règle Interface mise à jour |
| `CLAUDE.md` | section « Système de design » + règle top réécrites sur le design system v1 |
| `src/lib/types.ts` | `Item.overrides` (RECURRENCE-ID → nouveau DTSTART) |
| `src/lib/overrides.ts` | **nouveau** — fonctions pures partagées client/serveur (`applyOverride`, `icalUtc`, `remoteDueToItem`) |
| `src/lib/caldav.ts` | `splitVeEvents` + parse des overrides ; `remoteDiffers`/`calendarPatch`/`decideExternalSync` adoptent ; `buildEventIcs` réécrit ; `CalendarEvent` porte `overrides`+`exdates` ; ré-export depuis `overrides.ts` |
| `src/lib/agenda.ts` | `buildDayAgenda` applique overrides/EXDATE par occurrence (items Brief ET événements calendrier) |
| `src/lib/reminders.ts` | `pendingReminders`/`payloadFor` heure effective ; avancement depuis `seriesAnchor` + override appliqué |
| `src/app/api/items/[id]/route.ts` | `sanitizePatch` accepte `overrides` |
| `src/components/HomeScreen.tsx` | `TodayRow` affiche l'heure effective de l'entrée agenda |
| `DECISIONS.md` | 2 nouvelles entrées 2026-08-20 (voir Decisions) |
| Tests | `caldav.test.ts` (+7), `agenda.test.ts` (+3), `route.test.ts` (+4) |

## Validations — passants / échoués / non lancés

| Commande | Résultat |
|---|---|
| `npx vitest run` | ✅ **231 passed** (12 tests neufs) |
| `npx tsc --noEmit` | ✅ propre |
| `npx eslint .` | ✅ 23 problèmes — identiques à la baseline (1 erreur préexistante dans `TaskDetailScreen.tsx`, non touché) |
| Déploiement VPS (`c0d0c23`) | ✅ backup `20260819-225632`, `brief-app-1 Healthy`, `GET /` 200, `/api/agenda` 401 sans PIN |
| Adoption en prod | ✅ overrides présents dans `items.json` (3 séries), ICS iCloud intacts (relu brute) |

**Non vérifié en navigateur réel** : l'affichage de l'heure décalée dans
l'accueil/Rendez-vous n'a pas été confirmé visuellement (pas de session
`/browse` cette nuit). Le code est couvert par les tests de `buildDayAgenda`,
mais « ça compile » n'est pas « ça s'affiche bien » — à vérifier à l'ouverture
de l'app à la prochaine occasion (Séance push jeudi doit s'afficher 17:00).

## Blockers — ce qui bloque

Rien. Prod saine, tout déployé.

## Next — la prochaine action

1. **Vérifier en navigateur réel** que Séance push (jeudi) s'affiche à 17:00
   dans l'accueil et l'onglet Rendez-vous, et que Poster/Reposter 10
   s'affichent à 19:00/18:30 — jamais confirmé visuellement cette nuit.
2. **Le prochain chantier annoncé par Aramis** (TODOS.md, section P2, en
   tête) : stocker les enregistrements vocaux bruts. Commencer par vérifier la
   fiabilité de l'enregistrement (`useRecorder.ts`) et de la transcription
   (`/api/transcribe`) existants, PUIS passer par
   `superpowers:brainstorming` pour la conception du stockage (architectural,
   pas un fix ponctuel).
3. Rien d'urgent ni de cassé par ailleurs.

---

