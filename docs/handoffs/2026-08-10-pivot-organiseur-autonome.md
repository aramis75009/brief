# Passation — 2026-08-10 · Le pivot : Brief possède ses données

> ⚠️ **Reconstruit a posteriori depuis git le 2026-08-14.** `Goal`, `Decisions`
> et `Blockers` sont déduits des diffs, de `docs/designs/organiseur-autonome.md`
> et de `TODOS.md`. `Changed` et `Validations` sont factuels.

| | |
|---|---|
| **Agent** | Claude Code |
| **Branche** | `main` |
| **Commits** | `06c2e92`, `7e9e007` |

## Goal — l'objectif

Sortir Brief de sa dépendance à Todoist, et lui donner ses propres rappels.

## Current state — ce qui a été fait

**C'est la journée la plus structurante du projet.** Brief cesse d'écrire chez
un tiers : stockage fichier JSON en écriture atomique (`src/lib/store.ts`),
rappels par Web Push depuis le serveur, conteneurisation complète.

Sont apparus le même jour : `DESIGN.md` (192 lignes), `TODOS.md`, le
`Dockerfile`, le `docker-compose.yml`, `deploy/backup.sh`, et la note de
conception `docs/designs/organiseur-autonome.md`.

Second commit : refonte visuelle « Claude Design » — onglet Vision
(`OverviewScreen`, 515 lignes), formes de projets, état d'attente.

## Decisions — choix critiques ou irréversibles

**Brief possède ses données.** Fichiers JSON, écriture atomique (`temp` +
`rename`) et file d'écritures sérialisée. Plus aucun plafond de projets.

**CalDAV a été écarté — et ne doit pas revenir sans nouvelle décision.** Un
compte CalDAV tiers sur iOS n'a pas de push APNs : plancher de synchronisation
d'environ 15 minutes, ce qui casse tout rappel à court terme. Un serveur qui
tourne 24 h/24 pousse à l'instant exact.

**C'est le serveur qui possède l'horloge.** iOS ne donne aucune API de
notification programmée à une PWA — ni Notification Triggers, ni Background
Sync, ni Periodic Background Sync, ni Background Fetch. D'où un conteneur `cron`
séparé qui appelle `/api/cron/reminders` toutes les 60 s.

**Pourquoi un conteneur et pas un `setInterval`** : un planificateur en mémoire
disparaît au premier redémarrage, et c'est précisément ce qu'un rappel ne doit
pas faire.

**Une date illisible devient « pas d'échéance », jamais une date approchée.**
Un rappel absent se voit ; un rappel au mauvais moment ne se voit pas.

## Changed — fichiers et composants

| Fichier | Nature |
|---|---|
| `DESIGN.md` | créé (192 l.) puis étendu (+85 l.) |
| `TODOS.md` | créé |
| `Dockerfile`, `docker-compose.yml`, `.dockerignore` | créés |
| `deploy/backup.sh` | créé |
| `docs/designs/organiseur-autonome.md` | créé |
| `docs/designs/preview-systeme.html` | créé (613 l.) |
| `src/app/api/overview/route.ts` | créé |
| `src/components/OverviewScreen.tsx` | créé (515 l.) |
| `src/components/icons.tsx` | créé |
| `CLAUDE.md`, `.env.production.example`, `README.md` | mis à jour |

## Validations — passants / échoués / non lancés

- **Non lancés :** la suite de tests n'existe toujours pas à cette date.
- **Non vérifié :** le Web Push n'a jamais sonné sur un vrai iPhone. Seuls les
  chemins d'échec sont couverts.

## Blockers — ce qui bloque

Rien ne tourne encore en HTTPS sur une machine à nous. Sans ça, ni le Web Push
ni la persistance ne peuvent être prouvés.

## Next — la prochaine action

Déployer sur le VPS avec un vrai domaine et TLS.
