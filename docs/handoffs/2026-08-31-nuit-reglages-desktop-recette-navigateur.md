# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui
que tu remplaces dans `docs/handoffs/`.

> **Multi-agents** : si tu n'es pas l'agent qui a écrit la dernière passation,
> tu reprends la main explicitement (nouvelle entrée). Lis aussi
> [`docs/coordination.md`](docs/coordination.md).

---

# Passation — 2026-08-31 (nuit) · Réglages desktop livrés et déployés · première recette navigateur depuis le 14/08

| | |
|---|---|
| **Agent** | **Claude Code (Opus 5)**. J'ai la main depuis la passation précédente (même agent). |
| **GitHub** | `origin/main` = **`fe0c8d8`** (PR #4, #6, #7 mergées). |
| **Prod** | **`9e9f674`** — déployée par Hermes. **En retard d'un commit** : PR #7 (`fe0c8d8`) n'est pas déployée. Écart cosmétique, voir « Blockers ». |

## Goal

Reprendre les améliorations en cours. Trois PR livrées, le canal de lecture
prod réparé, et la première recette navigateur authentifiée depuis le 14/08.

## Current state

### Déployé en prod (`9e9f674`)

**PR #4 — `/api/agenda` porte une garde MIXTE** (`requireSessionOrMachineToken`,
`src/lib/guard.ts`) : session utilisateur **ou** `BRIEF_DIGEST_TOKEN`.
`scripts/brief-agents.sh agenda` était cassé depuis le 26/08 (il envoyait
`x-brief-pin` à une route passée sous `requireSession()`). **Vérifié en live :
répond 200 avec le jeton.**

> La consigne d'Aramis était de *remplacer* `requireSession()`. Vérification
> faite avant d'écrire : `/api/agenda` est la source unique de l'accueil, de
> l'onglet Agenda et du calendrier desktop (`fetchAgendaDay`). Un remplacement
> pur aurait éteint ces trois écrans en 401, sans erreur serveur.

**PR #6 — Réglages desktop derrière l'avatar.** Store `settings.json` +
`GET`/`PATCH /api/settings` ; l'avatar ouvre l'écran Réglages (l'onglet quitte
la nav, 8 → 7) ; « Verrou PIN » devient un bloc **Compte** avec la déconnexion
qui manquait totalement au desktop. Spec :
`docs/superpowers/specs/2026-08-30-reglages-desktop-profil-design.md`.

### Mergée, PAS déployée

**PR #7 — l'écran Réglages va chercher l'âge de synchro CalDAV qu'il affiche.**
Régression de la PR #6 trouvée **par la recette navigateur** : l'écran
affichait « jamais synchronisé » alors que la synchro était passée 14 min plus
tôt. `calendarSyncAt` n'était alimenté que par `openAccount()` (le sheet
mobile) ; l'avatar n'y passant plus, la valeur restait `null`.
`relativeSyncLabel` est sortie dans `src/lib/syncLabel.ts` avec une horloge
injectable et ses premiers tests.

### Recette navigateur — enfin possible, et faite

**Le blocage qui durait depuis le 14/08 est levé.** Deux choses ont débloqué :

1. **Les clés Supabase** sont dans le `.env.local` du Mac (ajoutées par Aramis).
   ⚠️ Malgré leur préfixe `NEXT_PUBLIC_`, elles sont lues **côté serveur
   uniquement** — pas dans le bundle, un agent ne peut pas les récupérer seul.
2. **Le cookie de session Chrome** a été importé dans `/browse`
   (`setup-browser-cookies`). Les écrans authentifiés de la prod sont
   accessibles.

Validé en live sur la prod : 7 onglets sans « Réglages » · avatar avec
`aria-current="page"` et l'anneau d'encre · bloc Compte (adresse, changement de
mot de passe, déconnexion) · plus de « Verrou PIN » · **bascule « Digest
Telegram » qui coupe puis rétablit réellement `/api/digest`** (`enabled:false`
+ listes vides → `enabled:true` + vrai récap ; remise sur ON) · zéro erreur
console.

