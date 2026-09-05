# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui
que tu remplaces dans `docs/handoffs/`.

> **Multi-agents** : si tu n'es pas l'agent qui a écrit la dernière passation,
> tu reprends la main explicitement (nouvelle entrée). Lis aussi
> [`docs/coordination.md`](docs/coordination.md).

---

# Passation — 2026-09-01 (après-midi) · Lot 1 multi-utilisateur livré dans `main` — reste à déployer

| | |
|---|---|
| **Agent** | **Claude Code (Opus 5)**. Je garde la main (passation précédente : moi-même, 01/09 matin). |
| **Branche** | `docs/passation-lot1-livre` (cette passation). Le chantier lui-même, `feat/multi-user-store`, est **fusionné**. |
| **Base** | `main` @ `a21c1f3`. |
| **GitHub** | **`origin/main` = `a21c1f3`** — PR #14 fusionnée, **v1.2.0.0**. |
| **Prod** | injoignable depuis le Mac (normal, pas de SSH hôte). Dernier état connu : `72a7d1db`, **v1.1.0.0**, qui ne contient **rien** de ce chantier. |

## Goal

Finir le lot 1 du pivot multi-utilisateur : le faire atterrir dans `main`. Fait.
Le lot était relu et vert ce matin ; cette session l'a passé par `/ship` (revue
de pré-atterrissage, version, CHANGELOG, PR, fusion).

## Current state — livré dans `main`, PAS déployé

**Le code est dans `main`. La production tourne toujours sans lui.** C'est le
seul écart qui compte, et il est volontaire : ce lot déplace des données, donc
le déploiement demande une sauvegarde et deux variables d'environnement qui
n'existent pas encore sur le VPS.

Ce que `/ship` a produit au-delà de la fusion :

