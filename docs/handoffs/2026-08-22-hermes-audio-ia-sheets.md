# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui que
tu remplaces dans `docs/handoffs/`.

> **Multi-agents** : si tu n'es pas l'agent qui a écrit la dernière passation,
> tu reprends la main explicitement (nouvelle entrée). Lis aussi
> [`docs/coordination.md`](docs/coordination.md) — les copies du dépôt, la
> branche de prod, les règles anti-collision.

---

# Passation — 2026-08-20 (soir) · Coche d'une récurrence dont `due` a déjà été avancé par le cron

| | |
|---|---|
| **Agent** | Hermes Agent |
| **Branche** | `feat/ui-redesign-claude` — **la branche que sert le VPS** |
| **Commits** | `245616a` (fix) — déployé |
| **Prod** | https://brief.srv1899780.hstgr.cloud — `brief-app-1 Healthy`, agenda du 20/08 vérifié |

## Goal — l'objectif

« Reposter 10 articles » et « Poster 10 articles » (Frip & Trend,
récurrentes lun-jeu) ne se cochent pas : la case restait vide et le toast
disait « Repoussé au lun. 24 août ». Corriger sans supprimer de tâches
(leçon du fix précédent de Claude Code).

## Current state — ce qui a été fait

**Root cause.** `completionPatch` posait `lastCompletedOccurrenceAt = item.due`.
Or le cron des rappels avance AUSSI `due` après chaque envoi de rappel
(`reminders.ts`), fait ou non. Quand le rappel de 18:30 avait déjà sonné,
`due` était passé au lundi 24 — cocher l'occurrence du jeudi 20 enregistrait
donc le **lundi 24** comme « fait » : `buildDayAgenda` ne trouvait aucune
correspondance avec l'occurrence du jour → elle réapparaissait non cochée.

**Fix (2 volets, 2 passes).**
1. **Code — passe 1** : l'UI transmet l'occurrence PRÉCISE cochée (l'heure
   effective affichée, post-override) au `PATCH /api/items` via un champ
   optionnel `completedAt`. `completionPatch(item, done, now, completedAt)`
   l'utilise comme `lastCompletedOccurrenceAt` ; `due` reste le fallback
   historique.
   - `src/components/HomeScreen.tsx` : `onToggle(item.id, due)` — la ligne du
     jour connaît l'occurrence.
   - `src/components/BriefApp.tsx` : `toggleDone(id, completedAt?)`.
   - `src/lib/api.ts` : `setItemDone(id, done, completedAt?)`.
   - `src/app/api/items/route.ts` : parse `completedAt` optionnel.
2. **Code — passe 2 (le client ne suffit pas)** : Aramis confirme que le bug
   touche TOUTES les récurrentes, et un vieux bundle en cache PWA ne transmet
   pas `completedAt`. Le serveur déduit donc lui-même l'occurrence cochée :
   `inferCompletedOccurrence` (dans `completion.ts`) prend l'occurrence de la
   série la plus récente avant la coche (fenêtre 4 jours, `occurrencesInRange`
   + `applyOverride`), en priorité sur `due` — que le cron avance aussi.
   Priorité dans `completionPatch` : `completedAt` (UI) → occurrence déduite
   (serveur) → `due` (dernier recours). Déployé en `cca5e81`.
3. **Données prod (rattrapage, pas de code)** : `lastCompletedOccurrenceAt`
   corrigé à la main sur le volume (backup
   `brief-20260820-192243.tar.gz`) — 3 items :
   - `it_1786829768252_592` (Poster 10) → `2026-08-20T17:00:00.000Z`
   - `it_1786970025770_451` (Reposter 10) → `2026-08-20T16:30:00.000Z`
   - `it_1787063059802_29810` (Aller courir) → `2026-08-19T14:00:00.000Z`
   (heures EFFECTIVES post-override des occurrences réellement cochées).
   Séance push était déjà correcte (rattrapage de la passation précédente).

**Vérifié** : `npx vitest run` ✅ 244 passed ; `npx tsc --noEmit` ✅ ;
agenda prod du 20/08 → ne montre plus que « Tourner les photos » ; prod
HTTP 200, `brief-app-1 Healthy`.

## Decisions — choix critiques ou irréversibles

- **`due` avancé ≠ occurrence faite** (rappel du HANDOFF précédent) : deux
  mécanismes avancent `due` de façon identique (coche utilisateur, cron).
- **La coche d'une occurrence précise doit TOUJOURS être accompagnée de
  l'occurrence effectivement cochée.** Sans elle, si `due` a déjà avancé
  (rappel sonné), on enregistre le prochain rendez-vous comme fait. L'UI est
  la seule qui connaisse l'occurrence affichée — elle doit la transmettre.
- Ne jamais comparer ni écrire sur l'occurrence BRUTE de la RRULE : toujours
  post-`applyOverride` (heure effective). Le calendrier gagne (décision 18/08).

## Changed — fichiers et composants

| Fichier | Nature |
|---|---|
| `src/lib/completion.ts` | `completedAt` optionnel + `inferCompletedOccurrence` (déduction serveur) |
| `src/app/api/items/route.ts` | parse `completedAt` optionnel (PATCH) |
| `src/lib/api.ts` | `setItemDone(id, done, completedAt?)` |
| `src/components/BriefApp.tsx` | `toggleDone(id, completedAt?)` |
| `src/components/HomeScreen.tsx` | `onToggle(item.id, due)` — ligne du jour |
| `src/lib/completion.test.ts` | +3 tests (occurrence précise, déduction serveur, fallback `due`) |
| Volume `brief-data` (prod) | `lastCompletedOccurrenceAt` corrigé sur 3 items |

## Validations — passants / échoués / non lancés

| Commande | Résultat |
|---|---|
| `npx vitest run` | ✅ **245 passed** |
| `npx tsc --noEmit` | ✅ propre |
| Agenda prod 20/08 | ✅ « Tourner les photos » seul |
| Prod HTTP | ✅ 200 |
| `brief-app-1` | ✅ Healthy |

## Blockers — ce qui bloque

Rien. Prod saine.

## Next — la prochaine action

1. **Vérifier visuellement sur l'iPhone d'Aramis** : cocher une tâche
   récurrente du jour (Poster/Reposter) → la case se coche, pas de
   « Repoussé au lundi ».
2. **Icône PWA** : toujours en attente de réinstallation d'écran d'accueil.
3. Chantier annoncé : stocker les enregistrements vocaux bruts (TODOS.md P2).

---

## Historique des passations

| Date | Sujet | Agent | Fiche |
|---|---|---|---|
| **2026-08-20 (soir 2)** | **Coche d'une occurrence dont `due` a déjà avancé (cron) — `completedAt` transmis** | **Hermes Agent** | *(cette passation)* |
| 2026-08-20 (soir) | Occurrence cochée vs `due` avancé par le cron — 3 passes | Claude Code | [fiche](docs/handoffs/2026-08-20-occurrence-cochee-due-avance-cron.md) |
| 2026-08-20 (après-midi) | Séance push corrigée (v1, régressé) + icône PWA + DESIGN.md restauré | Claude Code | [fiche](docs/handoffs/2026-08-20-phantom-occurrence-icone-design-restaure.md) |
| 2026-08-20 (jour) | Accès agents aux tâches/RDV + query token claude.ai | Hermes Agent | [fiche](docs/handoffs/2026-08-20-acces-agents-query-token.md) |
