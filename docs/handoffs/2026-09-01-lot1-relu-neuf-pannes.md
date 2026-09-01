# Passation — 2026-09-01 · Lot 1 multi-utilisateur relu : neuf pannes silencieuses fermées

| | |
|---|---|
| **Agent** | **Claude Code (Opus 5)**. Je garde la main (passation précédente : moi-même, 31/08 nuit). |
| **Branche** | **`feat/multi-user-store`**, 16 commits, **non poussée, pas de PR**. |
| **Base** | `main` @ `bf58eb2`. |
| **GitHub** | `origin/main` = `bf58eb2` — personne n'a avancé depuis hier. |
| **Prod** | injoignable depuis le Mac (normal). Dernier état connu : `72a7d1db`, v1.1.0.0, qui ne contient **rien** de ce chantier. |

## Goal

Finir le lot 1 du pivot multi-utilisateur : relire, corriger, préparer le
déploiement. Le code du lot était écrit et vert au 31/08 ; cette session l'a
**relu** et a fermé ce que la relecture a trouvé.

## Current state — le lot 1 est relu, corrigé et vert. Toujours pas déployé.

Design et six décisions arbitrées :
[`docs/superpowers/specs/2026-08-31-pivot-multi-utilisateur-design.md`](docs/superpowers/specs/2026-08-31-pivot-multi-utilisateur-design.md).
Plan :
[`docs/superpowers/plans/2026-08-31-multi-user-lot1-cloisonnement.md`](docs/superpowers/plans/2026-08-31-multi-user-lot1-cloisonnement.md).
Le lot 1 lui-même est décrit dans la passation d'hier,
[`docs/handoffs/2026-08-31-nuit-lot1-multi-utilisateur.md`](docs/handoffs/2026-08-31-nuit-lot1-multi-utilisateur.md) —
**inchangé dans ses principes**.

### Les neuf défauts fermés cette session

Aucun ne levait d'erreur. Aucun n'aurait fait rougir un test. Les cinq
premiers venaient d'une relecture faite avant la coupure et étaient restés
**non commités** ; les quatre derniers viennent de `/code-review high` lancé
aujourd'hui sur la branche entière.

| # | Défaut | Ce qu'il aurait produit | Commit |
|---|---|---|---|
| 1 | Les deux routes `/api/audio` recomposaient `join(BRIEF_DATA_DIR, "audio")` sans passer par le store | N'importe quel compte autorisé servait la dictée d'un autre par `GET /api/audio/<id>` — les ids `audio_<timestamp base36>` sont énumérables | `6c1468c` |
| 2 | Le cron CalDAV itérait sur **tous** les comptes, alors que `BRIEF_CALDAV_*` est global | La phase d'adoption de `runCalDavSync` aurait écrit **l'agenda entier du propriétaire** dans les tâches de chaque autre compte. `settings.caldavSync` ne l'aurait pas empêché : un compte neuf n'a pas de `settings.json` et le défaut est ON | `0960fe7` |
| 3 | `listAuthorizedUserIds()` **lève** si Supabase est injoignable | Une panne Supabase de trois minutes n'aurait pas dégradé les rappels : elle les aurait **éteints pour tout le monde** | `0960fe7` |
| 4 | `already-migrated` se fiait à l'existence de `users/<owner>/`, que la première écriture venue crée | Un démarrage sans `BRIEF_OWNER_USER_ID` (cas **prévu**, le serveur monte quand même) condamnait la migration **pour toujours**, avec un rassurant « rien à faire » au journal et les vraies données abandonnées à la racine | `a2d7c53` |
| 5 | Les dictées n'étaient pas migrées du tout ; `caldav-agenda-snapshot.json` manquait à la liste | Chaque fiche tâche affichait un lecteur audio rendant 404 | `a2d7c53` |
| 6 | `USER_ID_PATTERN` accepte les majuscules, et l'identifiant devient un **chemin** | `BRIEF_OWNER_USER_ID` est saisi à la main sur le VPS. En majuscules : migration vers `users/A1B2…/` annoncée en succès, pendant que les routes lisent `users/a1b2…/`. **Deux répertoires sur l'ext4 du VPS, un seul sur le macOS de dev** — le bug n'existe qu'en production. Second étage : le cache de stores et la file d'écritures sont indexés par cet identifiant, donc deux files pour un même répertoire et la sérialisation tombe | `afeb0e6` |
| 7 | `SWEEP_BUDGET_MS = 40_000`, calé sur `maxDuration` — mais le vrai client est `curl -fsS -m 30` | Dès qu'assez de comptes existent, curl abandonne et journalise `[cron] passage échoué` **chaque minute sur des passages qui réussissent**. Le seul signal d'échec du déploiement devenait du bruit permanent | `afeb0e6` |
| 8 | Le repli des rappels ne couvrait que le cas où Supabase **lève** | Une liste vide rendue **sans erreur** (clé service-role sur le mauvais projet, table renommée) donnait `200 {users: 0}`, `curl -fsS` vert, et aucun rappel pour personne | `afeb0e6` |
| 9 | Une dictée sautée par la migration restait à la racine **définitivement** — l'archive créée juste après est la sentinelle d'idempotence | Fichier plus jamais servi, plus jamais repris, et **rien au journal** | `afeb0e6` |