| | |
|---|---|
| **Version** | `1.1.0.0` → **`1.2.0.0`** (MINEUR, arbitré par Aramis). `CHANGELOG.md` § 1.2.0.0 porte l'entrée complète. |
| **Revue de pré-atterrissage** | **1 trouvaille, corrigée** — voir ci-dessous. |
| **PR** | [#14](https://github.com/aramis75009/brief/pull/14), fusionnée le 01/09 à 13:06 UTC. |

### La trouvaille de la revue — `ed1293c`

`[P1]` **`/api/cron/reminders` répondait 200 quand il ne servait AUCUN compte.**
Quand Supabase est injoignable *et* que `BRIEF_OWNER_USER_ID` manque,
`ownerFallback()` rend `[]` ; le `console.error` part dans le journal du
conteneur, que le cron ne lit pas. `curl -fsS` restait vert pendant que plus
aucun rappel ne partait pour personne — la panne muette exacte que le repli
venait fermer un cran plus haut. Le cron CalDAV rendait déjà 503 dans son cas
symétrique. Corrigé en 503, test mis à jour, invariant écrit dans `AGENTS.md`
(`64db640`) parce que c'est typiquement le 503 qu'un agent pressé
« simplifierait » en 200.

Les neuf défauts fermés ce matin sont décrits dans
[`docs/handoffs/2026-09-01-lot1-relu-neuf-pannes.md`](docs/handoffs/2026-09-01-lot1-relu-neuf-pannes.md).

## Decisions

Les six arbitrages d'Aramis du 31/08 (`DECISIONS.md`) tiennent, inchangés.
Deux décisions de cette session :

1. **Version MINEURE (`1.2.0.0`) et non MAJEURE** — arbitrage d'Aramis. L'app
   garde les mêmes écrans et la même API côté client ; ce qui change est
   interne au serveur et couvert par une migration automatique. Le `2.0.0.0`
   reste disponible pour le jour où Brief a vraiment un second utilisateur.
2. **Le 503 du cron des rappels** (ci-dessus) — mienne, réversible, mais elle
   est maintenant écrite comme invariant : la relire avant de la défaire.

## Validations

Lancées sur l'arbre final, sortie vue, enregistrées dans le registre de preuves
gstack (`~/.gstack/projects/aramis75009-brief/logs/`) :

```
$ npx eslint .       → 0 erreur, 0 warning
$ npx tsc --noEmit   → 0 erreur
$ npx vitest run     → 589 passants, 1 skipped (47 fichiers)
```

**NON LANCÉ — à ne pas croire fait :**

- **`npm run build`.** Un `next dev` tourne sur le port 3100 : la règle du repo
  l'interdit (corruption de `.next`). `npx tsc --noEmit` en tient lieu, ce qui
  n'est pas la même chose — il ne prouve pas que la sortie standalone se
  construit.
- **La migration n'a PAS été rejouée sur un serveur réel** depuis `a2d7c53` et
  `afeb0e6`, qui ont changé sa sentinelle, ajouté les dictées et normalisé la
  casse. Elle l'avait été le 31/08, avant ces trois changements. Les tests
  unitaires les couvrent ; le serveur réel, non. **C'est le risque numéro un du
  déploiement.**
- **Aucune recette d'écran authentifié.** Inchangé depuis cinq sessions : c'est
  ce que ce lot débloque une fois déployé.
- **`readSyncState`, `recordDeletedExternalUid`, `readAgendaSnapshot`,
  `runCalDavSync`, `runReminders`, `sendPush` n'ont toujours AUCUN test
  unitaire direct.** Le typecheck est leur seul filet.

## Next — la prochaine action

**Déployer.** Rien d'autre n'est en attente côté code. Dans cet ordre, et
l'ordre compte — c'est le seul lot qui touche aux données existantes :

1. Hermes lance **`deploy/backup.sh` AVANT tout**.
2. Poser dans `.env.production` : **`SUPABASE_SECRET_KEY`** (clé service-role
   Supabase) et **`BRIEF_OWNER_USER_ID`** (UUID d'Aramis, à lire dans
   `authorized_users`). **En minuscules de préférence** — la casse est
   désormais normalisée, mais autant ne pas dépendre du correctif. Aucune
   migration SQL.
3. Build + `up`. **Lire le journal `[migration]` en premier** : il dit
   exactement ce qui a été déplacé, et **avertit en `warn`** si des dictées ont
   été laissées à la racine.
4. Vérifier qu'Aramis retrouve ses tâches **et** que ses dictées se jouent.
5. **Puis seulement** : créer le compte agent, et recetter les écrans
   authentifiés — le blocage de cinq sessions tombe là.

Ensuite, lots 2 et 3 (voir le spec). Le lot 3 est plus urgent qu'il n'y paraît :
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

1. **Pas de SSH vers le VPS depuis le Mac.** Déployer passe par un message à
   Hermes. ⚠️ Le webhook `deploy.sh` rend 202 sans rien déclencher, et
   **l'absence de confirmation ne prouve pas qu'un déploiement n'a pas eu
   lieu** — demander le SHA à Hermes.
2. **Aucun agent ne peut recetter un écran authentifié.** Inchangé.
3. **Course sur `caldav-last-sync.json`, NON corrigée** — pré-existante,
   détaillée dans `TODOS.md` § « Dette connue ». `recordDeletedExternalUid` lit
   sans sérialiser puis écrit en sérialisant, pendant que `runCalDavSync` relit
   et réécrit le même état sur un passage de plusieurs dizaines de secondes.
   **Symptôme à reconnaître : une tâche supprimée qui revient.**

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
| 2026-09-01 (après-midi) | Lot 1 livré dans `main` — v1.2.0.0, PR #14 | Claude Code (Opus 5) | (cette passation) |
| 2026-09-01 (matin) | Lot 1 relu : neuf pannes silencieuses fermées | Claude Code (Opus 5) | [fiche](docs/handoffs/2026-09-01-lot1-relu-neuf-pannes.md) |
| 2026-08-31 (nuit) | Lot 1 du pivot multi-utilisateur : données cloisonnées | Claude Code (Opus 5) | [fiche](docs/handoffs/2026-08-31-nuit-lot1-multi-utilisateur.md) |
| 2026-08-31 (soir) | Le pivot multi-utilisateur n'est pas fait — prochain chantier | Claude Code (Opus 5) | [fiche](docs/handoffs/2026-08-31-soir-pivot-multi-utilisateur-pas-fait.md) |
| 2026-08-31 (journée) | Kanban Trello livré, ménage du code mort, Vercel supprimé | Claude Code (Opus 5) | [fiche](docs/handoffs/2026-08-31-kanban-trello-menage-vercel.md) |
| 2026-08-31 (nuit) | Réglages desktop déployés + première recette navigateur | Claude Code (Opus 5) | [fiche](docs/handoffs/2026-08-31-nuit-reglages-desktop-recette-navigateur.md) |
| 2026-08-30 (nuit, tard) | Accès agenda machine + Réglages derrière le profil — PR #4 et #5 | Claude Code (Opus 5) | [fiche](docs/handoffs/2026-08-30-nuit-tard-agenda-machine-reglages.md) |
