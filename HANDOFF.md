# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui que
tu remplaces dans `docs/handoffs/`.

> **Multi-agents** : si tu n'es pas l'agent qui a écrit la dernière passation,
> tu reprends la main explicitement (nouvelle entrée). Lis aussi
> [`docs/coordination.md`](docs/coordination.md) — les copies du dépôt, la
> branche de prod, les règles anti-collision.

---

# Passation — 2026-08-19 · DTSTART mobile des séries récurrentes corrigé

| | |
|---|---|
| **Agent** | Claude Code (Sonnet 5) |
| **Branche** | `feat/ui-redesign-claude` — **la branche que sert le VPS** |
| **Commits** | `445e4a5` (ancre stable pour les séries récurrentes) |
| **Prod** | https://brief.srv1899780.hstgr.cloud — déployée, `brief-app-1 Healthy`, aucune erreur en logs post-déploiement |

## Goal — l'objectif

Aramis a signalé deux symptômes le même soir : « Aller courir » apparaît deux
fois aujourd'hui dans Brief, et le vrai calendrier Apple n'a plus de
« Reposter »/« Poster » pour aujourd'hui alors que les jours suivants les ont.
Trouver la cause racine et corriger — pas les symptômes séparément.

## Current state — ce qui a été fait

**Root cause confirmée sur données prod réelles** (SSH `~/.ssh/brief_vps`,
`items.json`, `caldav-agenda-snapshot.json`, `docker logs`, comparés à une
capture de l'app Calendrier macOS) : `buildEventIcs` écrivait `due` comme
DTSTART pour toute série récurrente. `due` avance à chaque rappel envoyé
(`reminders.ts`). En RFC 5545 aucune occurrence n'existe avant DTSTART — donc
dès qu'un rappel du jour partait, le prochain PUT effaçait l'occurrence du
jour du vrai calendrier. Brief lui-même masquait ça en interne (`agenda.ts`
reconstruit les occurrences passées d'une série), ce qui produisait un
fantôme entrant en collision avec un second événement bien réel qu'Aramis
avait ajouté à la main dans Calendrier — d'où le doublon « Aller courir ».

**Fix (TDD — tests écrits et vus rouges avant le code)** : nouveau champ
`Item.seriesAnchor`, un DTSTART figé une fois (premier PUT réussi, ou édition
calendrier adoptée) et plus jamais avancé. `buildEventIcs`/`canonicalDueField`
s'ancrent dessus pour une série, jamais sur `due`.

**Déployé et migré** : commit poussé, prod sauvegardée puis redéployée et
vérifiée saine. Migration one-shot (script Node exécuté dans le conteneur,
non commité) sur les items récurrents déjà en prod : **7**, pas 5 comme prévu
au départ — « Séance push » et « Séance pull » avaient le même bug, découvertes
en filtrant les items réels plutôt qu'en supposant la liste.

**Ce qui n'a PAS été fait / ne peut pas l'être** :
- Le doublon « Aller courir » d'AUJOURD'HUI reste visible dans Brief — ce sont
  deux entrées réellement distinctes sur le calendrier d'Aramis (le créneau
  récurrent de 16h + celui qu'il a ajouté à la main à 17h30), rien ne permet
  de les fusionner programmatiquement. Accepté explicitement par Aramis avant
  le fix (voir Decisions).
- Les occurrences déjà effacées aujourd'hui (Reposter/Poster) ne reviennent
  pas rétroactivement — c'est de l'historique perdu, pas un état à corriger.
  À partir de demain les 7 séries migrées se comportent normalement.
- **Le mécanisme EXACT de la dérive initiale (Wed 19→Sam 22 en moins de 30h
  pour « Aller courir ») reste non expliqué.** Les logs Docker ne remontent
  qu'au dernier redéploiement (18:49 UTC aujourd'hui) — les passages
  antérieurs sont perdus. Plus troublant : la suite de tests EXISTANTE
  (`caldav.test.ts`, avant ce fix) affirme explicitement que ce scénario
  précis doit produire un `skip` (aucun PUT). Le fix retire la dépendance à
  `due` quel que soit ce mécanisme, donc n'en dépend pas — mais si un autre
  item dérive à nouveau après ce fix, ça vaut la peine de creuser ce point
  plutôt que de le supposer résolu par ricochet.

## Decisions — choix critiques ou irréversibles

- **Pas de fusion du doublon « Aller courir » d'aujourd'hui.** Proposé et
  explicitement accepté par Aramis avant de coder (question posée, réponse
  « Fix complet » choisie en connaissance de cause) : ce sont deux événements
  calendrier réels et distincts, aucun signal fiable ne permet de les traiter
  comme un seul sans heuristique fragile.
- **`postPutPatch` extrait en fonction pure exportée** (`caldav.ts`), sortie
  de la boucle `runCalDavSync`, spécifiquement pour rendre testable sans
  réseau le « figer l'ancre au premier PUT » — même logique que pourquoi
  `decideSync`/`calendarPatch` sont déjà des fonctions pures séparées.
- **Migration des items existants faite par script one-shot, pas par code
  applicatif.** `seriesAnchor` ne se rétro-invente pas depuis `due` déjà
  avancé sans action explicite — laisser le code applicatif le déduire tout
  seul aurait pu figer une mauvaise valeur silencieusement.

## Changed — fichiers et composants

| Fichier | Nature |
|---|---|
| `src/lib/types.ts` | `Item.seriesAnchor` (nouveau champ) |
| `src/lib/caldav.ts` | `buildEventIcs`/`canonicalDueField` ancrés sur `seriesAnchor` pour une série ; `calendarPatch` pose `seriesAnchor` sur édition adoptée ; nouveau `postPutPatch` exporté (extrait de la boucle Phase 2) |
| `src/lib/caldav.test.ts` | 8 tests neufs (ancre stable, fallback `due`, item non récurrent, `postPutPatch`) + 1 test préexistant mis à jour (attend désormais `seriesAnchor` dans le patch adopté) |
| `items.json` (prod, VPS, hors git) | 7 items récurrents migrés (`seriesAnchor` = `due` figé) — script non commité, exécuté puis supprimé du conteneur |

## Validations — passants / échoués / non lancés

| Commande | Résultat |
|---|---|
| `npx vitest run` | ✅ **185 passed \| 1 skipped** (186) — 8 nouveaux tests cette session |
| `npx tsc --noEmit` | ✅ propre |
| `npx eslint .` | ✅ 23 problèmes, tous préexistants (mêmes qu'avant cette session) |
| Déploiement VPS | ✅ `git rev-parse HEAD` = `445e4a5` côté VPS, `brief-app-1 Healthy` |
| Logs post-déploiement | ✅ aucune erreur (`docker logs --since 5m \| grep -iE "error\|exception"` → vide) |
| Migration prod | ✅ 7/7 items migrés, vérifié par relecture d'`items.json` après écriture |

Non vérifié : le comportement du prochain passage CalDAV réel sur les 7 items
migrés (devrait rester `put=0` pour eux, sauf vraie édition manuelle
d'Aramis) — pas observé en direct, juste attendu par construction du fix.

## Blockers — ce qui bloque

Rien.

## Next — la prochaine action

Observer un ou deux passages de sync naturels sur les items migrés :
`docker logs brief-app-1 | grep caldav` — `put` doit rester à 0 pour ces 7
séries sauf édition manuelle réelle d'Aramis dans Calendrier. Un `put` non nul
sur l'un d'eux signalerait que `seriesAnchor` ne tient pas comme prévu, à
creuser immédiatement — et ce serait aussi l'occasion de comprendre enfin le
mécanisme de dérive initiale resté non expliqué (voir Current state).

---

## Historique des passations

| Date | Sujet | Agent | Fiche |
|---|---|---|---|
| **2026-08-19** | **DTSTART mobile des séries récurrentes corrigé** | **Claude Code** | *(cette passation)* |
| 2026-08-19 | Rendez-vous reconstruite + adoption calendrier externe | Claude Code | [fiche](docs/handoffs/2026-08-19-rendezvous-reconstruite-adoption-calendrier.md) |
| 2026-08-19 | Crash CalDAV corrigé + coordination mergée | Hermes Agent | [fiche](docs/handoffs/2026-08-19-crash-caldav-corrige-coordination.md) |
| 2026-08-19 | Bug de prod : DTSTART flottant (cause, fix, leçons) | Hermes Agent | [fiche](docs/handoffs/2026-08-19-caldav-floating-dtstart.md) |
| 2026-08-19 | Refonte UI Claude Design (en cours) | Hermes Agent | [fiche](docs/handoffs/2026-08-19-refonte-ui-claude-design.md) |
| 2026-08-19 | CalDAV priorité + bugs UI | Hermes Agent | [fiche](docs/handoffs/2026-08-19-caldav-priorite-et-bugs-ui.md) |
| 2026-08-18 | Cookie PIN posé par le serveur (Set-Cookie) | Hermes Agent | [fiche](docs/handoffs/2026-08-18-pin-cookie.md) |
| 2026-08-18 | Suppressions d'occurrences adoptées (EXDATE) + ancre de série | Hermes Agent | [fiche](docs/handoffs/2026-08-18-exdate-adoption.md) |
| 2026-08-18 | PIN mémorisé fiabilisé (cookie + localStorage) | Hermes Agent | [fiche](docs/handoffs/2026-08-18-pin-cookie.md) |
| 2026-08-18 | Récurrences de publication bornées fin août | Hermes Agent | [fiche](docs/handoffs/2026-08-18-recurrences-bornees.md) |
| 2026-08-18 | Calendrier = source de vérité + semaine récurrente | Hermes Agent | [fiche](docs/handoffs/2026-08-18-caldav-source-de-verite.md) |
| 2026-08-18 | CalDAV multi-calendriers déployé + routage vérifié | Hermes Agent | [fiche](docs/handoffs/2026-08-18-caldav-multicalendriers-deploye.md) |
| 2026-08-18 | CalDAV multi-calendriers (un calendrier par projet) — implémenté, à déployer | Hermes Agent | [fiche](docs/handoffs/2026-08-18-caldav-multicalendriers.md) |
| 2026-08-17 | PIN mémoire + synchro CalDAV Apple | Hermes Agent | [fiche](docs/handoffs/2026-08-17-pin-memoire-et-caldav-apple.md) |
| 2026-08-16 | Audit complet et refonte produit | Claude Code | [fiche](docs/handoffs/2026-08-16-audit-complet-et-refonte-produit.md) |
| 2026-08-15 | Workflow Telegram et n8n | Hermes Agent | [fiche](docs/handoffs/2026-08-15-workflow-telegram-n8n.md) |
| 2026-08-14 | Déploiement prod + correctif projets invisibles | Hermes Agent | [fiche](docs/handoffs/2026-08-14-deploiement-et-correctif-projets.md) |
| 2026-08-13 | En ligne, en TLS, et le Web Push sonne | Claude Code | [fiche](docs/handoffs/2026-08-13-vps-tls-et-web-push-prouve.md) |
| 2026-08-11 | Projets gérés depuis Réglages | Claude Code | [fiche](docs/handoffs/2026-08-11-projets-en-reglages.md) |
| 2026-08-10 | Le pivot : Brief possède ses données | Claude Code | [fiche](docs/handoffs/2026-08-10-pivot-organiseur-autonome.md) |
| 2026-08-07 | Chaîne dictée → Todoist, et PWA | Claude Code | [fiche](docs/handoffs/2026-08-07-chaine-complete-et-pwa.md) |
| 2026-08-06 | Scaffold, UI, garde PIN et micro | Claude Code | [fiche](docs/handoffs/2026-08-06-scaffold-ui-et-garde-pin.md) |