### Bug « Poster 20 / Reposter 15 » — ÉLUCIDÉ, ce n'était pas le graphe

Lu dans les vraies données de prod avec la session :

| Tâche | État |
|---|---|
| Poster 20 articles | `doneAt` 30/08 21h16, `rrule` **effacée** |
| Reposter 15 articles | `doneAt` 30/08 18h02, `rrule` **effacée** |
| Poster 10 / Reposter 10 | vivantes, `FREQ=WEEKLY;UNTIL=20260831T235959Z;BYDAY=MO,TU,WE,TH` |

Les quatre séries portaient une **fin de répétition au 31 août**. En cochant
« Poster 20 » dimanche soir, `completionPatch` a cherché la prochaine
occurrence (6 septembre), l'a trouvée après `UNTIL`, et a **clos la série** :
`{ doneAt: now, rrule: null }` (`src/lib/completion.ts:152`). `doneAt` exclut
l'item du graphe ET du digest — les deux symptômes d'un coup. Comportement
voulu, pas un bug de code.

**Calcul demandé par Aramis** (60 articles restant à mettre en vente,
« Reposter » ne consomme pas de stock) : épuisement le **vendredi 4 septembre**
(10/jour lun–jeu, 20/jour ven–dim). Aramis a modifié les dates de fin dans
l'app Calendrier.

## Decisions

Ajoutées en tête de `DECISIONS.md` (2026-08-30 nuit) :

1. **Garde MIXTE sur `/api/agenda`** — session OU jeton machine, jamais un
   remplacement. Un seul secret pour `digest` et `agenda`.
2. **Réglages derrière l'avatar** ; défauts des réglages à ON ; « Verrou PIN »
   → bloc Compte ; mobile hors périmètre.

## Blockers

1. **PR #7 non déployée.** Trois demandes envoyées (`deploy.sh`), toutes en
   202. La prod n'a pas bougé. ⚠️ **Le 202 du webhook ne prouve rien** : un
   garde-fou d'approbation Telegram (timeout ~303 s) attend un `/approve`
   d'Aramis, et Hermes doit être en session. Le `"event": "unknown"` de la
   réponse JSON est un **faux indice** (Hermes : « la route accepte tous les
   events »). Conséquence de l'écart : le libellé « jamais synchronisé » dans
   les Réglages. Cosmétique — rien d'autre ne diffère.
2. **Pas de SSH vers le VPS depuis le Mac** (`Permission denied
   (publickey,password)`) : impossible de déployer ou de lire les logs seul.

## Next — la prochaine action

