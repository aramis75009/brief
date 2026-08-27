# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui que
tu remplaces dans `docs/handoffs/`.

> **Multi-agents** : si tu n'es pas l'agent qui a écrit la dernière passation,
> tu reprends la main explicitement (nouvelle entrée). Lis aussi
> [`docs/coordination.md`](docs/coordination.md) — les copies du dépôt, la
> branche de prod, les règles anti-collision.

---

# Passation — 2026-08-19 (soir) · Calendrier intouché + fin des occurrences fantômes

| | |
|---|---|
| **Agent** | Claude Code (Sonnet 5) |
| **Branche** | `feat/ui-redesign-claude` — **la branche que sert le VPS** |
| **Commits** | `b3ea8d7` — déployé |
| **Prod** | https://brief.srv1899780.hstgr.cloud — `brief-app-1 Healthy`, vérifiée saine post-déploiement |

## Goal — l'objectif

Deux signalements d'Aramis le même soir, avec captures à l'appui (accueil
Brief vs vraie app Calendrier macOS) : (1) « le premier truc que j'ouvre sur
l'app, c'est des mauvaises tâches, contrairement à mon calendrier » ; (2) en
voyant que « Aller courir » a disparu de son calendrier après avoir été
complété dans Brief : « je veux toujours que le calendrier reste intouché »,
Brief peut ajouter, jamais supprimer.

## Current state — ce qui a été fait

**Root cause du (1), confirmée sur `items.json` de PROD (lu en SSH) :**
trois items récurrents migrés lors de la session précédente (fix DTSTART,
`Item.seriesAnchor`) avaient un `due` qui traînait encore quelques jours en
arrière de leur `seriesAnchor` (le DTSTART réellement écrit sur iCloud) —
Poster/Reposter 10 articles (ancre jeu. 20), Aller courir (ancre sam. 22).
Par construction RFC 5545, aucune occurrence n'existe avant DTSTART : ces
occurrences « d'aujourd'hui » n'ont donc **jamais existé sur le vrai
calendrier** — confirmé visuellement sur la capture macOS d'Aramis, rien
sous mercredi 19 pour ces trois titres. Brief a quand même sonné pour elles
(`remindedAt` correspondant à l'heure du jour même) et les a affichées comme
« Aujourd'hui », jusqu'à ce qu'un rattrapage jour par jour (plusieurs heures,
plusieurs faux rappels) les recale tout seul — observé en direct pendant
l'investigation.

**Fix** : `pendingReminders()` (`src/lib/reminders.ts`) gagne un troisième
compartiment `beforeAnchor` — une échéance `due < seriesAnchor` n'est ni
`ready` (pas de push) ni `stale` (pas ignorée) : `due` est réécrit
directement sur `seriesAnchor` par `runReminders`, sans notification, dès le
passage suivant (≤ 60 s) au lieu d'un rattrapage de plusieurs heures.

**Root cause du (2)** : trois chemins de suppression dans
`runCalDavSync`/`decideExternalSync` (`src/lib/caldav.ts`) — nettoyage Phase 1
des `brief-*` orphelins, suppression de l'événement adopté quand l'item
correspondant est coché, suppression de l'événement tombstoné. **Preuve
trouvée en investiguant, pas hypothétique** : l'item adopté « Aller courir »
(calendrier Sport, `externalUid` réel posé par Aramis lui-même) avait
`doneAt` posé ce soir — sous l'ancien code, le passage CalDAV suivant allait
supprimer l'événement réel de son calendrier. C'est l'incident concret qui a
motivé le fix, pas une préférence abstraite.

**Fix** : les trois chemins renvoient désormais `noop`. Le type
`"delete-remote"` et la fonction `deleteEvent` sont retirés du fichier — plus
aucun appelant. Le tombstone garde son rôle (empêcher la ré-adoption comme
nouvel item), il n'entraîne simplement plus de suppression distante.

