# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui
que tu remplaces dans `docs/handoffs/`.

> **Multi-agents** : si tu n'es pas l'agent qui a écrit la dernière passation,
> tu reprends la main explicitement (nouvelle entrée). Lis aussi
> [`docs/coordination.md`](docs/coordination.md).

---

# Passation — 2026-08-31 (nuit) · Lot 1 du pivot multi-utilisateur : les données sont cloisonnées

| | |
|---|---|
| **Agent** | **Claude Code (Opus 5)**. Je garde la main (passation précédente : moi-même, 31/08 soir). |
| **Branche** | **`feat/multi-user-store`**, 7 commits, **non poussée, pas de PR**. |
| **Base** | `main` @ `bf58eb2`. |
| **GitHub** | `origin/main` = `bf58eb2`. |
| **Prod** | **`72a7d1db`** — v1.1.0.0. Ne contient RIEN de ce chantier. |

## Goal

Cloisonner les données de Brief par compte. L'auth Supabase existait depuis le
26/08, mais aucune donnée ne portait d'identifiant : les 18 exports de
`store.ts` étaient globaux et **tous les comptes ouvraient le même Brief**.

## Current state — le lot 1 est écrit et vert, pas déployé

Le chantier est découpé en **trois lots**. Design et six décisions arbitrées
avec Aramis :
[`docs/superpowers/specs/2026-08-31-pivot-multi-utilisateur-design.md`](docs/superpowers/specs/2026-08-31-pivot-multi-utilisateur-design.md).
Plan d'exécution :
[`docs/superpowers/plans/2026-08-31-multi-user-lot1-cloisonnement.md`](docs/superpowers/plans/2026-08-31-multi-user-lot1-cloisonnement.md).

### Ce qui est fait (lot 1)

- **`store.ts` réécrit** : `storeForUser(userId)` rend un `Store` dont les
  fichiers vivent sous `BRIEF_DATA_DIR/users/<userId>/`. File d'écriture **par
  compte**. `push-store.ts` absorbé et supprimé ; sa partie pure est dans
  `push-subscription.ts`.
- **`requireStore()`** (`guard.ts`) fait la garde ET rend le store — les 17
  routes l'utilisent.
- **Les deux crons itèrent** sur `authorized_users` via `sweepUsers`
  (`cron-sweep.ts`) : un compte en échec n'interrompt pas les suivants, et
  l'ordre tourne d'un passage à l'autre.
- **Migration automatique au démarrage** (`instrumentation.ts` +
  `migrate-multiuser.ts`), idempotente et non destructive.
- **Les exports globaux de `store.ts` sont supprimés** — c'est le typecheck qui
  a prouvé qu'aucun appelant n'était oublié.
- **`no-direct-store-access.test.ts`** interdit à une route de fabriquer son
  propre store.

### Ce qui reste mono-compte, volontairement

| Quoi | Conséquence aujourd'hui | Lot |
|---|---|---|
| `BRIEF_CALDAV_*` (4 variables) | un seul compte iCloud pour toute l'app | 3 |
| Jetons `capture` et `digest` | écrivent chez `BRIEF_OWNER_USER_ID` | 2 |

## Decisions

Six arbitrages d'Aramis, inscrits dans `DECISIONS.md` (entrée du 31/08 soir)
avec leur pourquoi. Les deux qui commandent le reste :

1. **Fichiers JSON par compte, pas Postgres.** Le cloisonnement repose donc sur
   du code discipliné, pas sur RLS.
2. **Fabrique de store, et suppression des exports globaux.** C'est ce qui rend
   la discipline vérifiable : un appelant oublié ne compile plus.

⚠️ Aramis a choisi **CalDAV par utilisateur** (lot 3) contre ma recommandation
de garder un seul compte iCloud. C'est acté ; je l'ai simplement mis en dernier
lot, parce qu'un compte agent n'a pas de calendrier Apple.

## Validations

```
$ npx eslint .       → 0 erreur, 0 warning
$ npx tsc --noEmit   → 0 erreur
$ npx vitest run     → 575 passants, 1 skipped (46 fichiers)   [531 avant]
```

**Passant, vérifié sur un serveur réel** (worktree isolé sur le port 3199, avec
une copie de `.data`) — les trois cas de la migration :

- `[migration] 2 fichier(s) attribué(s) au compte … Les originaux sont dans _pre-multiuser/.`
- au redémarrage : `[migration] rien à faire (already-migrated)`
- sans `BRIEF_OWNER_USER_ID` : `[migration] BLOQUÉE — …` et **le répertoire
  n'est pas touché**, le serveur démarre quand même.