### Ce qui est aussi sorti de cette session

- **Deux nouveaux invariants outillés** : aucune route ne lit
  `process.env.BRIEF_DATA_DIR` (`no-direct-store-access.test.ts`) — c'est la
  classe d'oubli que le premier invariant ne voyait pas ; et
  `normalizeUserId` est le seul point où un identifiant devient un chemin.
- **Premiers tests de `/api/cron/reminders`** (6 cas). Cette route n'en avait
  aucun.
- **`SUPABASE_SECRET_KEY` et `BRIEF_OWNER_USER_ID` posés dans `.env.example` et
  `.env.production.example`** — le déploiement les exige et ils n'étaient dans
  aucun fichier d'exemple.
- **Le contrat `-m 30` ↔ `SWEEP_BUDGET_MS` est écrit des deux côtés**
  (`docker-compose.yml` et les deux routes), pour qu'on ne puisse plus bouger
  l'un sans voir l'autre.

## Decisions

Les six arbitrages d'Aramis du 31/08 (`DECISIONS.md`) tiennent, inchangés.
Trois décisions de cette session, toutes miennes et toutes réversibles :

1. **Le cron CalDAV ne traite que `BRIEF_OWNER_USER_ID`, et rend 503 s'il
   manque** — porte fermée plutôt qu'ouverte par défaut. Ce n'est **pas** une
   simplification à lever à la légère : le raccourci évident (« faire itérer le
   cron ») est exactement le défaut n° 2. Écrit dans `AGENTS.md` et `TODOS.md`
   là où quelqu'un le lira avant de le refaire.
2. **L'identifiant est normalisé en minuscules plutôt que refusé en
   majuscules.** Refuser aurait été loyal aussi (échec bruyant au déploiement),
   mais tolérer coûte une ligne et supprime la divergence, qui est le vrai bug.
3. **La course sur `caldav-last-sync.json` n'est PAS corrigée ici** — voir
   Blockers.

## Validations

Lancées sur l'arbre final, sortie vue :

```
$ npx eslint .       → 0 erreur, 0 warning
$ npx tsc --noEmit   → 0 erreur
$ npx vitest run     → 589 passants, 1 skipped (46 fichiers)   [575 avant]
```

**Passant, vérifié** : `GET http://localhost:3100/` → 200 (le `next dev` en
cours). `bash scripts/coord/status.sh` → `origin/main` = `bf58eb2`, inchangé.

**NON LANCÉ — à ne pas croire fait :**

- **`npm run build`.** Un `next dev` tourne sur le port 3100 : la règle du repo
  l'interdit (corruption de `.next`).
- **Les validations n'ont pas été relancées à chaque commit**, seulement sur
  l'arbre final. Le découpage est thématique, pas bissectable garanti.
- **Aucune recette d'écran authentifié.** Inchangé depuis quatre sessions :
  c'est précisément ce que ce lot vient débloquer une fois déployé.
- **La migration n'a PAS été rejouée sur un serveur réel après les correctifs
  d'aujourd'hui.** Elle l'avait été le 31/08 (worktree isolé, port 3199, copie
  de `.data`, trois cas vérifiés), mais `a2d7c53` et `afeb0e6` ont changé sa
  logique de sentinelle, ajouté les dictées et normalisé la casse. **Les tests
  unitaires couvrent les trois, pas le serveur réel.** À refaire avant le
  déploiement si le temps le permet.
