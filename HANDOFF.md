# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui
que tu remplaces dans `docs/handoffs/`.

> **Multi-agents** : si tu n'es pas l'agent qui a écrit la dernière passation,
> tu reprends la main explicitement (nouvelle entrée). Lis aussi
> [`docs/coordination.md`](docs/coordination.md).

---

# Passation — 2026-08-30 (nuit, tard) · Accès agenda machine + Réglages derrière le profil — 2 PR à recetter

| | |
|---|---|
| **Agent** | **Claude Code (Opus 5)** — je reprends la main (passation précédente : Claude Code Sonnet 5, archivée). |
| **Branches** | `main` = `1088552`. **PR [#4](https://github.com/aramis75009/brief/pull/4)** `feat/agenda-machine-token` → `main`. **PR [#5](https://github.com/aramis75009/brief/pull/5)** `feat/reglages-desktop-profil` → **#4** (empilée). Aucune mergée. |
| **Prod** | `https://brief.srv1899780.hstgr.cloud` — inchangée. Rien de cette session n'est déployé. |

## Goal

Reprendre les améliorations en cours. Deux chantiers livrés, plus le déblocage
du canal de lecture prod qui traînait depuis le 14/08.

## Current state

### Fait et poussé

**`main` a été fast-forwardé** de `71f31a9` à `1088552` : la branche
`fix/deploy-sh-macos` (correctif macOS de `deploy.sh` + passation à jour) est
mergée. `HANDOFF.md` de `main` n'est plus périmé.

**PR #4 — les agents lisent `/api/agenda` avec le jeton machine.**
`scripts/brief-agents.sh agenda` était **cassé depuis le 26/08** : il envoyait
`x-brief-pin` à une route passée sous `requireSession()`. La route porte
désormais une garde **MIXTE** (`requireSessionOrMachineToken`, `guard.ts`) :
session **ou** `BRIEF_DIGEST_TOKEN`.

> ⚠️ La consigne initiale d'Aramis était de *remplacer* `requireSession()`.
> Vérification faite avant d'écrire : `/api/agenda` est la **source unique**
> de l'accueil, de l'onglet Agenda et du calendrier desktop (`fetchAgendaDay`).
> Un remplacement pur aurait éteint ces trois écrans en 401, en prod, sans
> aucune erreur serveur. D'où le mixte.

**PR #5 — Réglages derrière l'avatar, plus aucune bascule décorative.**
Store `settings.json` + `GET`/`PATCH /api/settings` ; « Calendrier Apple » et
« Digest Telegram » coupent réellement leur service ; l'avatar ouvre l'écran
Réglages (l'onglet quitte la nav) ; « Verrou PIN » devient un bloc **Compte**
avec la **déconnexion qui manquait totalement au desktop**. Conçu via
`superpowers:brainstorming`, spec dans
`docs/superpowers/specs/2026-08-30-reglages-desktop-profil-design.md`.

### Le blocage de fond, à moitié levé

**Le canal de lecture prod fonctionne enfin.** `BRIEF_DIGEST_TOKEN` était
défini **deux fois** dans le `.env.local` du Mac (plus un `---` parasite) : la
**première** définition gagne — pour le script comme pour `@next/env` — donc la
bonne valeur collée à la fin n'était jamais lue, et la prod répondait 401 comme
si la route était cassée. Doublon supprimé, `bash scripts/brief-agents.sh
digest` répond 200 avec les vraies données. Le script avertit désormais en cas
de doublon.

**La QA navigateur reste bloquée.** `NEXT_PUBLIC_SUPABASE_URL` et
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` manquent au `.env.local` du Mac.
Contrairement à ce que laisse croire leur préfixe, elles sont lues **côté
serveur uniquement** (`src/lib/supabase/server.ts`, `src/proxy.ts` — il n'y a
pas de client Supabase navigateur dans Brief) : elles **ne sont pas dans le
bundle de la prod**, un agent ne peut donc pas les récupérer seul. Seul Aramis
peut les copier depuis `/docker/brief/.env.production`. `README.md` affirmait
le contraire, corrigé.

## Decisions

Deux entrées ajoutées en tête de `DECISIONS.md` (2026-08-30 nuit), avec leur
POURQUOI :

1. **Garde MIXTE sur `/api/agenda`** — session OU jeton machine, jamais un
   remplacement. Un seul secret (`BRIEF_DIGEST_TOKEN`) pour `digest` et
   `agenda` : même portée, même révocation.
2. **Réglages derrière l'avatar** ; défauts des réglages à ON ; « Verrou PIN »
   → bloc Compte ; mobile hors périmètre.

`AGENTS.md` porte le nouvel invariant « garde mixte, LECTURE seulement ».

## Blockers

1. **Clés Supabase absentes du Mac** → aucune QA navigateur possible. C'est le
   blocage le plus coûteux du projet : il dure depuis le 14/08, et fait que
   personne n'a jamais vu tourner en local les écrans livrés depuis.
2. **Rien d'autre.** Les deux PR sont prêtes.

## Next — la prochaine action

1. **Merger PR #4**, puis PR #5 (sa base repassera sur `main` toute seule),
   puis déployer : `bash .claude/commands/deploy.sh "agenda machine + réglages"`.
2. **Ajouter les deux clés Supabase** au `.env.local` du Mac — débloque
   définitivement la recette navigateur.
3. **⚠️ n8n** : ajouter un nœud IF sur `enabled` dans le workflow du récap du
   matin. Sans lui, couper la bascule « Digest Telegram » enverra quand même un
   récap, vide. Brief ne peut pas retenir l'automate.
4. **Bug ouvert — « Poster 20 » / « Reposter 15 » (récurrences ven–dim)
   absentes du graphe.** Piste resserrée cette nuit : le digest prod du
   **dimanche 30/08** ne les contient pas non plus, alors qu'elles devraient y
   être. Ce n'est donc pas l'affichage du graphe, c'est l'état de l'item — très
   probablement `doneAt` posé avec `rrule: null`, ce que fait `completionPatch`
   (`src/lib/completion.ts:152`) quand `nextOccurrence` rend `null` (règle non
   comprise, ou `UNTIL` dépassé). `doneAt` exclut l'item du graphe **et** du
   digest : les deux symptômes d'un coup. **Confirmation dès que PR #4 est
   déployée** : `bash scripts/brief-agents.sh agenda 2026-09-04` (un vendredi).
5. Reste des notes du 30/08 (`TODOS.md` P3) : Kanban Trello, raccourcis
   flèches, calendrier à repenser, toasts, hover global.

## Validations — passants / échoués / non lancés

```
$ npx vitest run     → 461 passants, 1 skipped (37 fichiers)   [+35 sur la session]
$ npx tsc --noEmit   → 0 erreur
$ npx eslint .       → 0 erreur (29 warnings préexistants, −1)
```

- **Passant, en live sur la prod** : `bash scripts/brief-agents.sh digest`
  → 200 avec les vraies données. `agenda` → 401 « Session invalide », ce qui
  **confirme** que la garde mixte de PR #4 est nécessaire.
- **Non lancé : QA navigateur** (`/browse`) — clés Supabase absentes.
- **Non lancé : `npm run build`** (règle du repo).
- **Non lancé : `/code-review`** sur ces deux branches.

## Changed

| Fichier | PR | Nature |
|---|---|---|
| `src/lib/guard.ts` | #4, #5 | `requireSessionOrMachineToken`, `readSessionClaims` |
| `src/lib/cron-auth.ts` | #4 | `hasMachineCredential` (présence, jamais validité) |
| `src/app/api/agenda/route.ts` | #4 | garde mixte |
| `scripts/brief-agents.sh` | #4, #5 | Bearer pour `agenda`, PIN retiré, avertissement doublon |
| `docs/agent-calendar-access.md` | #4 | réécrit — un seul secret |
| `src/lib/settings.ts` + `.test.ts` | #5 | **neuf** — `normalizeSettings`, `applySettingsPatch` |
| `src/lib/store.ts` + `store-settings.test.ts` | #5 | `readSettings`, `updateSettingsAtomically` |
| `src/app/api/settings/route.ts` + `.test.ts` | #5 | **neuve** — GET/PATCH |
| `src/app/api/cron/caldav-sync/route.ts` + `.test.ts` | #5 | sortie avant réseau si désactivé |
| `src/app/api/digest/route.ts` + `.test.ts` | #5 | `enabled: false` si coupé |
| `src/app/api/auth/session/route.ts` + `.test.ts` | #5 | rend l'adresse du compte |
| `src/components/desktop/DesktopSettings.tsx` | #5 | bascules réelles, bloc Compte |
| `src/components/desktop/DesktopHeader.tsx` | #5 | onglet retiré, avatar = état actif |
| `src/components/desktop/DesktopShell.tsx`, `BriefApp.tsx` | #5 | avatar → écran Réglages, `logout` partagé |
| `README.md` | #5 | Supabase serveur-only, piège du doublon `.env` |

---

## Historique des passations

| Date | Sujet | Agent | Lien |
|---|---|---|---|
| 2026-08-30 (nuit, tard) | Accès agenda machine + Réglages derrière le profil — PR #4 et #5 | Claude Code (Opus 5) | (cette passation) |
| 2026-08-30 (nuit) | Graphe & Objectifs déployé + recette round 1 | Claude Code | [fiche](docs/handoffs/2026-08-30-nuit-graphe-objectifs-deploye-recette1.md) |
| 2026-08-30 (soir) | Graphe & Objectifs, le moteur — PR #3 | Claude Code | [fiche](docs/handoffs/2026-08-30-graphe-objectifs-moteur-pr3.md) |
| 2026-08-30 (session) | Chantier Objectifs & Projets codé, recette à faire | Hermes Agent | [fiche](docs/handoffs/2026-08-30-hermes-objectifs-projets-recette.md) |
| 2026-08-29 (nuit) | Occurrences manquées visibles — stabilisation 1/2 | Hermes Agent | [fiche](docs/handoffs/2026-08-29-nuit-occurrences-manquees.md) |