**Passant** : `GET /` → 200 et `GET /api/settings` → 401 sur le dev local.

**NON LANCÉ :**

- **`npm run build`** — un `next dev` tourne sur le port 3100 (règle du repo).
- **Aucune recette d'écran authentifié.** Le blocage est intact tant que ce lot
  n'est pas déployé : c'est précisément ce qu'il vient débloquer.
- **`readSyncState`, `recordDeletedExternalUid`, `readAgendaSnapshot`,
  `runCalDavSync`, `runReminders`, `sendPush` n'ont AUCUN test unitaire direct**
  — ni avant ni après ce chantier. Le typecheck est leur seul filet ici. À
  surveiller à la recette.

## Next — la prochaine action

1. **Relire le diff** (`/code-review`), puis PR sur `main`.
2. **Déployer, dans cet ordre** — c'est le seul lot qui touche aux données
   existantes :
   1. Hermes lance **`deploy/backup.sh` AVANT tout**.
   2. Poser dans `.env.production` : **`SUPABASE_SECRET_KEY`** (clé
      service-role Supabase) et **`BRIEF_OWNER_USER_ID`** (l'UUID d'Aramis, à
      lire dans `authorized_users`). Aucune migration SQL pour ce lot.
   3. Build + `up`. **Lire le journal `[migration]` en premier** : il dit
      exactement ce qui a été déplacé.
   4. Vérifier qu'Aramis retrouve ses tâches.
3. **Puis seulement** : créer le compte agent, et recetter les écrans
   authentifiés — le blocage de trois sessions tombe là.
4. Lots 2 et 3 : voir le spec.

### ⚠️ Ce qui revient à Aramis, hors de portée d'un agent

- Poser les deux variables sur le VPS (via Hermes — pas de SSH depuis le Mac).
- Faire lancer `backup.sh` avant le déploiement.
- **Ne pas créer le compte agent avant que le lot 1 soit déployé et vérifié.**
  Aujourd'hui en prod, il donnerait un accès complet aux vraies données.
- Révoquer le `TODOIST_API_TOKEN` chez Todoist (jeton vivant pour du code
  supprimé) — reste de la passation précédente.

## Blockers

1. **Pas de SSH vers le VPS depuis le Mac.** Déployer passe par un message à
   Hermes. ⚠️ Le webhook `deploy.sh` rend 202 sans rien déclencher, et
   **l'absence de confirmation ne prouve pas qu'un déploiement n'a pas eu
   lieu** — demander le SHA à Hermes.
2. **Aucun agent ne peut recetter un écran authentifié.** Inchangé, et c'est ce
   que ce lot vient résoudre une fois déployé.
3. **Plafond de dépense mensuel atteint le 31/08** (HTTP 429 sur un sous-agent).

### Différé, à ne pas perdre (dans `TODOS.md`)

- **⚠️ « Reporter » une tâche perd l'heure** et ne retire pas l'occurrence du
  jour. Signalé le 31/08, non reproduit.
- **⚠️ Les étiquettes ne se voient pas dans la fiche tâche.** Signalé le 31/08,
  non reproduit.
- Quatre intentions jamais câblées (« Réessayer » après échec, file hors-ligne
  invisible, option `silent` de `loadProjects`, `groupByProject` testé mais
  jamais appelé).

---

## Historique des passations

| Date | Sujet | Agent | Lien |
|---|---|---|---|
| 2026-08-31 (nuit) | Lot 1 du pivot multi-utilisateur : données cloisonnées | Claude Code (Opus 5) | (cette passation) |
| 2026-08-31 (soir) | Le pivot multi-utilisateur n'est pas fait — prochain chantier | Claude Code (Opus 5) | [fiche](docs/handoffs/2026-08-31-soir-pivot-multi-utilisateur-pas-fait.md) |
| 2026-08-31 (journée) | Kanban Trello livré, ménage du code mort, Vercel supprimé | Claude Code (Opus 5) | [fiche](docs/handoffs/2026-08-31-kanban-trello-menage-vercel.md) |
| 2026-08-31 (nuit) | Réglages desktop déployés + première recette navigateur | Claude Code (Opus 5) | [fiche](docs/handoffs/2026-08-31-nuit-reglages-desktop-recette-navigateur.md) |
| 2026-08-30 (nuit, tard) | Accès agenda machine + Réglages derrière le profil — PR #4 et #5 | Claude Code (Opus 5) | [fiche](docs/handoffs/2026-08-30-nuit-tard-agenda-machine-reglages.md) |