**Compromis accepté et documenté, pas caché** : un item dont le PROJET
change échoue désormais son PUT vers le nouveau calendrier (iCloud renvoie
412, le même UID existant encore dans l'ancien) au lieu d'être déplacé
proprement. Piste pour une session future : la méthode CalDAV `MOVE`
relocalise sans jamais supprimer — pas implémentée ce soir, hors périmètre
de l'urgence.

## Decisions — choix critiques ou irréversibles

Deux nouvelles entrées dans `DECISIONS.md` (2026-08-19 soir) :
- **Le calendrier Apple reste intouché** — renverse la partie suppression de
  l'entrée « adoption totale » du même jour ; l'adoption elle-même tient
  toujours.
- **Une occurrence antérieure à `seriesAnchor` ne sonne jamais.**

Voir `DECISIONS.md` pour le POURQUOI complet de chacune — ne pas re-débattre.

## Changed — fichiers et composants

| Fichier | Nature |
|---|---|
| `src/lib/reminders.ts` + `.test.ts` | `pendingReminders` : compartiment `beforeAnchor`, rattrapage silencieux sur `seriesAnchor` ; `ReminderRun.correctedToAnchor` ; 3 tests neufs |
| `src/app/api/cron/reminders/route.ts` | log inclut `correctedToAnchor` |
| `src/lib/caldav.ts` + `.test.ts` | suppression de `deleteEvent`, du type `"delete-remote"`, de la boucle de nettoyage Phase 1, du handler Phase 3 correspondant ; `decideExternalSync` renvoie `noop` dans les deux cas qui supprimaient avant ; docblocks mis à jour ; 2 tests modifiés |
| `DECISIONS.md` | 2 nouvelles entrées (voir ci-dessus) |

## Validations — passants / échoués / non lancés

| Commande | Résultat |
|---|---|
| `npx vitest run` | ✅ **218 passed \| 1 skipped** (219) — 5 tests neufs/modifiés |
| `npx tsc --noEmit` | ✅ propre |
| `npx eslint .` | ✅ 23 problèmes — identiques à la baseline |
| Déploiement VPS | ✅ `git rev-parse HEAD` = `b3ea8d7` côté VPS, `brief-app-1 Healthy` |
| Backup avant déploiement | ✅ `[backup] ok 20260819-214439` |

**Vérification post-déploiement — confirmée, mauvaise nouvelle partielle.**
Un passage `runCalDavSync` réel s'était produit à 21:36:28 UTC — **avant**
le déploiement du fix (21:44) — avec l'ANCIEN code, sur l'item adopté déjà
`doneAt` depuis 20:18:57 UTC. Attendu le premier passage tournant avec le
code corrigé (21:51:41 UTC, confirmé par le nouveau `lastSyncAt` dans
`caldav-last-sync.json`) puis relu l'instantané agenda frais côté VPS :
**l'événement réel « Aller courir » (calendrier Sport, UID
`30DC2273-382D-4C51-A8B3-B0BDCD37AD48`) n'existe plus sur iCloud.** Le
calendrier Sport ne contient plus que les 3 séries `brief-*` (Séance push,
Séance pull, Aller courir récurrent). La suppression a eu lieu au passage de
21:36:28, avant que le fix ne puisse l'empêcher — **le fix arrête toute
suppression FUTURE, il ne pouvait pas annuler celle-ci.** Brief ne peut pas
recréer cet événement lui-même (ce n'est pas un item `brief-*`, Brief n'a
plus d'écriture qui lui appartienne pour cet UID) — **dit à Aramis dans la
réponse de cette session**, avec les détails connus pour qu'il le recrée à
la main s'il le souhaite : « Aller courir », calendrier Sport, était à
17:30 heure de Paris (`due` 15:30 UTC), durée 60 min.

## Blockers — ce qui bloque

Rien pour le code, déployé, sain, et vérifié empêcher toute suppression
future. **Un fait à assumer, pas un blocage technique** : l'événement
« Aller courir » d'Aramis a été réellement supprimé avant le déploiement du
fix — communiqué, pas silencieux.

## Next — la prochaine action

1. Rien de plus côté code cette session — les deux fixes sont déployés et
   vérifiés (voir Validations).
2. Si Aramis veut récupérer « Aller courir » dans son calendrier, c'est à
   lui de le recréer à la main dans l'app Calendrier (Sport, 17h30, 60 min) —
   Brief ne peut pas le faire à sa place sans en faire un item `brief-*`
   distinct.
3. Garder un œil sur les logs `brief-cron-1` (`correctedToAnchor` dans les
   logs de rappels) au cas où d'autres items auraient un `due` encore
   antérieur à leur `seriesAnchor` — devrait se résorber tout seul, sans
   notification, en un passage.

---

## Historique des passations

| Date | Sujet | Agent | Fiche |
|---|---|---|---|
| **2026-08-19 (soir)** | **Calendrier intouché + fin des occurrences fantômes** | **Claude Code** | *(cette passation)* |
| 2026-08-19 | Types explicites, édition complète, accueil↔Rendez-vous unifiés | Claude Code | [fiche](docs/handoffs/2026-08-19-types-edition-agenda-unifie.md) |
| 2026-08-19 | DTSTART mobile des séries récurrentes corrigé | Claude Code | [fiche](docs/handoffs/2026-08-19-dtstart-mobile-series-recurrentes.md) |
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
