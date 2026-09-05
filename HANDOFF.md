# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui
que tu remplaces dans `docs/handoffs/`.

> **Multi-agents** : si tu n'es pas l'agent qui a écrit la dernière passation,
> tu reprends la main explicitement (nouvelle entrée). Lis aussi
> [`docs/coordination.md`](docs/coordination.md).

---

# Passation — 2026-09-05 · Le calendrier Apple et Brief ne racontaient plus la même semaine

| | |
|---|---|
| **Agent** | **Claude Code (Opus 5)**. Je garde la main (passation précédente : moi-même, 01/09 après-midi). |
| **Branche** | `fix/agenda-occurrences-decalees` — [PR #16](https://github.com/aramis75009/brief/pull/16), **ouverte, non fusionnée**. |
| **Base** | `main` @ `7979624`. |
| **GitHub** | `origin/main` = `7979624`. |
| **Prod** | **`7979624`, branche `main`** — vérifié en SSH. Le lot 1 multi-utilisateur **A ÉTÉ DÉPLOYÉ** entre le 01/09 et aujourd'hui : les données vivent sous `users/<uuid>/` et deux comptes existent. La passation précédente disait « pas déployé » : c'est périmé. |

## Goal

Projet en pause. Aramis demande une seule chose : que **ce qui marchait avant
continue de marcher**, en particulier la synchro du calendrier Apple et le
récap du jour. Le reste attend.

## Ce qui n'allait pas — et pourquoi c'était invisible

Aramis décale ses séances directement dans l'app Calendrier. La synchro CalDAV
adopte bien le décalage (`Item.overrides`), mais **`buildDayAgenda` choisissait
ses occurrences sur la grille RRULE brute AVANT de leur appliquer l'override**.

Une occurrence déplacée n'appartenait alors à aucun jour :

- pas au jour d'**origine** — l'override l'en sort, mais elle y restait
  affichée, horodatée au jour d'arrivée ;
- pas au jour d'**arrivée** — la grille RRULE ne l'y met jamais, elle n'était
  donc jamais candidate.

Mesuré sur la prod avant correctif :

```
GET /api/agenda?date=2026-09-03  →  « Séance push », due = 2026-09-04T14:00Z
GET /api/agenda?date=2026-09-04  →  []          ← Apple l'affiche pourtant le vendredi
GET /api/agenda?date=2026-09-06  →  []          ← « Aller courir » du dimanche, disparue
```

Aucune erreur, aucun test rouge, `failures=0` dans le journal du cron CalDAV :
la synchro faisait son travail, c'est **l'affichage** qui rangeait mal.

`buildDigest` portait le même défaut de fond dans une **troisième copie** : il
classait sur `due` brut et réclamait le matin une séance déjà déplacée à demain.

## Current state

**Correctif écrit, testé, poussé — PAS déployé** (choix d'Aramis aujourd'hui).

- `src/lib/agenda.ts` : le filtre de fenêtre se fait sur l'heure **effective**,
  aux **deux** endroits de la fonction (items ligne ~68, snapshot ligne ~130).
  `candidateOccurrences` ajoute les occurrences qu'un override amène **vers**
  le jour depuis un autre — sans quoi elles ne sont candidates nulle part.
  Dédoublonné par horodatage (un décalage d'heure *dans* la même journée arrive
  par les deux chemins).
- `src/lib/digest.ts` : applique l'override avant de trier, publie l'heure
  réelle, et n'annonce plus une occurrence supprimée (EXDATE).
- 8 tests ajoutés, **tous en échec avant le correctif**.

Vérifié en rejouant les **données réelles de production** hors ligne
(`items.json` + `caldav-agenda-snapshot.json` du compte d'Aramis) : le dimanche
6 n'est plus vide, le vendredi 4 retrouve « Séance push », le jeudi 3 ne montre
plus d'événement mal daté. La semaine rendue par Brief redevient celle d'Apple.

### Une donnée réparée en production (accord d'Aramis)

`it_1787066667909_reposter15` — « Reposter 15 articles » — portait un `doneAt`
et avait **perdu sa `rrule`**, alors que la série tourne toujours côté Apple
(`FREQ=WEEKLY;BYDAY=FR,SA,SU`). Un item terminé ne produit plus d'ICS, sort donc
de `desired`, et n'est plus jamais réconcilié par la synchro : **il était gelé
pour toujours**. Ce n'est pas le bug ci-dessus, c'est un accident de donnée.

Réparé après sauvegarde fraîche (`/var/backups/brief/brief-20260905-114409.tar.gz`) :
`rrule` remise, `doneAt` remis à `null`, `due` avancé à la prochaine occurrence
réelle (`2026-09-05T15:30:00.000Z`, calculé par `nextOccurrence`, pas à la main).
Écriture atomique, avec une garde qui refusait d'écrire si l'état sur disque
n'était pas exactement celui analysé. `lastCompletedOccurrenceAt` laissé tel
quel (2026-08-29) — deviner qu'Aramis a fait les occurrences du 30/08 et du
04/09 aurait été inventer. Confirmé : la série est de retour dans
`/api/agenda?date=2026-09-05`.

## Decisions

1. **Le calendrier gagne, y compris par occurrence** — la décision du 18/08 ne
   changeait pas, elle n'était simplement pas appliquée au *choix du jour*.
   C'est désormais le cas dans les trois copies (agenda items, agenda snapshot,
   digest).
2. **PR ouverte, pas de déploiement** — arbitrage d'Aramis, projet en pause.
3. **Réparer la donnée « Reposter 15 »** plutôt que la laisser ou la supprimer
   — arbitrage d'Aramis.

## Blockers

Aucun sur le code. Deux limites de cette session :

- **Aucune capture d'écran authentifiée.** L'app exige une session Supabase ;
  les cookies ne sont pas dans le Chrome du Mac (Aramis utilise la PWA). La
  preuve visuelle livrée est un comparatif reconstruit sur ses données réelles,
  pas une capture de l'app. Le blocage de recette d'écran authentifié dure
  depuis six sessions.
- **`npm run build` non lancé** — un `next dev` tourne, la règle du repo
  l'interdit.

## Next action

**Déployer la PR #16** quand Aramis le voudra. Rien ne l'impose : le correctif
ne touche ni les données ni la synchro, seulement l'affichage. Sur le VPS
(`ssh -i ~/.ssh/brief_vps root@186.241.16.37`, `/docker/brief`) :

```bash
bash deploy/backup.sh
git pull
docker compose --env-file .env.production build
docker compose --env-file .env.production up -d
```

⚠️ `--env-file .env.production` n'est pas facultatif : sans lui, **toute**
commande `docker compose` échoue sur l'interpolation (constaté aujourd'hui,
`docker compose ps` compris — utiliser `docker logs brief-app-1` en attendant).

Ensuite, dans l'ordre de ce qui reste : recette des écrans authentifiés, puis
lots 2 et 3 du pivot multi-utilisateur.

## Validations

Lancées sur l'arbre final, sortie vue :

```
$ npx eslint .       → 0 erreur, 0 warning
$ npx tsc --noEmit   → 0 erreur
$ npx vitest run     → 597 passants, 1 skipped (47 fichiers)
```

**NON LANCÉ — à ne pas croire fait :**

- **`npm run build`** (un `next dev` tourne — règle du repo). `tsc --noEmit`
  n'en tient pas lieu : il ne prouve pas que la sortie standalone se construit.
- **Le correctif n'a PAS tourné en production.** Il est vérifié sur les données
  de prod, rejouées **en local**. Ce n'est pas la même chose que la prod.
- **Aucune recette d'écran authentifié** (voir Blockers).
- `readSyncState`, `recordDeletedExternalUid`, `readAgendaSnapshot`,
  `runCalDavSync`, `runReminders`, `sendPush` n'ont toujours **aucun test
  unitaire direct**. Inchangé.