1. **Déployer `fe0c8d8`** dès qu'Hermes est en session (`bash
   .claude/commands/deploy.sh "…"` puis `/approve` sur Telegram). Aramis a
   proposé de configurer l'auto-approbation pour les commandes de déploiement
   connues — ça vaut le coup, l'approbation manquée a coûté 40 min.
2. **Vérifier que le calendrier Apple a bien propagé les nouvelles dates de
   fin** : les items portaient encore `UNTIL=20260831` à 23h. `decideSync`
   (`src/lib/caldav.ts:786`) fait **adopter** la version du calendrier — c'est
   donc là et nulle part ailleurs que la date de fin se change. Une fois
   propagé : **rouvrir « Poster 20 » et « Reposter 15 »** (`PATCH /api/items`
   `{id, done:false}`), la synchro ne ressuscite pas un item terminé.
3. **⚠️ n8n** : nœud IF sur `enabled` dans le workflow du récap du matin. Sans
   lui, couper la bascule « Digest Telegram » enverra un récap vide.
4. **Chantier validé par Aramis, non commencé** : prévenir avant qu'une
   récurrence se termine (« dernière occurrence » sur la tâche + confirmation à
   la coche). C'est ce manque qui a fait perdre deux séries sans s'en
   apercevoir.
5. Reste des notes du 30/08 (`TODOS.md` P3) : **Kanban « copie Trello »**
   (le plus gros), raccourcis flèches, calendrier à repenser, toasts, hover.

## Validations — passants / échoués / non lancés

```
$ npx vitest run     → 466 passants, 1 skipped (38 fichiers)   [+40 sur la session]
$ npx tsc --noEmit   → 0 erreur
$ npx eslint .       → 0 erreur (29 warnings préexistants, −1)
```

- **Passant, en live sur la prod** : `/api/agenda` + Bearer → 200 · `/api/settings`
  sans session → 401 · recette navigateur authentifiée (détail ci-dessus).
- **Non lancé** : `npm run build` (règle du repo).
- **Non lancé** : `/code-review` sur les PR #4, #6, #7.

## Changed

| Fichier | PR | Nature |
|---|---|---|
| `src/lib/guard.ts` | #4, #6 | `requireSessionOrMachineToken`, `readSessionClaims` |
| `src/lib/cron-auth.ts` | #4 | `hasMachineCredential` |
| `src/app/api/agenda/route.ts` | #4 | garde mixte |
| `scripts/brief-agents.sh` | #4, #6 | Bearer pour `agenda`, PIN retiré, **avertissement doublon `.env`** |
| `src/lib/settings.ts` + `.test.ts` | #6 | **neuf** — `normalizeSettings`, `applySettingsPatch` |
| `src/lib/store.ts` + `store-settings.test.ts` | #6 | `readSettings`, `updateSettingsAtomically` |
| `src/app/api/settings/route.ts` + `.test.ts` | #6 | **neuve** — GET/PATCH |
| `src/app/api/cron/caldav-sync/route.ts` + `.test.ts` | #6 | sortie avant réseau si désactivé |
| `src/app/api/digest/route.ts` + `.test.ts` | #6 | `enabled: false` si coupé |
| `src/app/api/auth/session/route.ts` + `.test.ts` | #6 | rend l'adresse du compte |
| `src/components/desktop/DesktopSettings.tsx` | #6, #7 | bascules réelles, bloc Compte, **fetch CalDAV** |
| `src/components/desktop/DesktopHeader.tsx` | #6 | onglet retiré, avatar = état actif |
| `src/components/desktop/DesktopShell.tsx`, `BriefApp.tsx` | #6, #7 | avatar → Réglages, `logout` partagé, props morts retirés |
| `src/lib/syncLabel.ts` + `.test.ts` | #7 | **neuf** — sorti de `DesktopShell`, horloge injectable |
| `README.md` | #6 | Supabase serveur-only, piège du doublon `.env` |

---

## Historique des passations

| Date | Sujet | Agent | Lien |
|---|---|---|---|
| 2026-08-31 (nuit) | Réglages desktop déployés + première recette navigateur | Claude Code (Opus 5) | (cette passation) |
| 2026-08-30 (nuit, tard) | Accès agenda machine + Réglages derrière le profil — PR #4 et #5 | Claude Code (Opus 5) | [fiche](docs/handoffs/2026-08-30-nuit-tard-agenda-machine-reglages.md) |
| 2026-08-30 (nuit) | Graphe & Objectifs déployé + recette round 1 | Claude Code | [fiche](docs/handoffs/2026-08-30-nuit-graphe-objectifs-deploye-recette1.md) |
| 2026-08-30 (soir) | Graphe & Objectifs, le moteur — PR #3 | Claude Code | [fiche](docs/handoffs/2026-08-30-graphe-objectifs-moteur-pr3.md) |
| 2026-08-30 (session) | Chantier Objectifs & Projets codé, recette à faire | Hermes Agent | [fiche](docs/handoffs/2026-08-30-hermes-objectifs-projets-recette.md) |