- **`readSyncState`, `recordDeletedExternalUid`, `readAgendaSnapshot`,
  `runCalDavSync`, `runReminders`, `sendPush` n'ont toujours AUCUN test
  unitaire direct.** Le typecheck est leur seul filet.

## Next — la prochaine action

1. **Pousser la branche et ouvrir la PR sur `main`.** ⚠️ **Pas fait :** la
   règle permanente d'Aramis est « ne pas pousser sans demande explicite », et
   je n'ai pas eu cette demande pour ce geste précis. Tout le reste est prêt ;
   il ne manque qu'un `git push -u origin feat/multi-user-store` + `gh pr
   create`.
2. **Déployer, dans cet ordre** — c'est le seul lot qui touche aux données
   existantes :
   1. Hermes lance **`deploy/backup.sh` AVANT tout**.
   2. Poser dans `.env.production` : **`SUPABASE_SECRET_KEY`** (clé
      service-role Supabase) et **`BRIEF_OWNER_USER_ID`** (UUID d'Aramis, à
      lire dans `authorized_users`). **En minuscules de préférence** — c'est
      désormais toléré, mais autant ne pas dépendre du correctif. Aucune
      migration SQL.
   3. Build + `up`. **Lire le journal `[migration]` en premier** : il dit
      exactement ce qui a été déplacé, et **avertit en `warn`** si des dictées
      ont été laissées à la racine.
   4. Vérifier qu'Aramis retrouve ses tâches **et** que ses dictées se jouent.
3. **Puis seulement** : créer le compte agent, et recetter les écrans
   authentifiés — le blocage de quatre sessions tombe là.
4. Lots 2 et 3 : voir le spec. Le lot 3 est plus urgent qu'il n'y paraît —
   d'ici là, **tout compte qui n'est pas le propriétaire n'a aucune synchro
   calendrier**.

### ⚠️ Ce qui revient à Aramis, hors de portée d'un agent

- Poser les deux variables sur le VPS (via Hermes — pas de SSH depuis le Mac).
- Faire lancer `backup.sh` avant le déploiement.
- **Ne pas créer le compte agent avant que le lot 1 soit déployé et vérifié.**
  Aujourd'hui en prod, il donnerait un accès complet aux vraies données.
- Révoquer le `TODOIST_API_TOKEN` chez Todoist (jeton vivant pour du code
  supprimé) — reste des passations précédentes.

## Blockers

1. **Push et PR en attente d'un feu vert explicite** (voir Next, point 1).
2. **Pas de SSH vers le VPS depuis le Mac.** Déployer passe par un message à
   Hermes. ⚠️ Le webhook `deploy.sh` rend 202 sans rien déclencher, et
   **l'absence de confirmation ne prouve pas qu'un déploiement n'a pas eu
   lieu** — demander le SHA à Hermes.
3. **Aucun agent ne peut recetter un écran authentifié.** Inchangé.
4. **Course sur `caldav-last-sync.json`, trouvée en revue, NON corrigée** —
   pré-existante, détaillée dans `TODOS.md` § « Dette connue ».
   `recordDeletedExternalUid` lit sans sérialiser puis écrit en sérialisant,
   pendant que `runCalDavSync` relit et réécrit le même état sur un passage de
   plusieurs dizaines de secondes. **Symptôme à reconnaître : une tâche
   supprimée qui revient.** Non corrigée parce que ni `readSyncState` ni
   `recordDeletedExternalUid` n'ont de test unitaire — élargir le périmètre à
   du code non couvert juste avant un déploiement qui touche aux vraies données
   était le mauvais échange.

### Différé, à ne pas perdre (dans `TODOS.md`)

- **⚠️ « Reporter » une tâche perd l'heure** et ne retire pas l'occurrence du
  jour. Signalé le 31/08, non reproduit.
- **⚠️ Les étiquettes ne se voient pas dans la fiche tâche.** Signalé le 31/08,
  non reproduit.
- Quatre intentions jamais câblées (« Réessayer » après échec, file hors-ligne
  invisible, option `silent` de `loadProjects`, `groupByProject` testé mais
  jamais appelé).
