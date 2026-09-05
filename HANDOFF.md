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
| **Branche** | `docs/passation-v1210-deployee`. Le chantier, `fix/agenda-occurrences-decalees`, est **fusionné** ([PR #16](https://github.com/aramis75009/brief/pull/16)). |
| **Base** | `main` @ `7979624`. |
| **GitHub** | `origin/main` = **`3a1ea3e`**, v1.2.1.0. |
| **Prod** | **`3a1ea3e`, v1.2.1.0, déployée le 05/09** — vérifié en SSH (SHA + `/app/VERSION` + capture d'écran). Le lot 1 multi-utilisateur avait été déployé entre le 01/09 et aujourd'hui : la passation précédente disait « pas déployé », c'était périmé. |

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

**Correctif livré, déployé et vérifié en production.** v1.2.1.0.

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
2. **Déployé après tout** — Aramis a rouvert la question en fin de session.
   Passé par le webhook Hermes, pas par un SSH direct : `.claude/commands/deploy.md`
   l'interdit explicitement, et la règle tient même quand on a la clé.
   ⚠️ **Hermes a d'abord échoué en silence** sur `cd /docker/brief` — ce chemin
   n'existe pas dans son conteneur, et il n'a pas réessayé. Le `202` du webhook
   était déjà parti. Corrigé en lui donnant la commande SSH vers l'hôte dans le
   message de la demande (sa clé y est autorisée) : réussi du premier coup.
   Détails et commande exacte dans la mémoire projet `hermes-deploie-par-ssh-pas-cd`.
3. **Réparer la donnée « Reposter 15 »** plutôt que la laisser ou la supprimer
   — arbitrage d'Aramis.

## Blockers

Aucun sur le code.

### ✅ Le blocage de recette authentifiée est LEVÉ — il n'aurait jamais dû durer

Six passations ont répété « aucune recette d'écran authentifié possible ».
**C'était faux depuis le 01/09** : Aramis avait fait créer un compte Supabase
d'agent exactement pour ça. Il a fallu qu'il le dise pour que je le trouve.

Deux causes, toutes deux traitées :

1. **`docs/agent-recette-account.md` n'est PAS dans `main`.** Il vit sur la
   branche `docs/agent-recette-account`, jamais fusionnée. Aucun agent lisant
   `main`, `AGENTS.md` ou `HANDOFF.md` ne peut le trouver.
   **→ à fusionner : c'est la cause racine, et elle est toujours ouverte.**
2. **Les identifiants n'étaient que dans le repo Hermes du VPS.** Ils sont
   désormais aussi dans le `.env.local` du Mac (`BRIEF_AGENT_EMAIL`,
   `BRIEF_AGENT_PASSWORD`, `BRIEF_AGENT_USER_ID`). Repo public : jamais commis.

Connexion vérifiée le 05/09 **sur la prod et en local**, captures à l'appui.
Deux pièges qui font croire à un échec : `snapshot -i` ne voit rien tant que
React n'a pas hydraté (attendre `input[type="email"]`), et le POST répond 200
**sans** que l'écran bascule — il faut **recharger**.

Le compte agent a **son propre store** (`41c52c5b-…`), invisible depuis celui
d'Aramis. Pour prouver un rendu qui dépend des données d'Aramis : rejouer le cas
dans le store du compte agent. C'est ainsi qu'a été produit l'avant/après du
bug. **Un item de démonstration y reste** — `it_demo_push`, « Séance push »
lun/jeu avec l'occurrence du jeudi 3 déplacée au vendredi 4 : il rejoue le bug
en un coup d'œil, et servira à vérifier le déploiement. À supprimer quand il
n'a plus d'usage.

### Reste

- **`npm run build` non lancé** — un `next dev` tourne, la règle du repo
  l'interdit.

## Next action

Rien d'urgent — le projet reste en pause. Ce qui attend :

1. **Fusionner `docs/agent-recette-account` dans `main`** (commit `f1cf421`,
   aucune PR). Tant que ce fichier reste sur sa branche, chaque agent
   redécouvre à ses frais que la recette authentifiée serait impossible — elle
   ne l'est pas. C'est la cause racine de six passations qui l'ont affirmé.
2. **La cause qui a effacé la `rrule` de « Reposter 15 articles »** n'est pas
   identifiée (`TODOS.md`, section Dette connue).
3. **Le pont WhatsApp d'Hermes est mort en boucle** (`[Whatsapp] Bridge process
   died (exit code 1)`, des centaines de lignes). Sans rapport avec Brief, mais
   son journal en est noyé : filtrer avant de chercher quoi que ce soit dedans.
4. Lots 2 et 3 du pivot multi-utilisateur.

**Nettoyage en attente** : `it_demo_push` dans le store du compte agent — il
rejoue le bug en un coup d'œil et a servi à valider le déploiement. À supprimer
quand il n'a plus d'usage.

## Validations

Lancées sur l'arbre final, sortie vue :

```
$ npx eslint .       → 0 erreur, 0 warning
$ npx tsc --noEmit   → 0 erreur
$ npx vitest run     → 597 passants, 1 skipped (47 fichiers)
```

**Vérifié EN PRODUCTION** après déploiement, sur les données réelles d'Aramis :

```
/api/agenda?date=2026-09-03 → (vide)                      ← rendait « Séance push » datée du 4
/api/agenda?date=2026-09-04 → Séance push 14:00Z, …       ← était absente
/api/agenda?date=2026-09-06 → Aller courir 14:00Z, …      ← était VIDE
```

Et à l'écran, connecté avec le compte agent : « Séance push » est passée du
jeudi 3 au vendredi 4. `docker exec brief-app-1 cat /app/VERSION` → `1.2.1.0`.

**NON LANCÉ — à ne pas croire fait :**

- **`npm run build` en local** (un `next dev` tourne — règle du repo). Le build
  de production a en revanche bien tourné sur le VPS pendant le déploiement.
- `readSyncState`, `recordDeletedExternalUid`, `readAgendaSnapshot`,
  `runCalDavSync`, `runReminders`, `sendPush` n'ont toujours **aucun test
  unitaire direct**. Inchangé.
