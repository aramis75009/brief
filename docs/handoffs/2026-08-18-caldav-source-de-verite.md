# Passation — 2026-08-18 · Le calendrier Apple est la source de vérité (+ semaine récurrente)

| | |
|---|---|
| **Agent** | Hermes Agent · `deepseek/deepseek-v4-flash-0731` via OpenRouter |
| **Branche** | `feat/task-completion` — **la branche que sert le VPS** |
| **Commits récents** | `b98c73d` (calendrier = source de vérité) … |

## Goal — l'objectif

Aramis modifie ses tâches **en direct dans Apple Calendar** (il décale les
horaires selon ce qu'il fait). L'ancienne synchro one-way Brief → Apple
**écrasait ses modifs** à chaque passage. Objectif : **le calendrier iCloud est
la source de vérité des horaires** — ce que tu poses dans l'app Calendrier,
Brief (et Hermes) le suivent. En plus, la **semaine récurrente** de sport et de
pubs Frip & Trend est posée en récurrence (RRULE).

## Decisions — choix critiques ou irréversibles (DECISIONS.md 18/08)

1. **Le calendrier gagne (bidirectionnel)** : Brief écrit les nouvelles tâches
   au calendrier, mais toute édition faite directement dans l'app Calendrier
   (horaire / titre / récurrence) **écrase** la valeur de Brief → Brief adopte
   la version du calendrier via `patchItem`. Renverse le one-way du 17/08.
2. **Semaine type récurrente** (données Brief, en RRULE) :
   - Sport 16–17 h : **push** lun·jeu·dim · **pull** mar·ven · **courir** mer·sam
   - Frip & Trend 18–19 h : **Poster/Reposter 10** lun–jeu · **Reposter 15 /
     Poster 20** ven–dim

## Current state — ce qui a été fait

1. **`src/lib/caldav.ts`** — sens inverse (« le calendrier gagne ») :
   - `listBriefEvents` capture désormais l'**ICS complet** (désencodé) de chaque
     événement distant.
   - Helpers purs : `parseRemoteEvent`, `remoteDiffers`, `calendarPatch`,
     `remoteDueToItem`, `unescapeText` (+ tests) : comparent ce que Brief
     écrirait vs. l'événement posé dans le calendrier.
   - En phase 2, si l'événement distant diffère → **adoption** dans l'item Brief
     (`patchItem`) au lieu de l'écraser ; sinon PUT normal. Constateur
     `adopted` ajouté au compte-rendu et au log cron.
2. **Semaine récurrente** posée (items Brief via API prod, `rrule = FREQ=WEEKLY;BYDAY=…`).
   `due` = DTSTART ancreur : Poster/Reposter 10 → **lun 17/08** ; 15/20 → **ven
   21/08** ; push → 20/08 (jeu) ; pull → 21/08 ; courir → 19/08 (mer).
3. **Déployé** sur le VPS, `brief-app-1` healthy.

## Validations

| Commande / vérif | Résultat |
|---|---|
| `npx vitest run` | ✅ **112/112** (9 fichiers) |
| `npx tsc --noEmit` / `npx eslint …` | ✅ 0 erreur |
| **Test réel « calendrier gagne »** | ✅ iCloud a décalé « Séance push » 16h→18h (PUT 204) → synchro `adopted=3` → item Brief `due=…16:00Z` (18 h Paris) |
| Convergence | ✅ 2ᵉ passage `adopted=0`, pas d'oscillation |
| Lecture indépendante iCloud | ✅ masters récurrents corrects (Poster/Reposter 10 → DTSTART lun 17, BYDAY MO,TU,WE,TH ; 15/20 → ven 21, FR,SA,SU) |

**Non vérifié visuellement :** le rendu réel dans l'app Calendrier de l'iPhone
(expansion des récurrences par jour) — effet sur canal externe, à confirmer par
Aramis.

## Blockers

Rien. ⚠️ Note DEV : ne jamais écraser `HOME` dans les scripts session
(/*.sh avec `source .env.local` + `HOME=$(curl…)` a corrompu `$HOME` → SSH
cassé). La clé SSH du VPS est `/opt/data/home/.ssh/id_ed25519`.

## Next

1. Aramis vérifie sur l'iPhone : les récurrences sport/pubs se déroulent
   lun→dim, et qu'une tâche décalée dans l'app Calendrier se reflète dans Brief
   (~15 min).
2. Peau Claude Design (refonte visuelle) toujours en attente.
