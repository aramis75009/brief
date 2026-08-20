# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui que
tu remplaces dans `docs/handoffs/`.

> **Multi-agents** : si tu n'es pas l'agent qui a écrit la dernière passation,
> tu reprends la main explicitement (nouvelle entrée). Lis aussi
> [`docs/coordination.md`](docs/coordination.md) — les copies du dépôt, la
> branche de prod, les règles anti-collision.

---

# Passation — 2026-08-20 (soir) · Occurrence cochée vs `due` avancé par le cron : deux notions distinctes

| | |
|---|---|
| **Agent** | Claude Code (Sonnet 5) |
| **Branche** | `feat/ui-redesign-claude` — **la branche que sert le VPS** |
| **Commits** | `8b293c8` → `6bc287a` (voir Changed) — tous déployés |
| **Prod** | https://brief.srv1899780.hstgr.cloud — `brief-app-1 Healthy`, vérifiée en navigateur avec le vrai compte, état final confirmé correct |

## Goal — l'objectif

Corriger le bug « Séance push » (un rendez-vous récurrent coché restait
visible dans Rendez-vous) sans réintroduire l'ancien bug qu'un fix précédent
(19/08, `seriesAnchor`) avait déjà réglé une fois : des tâches récurrentes qui
disparaissent du jour dès que leur rappel sonne, qu'elles soient faites ou non.

## Current state — ce qui a été fait

**Le fix a pris trois passes dans la même session — la deuxième et la
troisième corrigent des régressions causées par la précédente, détectées par
Aramis en usage réel entre chaque déploiement.** Détail utile pour la
prochaine fois que `buildDayAgenda`/récurrences est touché :

**Passe 1 (`8b293c8`)** : hypothèse initiale — toute occurrence calendrier
antérieure au `due` courant de l'item lié est « déjà avancée, donc déjà
traitée », on la cache. Corrige bien Séance push. **Cassé sans le savoir** :
`due` n'avance pas QUE sur une coche. `reminders.ts` l'avance AUSSI après
CHAQUE envoi de rappel, fait ou non (« les récurrences avancent », son propre
commentaire de tête de fichier) — c'est une planification du PROCHAIN rappel,
pas un signal de complétion. Les deux mécanismes produisent un état identique
(`due` avancé, `doneAt` toujours `null`) : rien dans les données ne permettait
de les distinguer.

**Rapporté par Aramis immédiatement après déploiement** : « Reposter 10
articles » et « Poster 10 articles » (tâches quotidiennes Frip & Trend, pas
encore faites, rappel du soir déjà sonné) avaient disparu du jour.

**Passe 2 (`797600b`)** : root cause correcte. Nouveau champ
`Item.lastCompletedOccurrenceAt`, posé **uniquement** par `completionPatch`
(jamais par le cron) sur l'ancien `due` au moment de la coche.
`buildDayAgenda` ne cache plus qu'une occurrence dont l'instant correspond
EXACTEMENT à ce champ — comparaison ponctuelle, plus un seuil sur `due`.
12 tests concernés relus et corrigés (3 fixtures qui contournaient l'ancien
filtre trop large sont revenues à leur valeur d'origine ; 2 tests neufs).

**Passe 3 (`6bc287a`)** : bug trouvé **avant** de committer, en préparant le
rattrapage des données de prod (Séance push avait été coché AVANT que ce
champ existe — sa donnée devait être rattrapée à la main). L'occurrence du
jour de Séance push porte un **override CalDAV** (décalée 16:00→17:00, adopté
depuis l'app Calendrier). `item.due` au moment de la coche reflétait donc
l'heure EFFECTIVE (17:00), mais le filtre comparait à `occ`, l'heure BRUTE de
la RRULE (16:00) — jamais de correspondance. Déplacé la comparaison après
`applyOverride`.

**Rattrapage de donnée de prod** (pas un déploiement de code) : `Item
lastCompletedOccurrenceAt` de Séance push (`it_1787064245370_push`) n'existait
pas — coché avant que le champ ne soit inventé. Patché à la main sur le volume
(`docker exec brief-app-1 node -e "..."`, écriture atomique temp+rename,
même schéma que `store.ts`) à `2026-08-20T15:00:00.000Z` (17:00 Paris, l'heure
effective post-override). Aucune autre donnée touchée.

**Vérifié visuellement en prod, état final, sur les vraies données**
(`/browse` + PIN) : `Tâches 4 aujourd'hui` (Ranger appartement, Reposter 10
articles, Poster 10 articles, Tourner les photos), `Rendez-vous 0 aujourd'hui`
(Séance push masquée). Capture dans la conversation, pas archivée dans le
dépôt.

**Dans la même session, avant cet incident** : icône PWA implémentée
(`BriefIcon.dc.html`, variante B) et `DESIGN.md` restauré avec un contenu
correct fourni par Aramis — voir
[`docs/handoffs/2026-08-20-phantom-occurrence-icone-design-restaure.md`](docs/handoffs/2026-08-20-phantom-occurrence-icone-design-restaure.md)
pour le détail (non re-décrit ici, rien n'a changé sur ces deux points).

## Decisions — choix critiques ou irréversibles

- **`due` avancé ≠ occurrence faite.** Deux mécanismes distincts avancent
  `due` de façon identique (coche utilisateur, cron des rappels après envoi).
  Toute future logique qui a besoin de savoir « cette occurrence est-elle
  faite » doit passer par `lastCompletedOccurrenceAt`, jamais par une
  comparaison à `due`. Ne pas re-débattre — deux régressions prod l'ont déjà
  coûté cette session.
- **Comparer une occurrence à une donnée posée par une coche doit toujours se
  faire après `applyOverride`** (heure effective), jamais sur l'occurrence
  brute de la RRULE — `item.due` lui-même est déjà post-override dès que la
  synchro CalDAV a adopté un décalage.

## Changed — fichiers et composants

| Fichier | Nature |
|---|---|
| `src/lib/types.ts` | `Item.lastCompletedOccurrenceAt?: string \| null` (nouveau) |
| `src/lib/completion.ts` | `completionPatch` pose ce champ sur l'outcome `advanced` |
| `src/lib/agenda.ts` | `buildDayAgenda` : filtre par correspondance exacte sur ce champ (post-override), plus par seuil sur `due` |
| `src/lib/agenda.test.ts` | fixtures restaurées à leurs valeurs d'origine + 3 tests neufs (coche simple, coche avec override, cron sans coche) |
| Volume `brief-data` (prod) | `lastCompletedOccurrenceAt` rattrapé à la main sur un seul item (Séance push) — donnée, pas code |

## Validations — passants / échoués / non lancés

| Commande | Résultat |
|---|---|
| `npx vitest run` | ✅ **241 passed \| 1 skipped** (242) — état final, après les 3 passes |
| `npx tsc --noEmit` | ✅ propre |
| `npx eslint .` | ✅ 23 problèmes — baseline inchangée |
| `/browse` prod + PIN réel, état final | ✅ `Tâches 4 aujourd'hui`, `Rendez-vous 0 aujourd'hui` — capture visuelle confirmée |
| Déploiement VPS (3 passes) | ✅ `git rev-parse HEAD` = `6bc287a` côté VPS, `brief-app-1 Healthy` à chaque passe |
| Backup avant chaque déploiement | ✅ `20260820-174529`, `20260820-180203`, `20260820-180535` |
| **Icône réellement visible sur l'écran d'accueil iOS** | **Toujours non vérifié** (hérité de la passation précédente — iOS ne recharge pas l'icône d'une PWA installée) |

## Blockers — ce qui bloque

Rien. Prod saine, tout déployé et vérifié sur les vraies données.

## Next — la prochaine action

1. **Vérifier l'icône sur l'iPhone d'Aramis** (report de la passation
   précédente, toujours en attente) — réinstall d'écran d'accueil nécessaire.
2. **Si un autre item récurrent avec override se révèle « collé » un jour**
   (montré alors qu'il a été coché) : suspecter en premier une donnée
   historique sans `lastCompletedOccurrenceAt` (comme Séance push avant ce
   rattrapage), pas un nouveau bug de `buildDayAgenda`.
3. Le chantier annoncé par Aramis reste en attente (`TODOS.md`, P2) :
   stocker les enregistrements vocaux bruts.

---

## Historique des passations

| Date | Sujet | Agent | Fiche |
|---|---|---|---|
| **2026-08-20 (soir)** | **Occurrence cochée vs `due` avancé par le cron : deux notions distinctes** | **Claude Code** | *(cette passation)* |
| 2026-08-20 (après-midi) | Séance push corrigée (v1, régressé) + icône PWA + DESIGN.md restauré | Claude Code | [fiche](docs/handoffs/2026-08-20-phantom-occurrence-icone-design-restaure.md) |
| 2026-08-20 (jour) | Accès agents aux tâches/RDV + query token claude.ai | Hermes Agent | [fiche](docs/handoffs/2026-08-20-acces-agents-query-token.md) |
| 2026-08-20 (nuit) | Occurrences décalées adoptées (RECURRENCE-ID) + terrain préparé | Hermes Agent | [fiche](docs/handoffs/2026-08-20-occurrences-decalees-adoptees.md) |
| 2026-08-19 (fin de soirée) | Deux correctifs d'affichage + terrain préparé | Claude Code | [fiche](docs/handoffs/2026-08-19-deux-correctifs-affichage-terrain-prepare.md) |
| 2026-08-19 (soir) | Calendrier intouché + fin des occurrences fantômes | Claude Code | [fiche](docs/handoffs/2026-08-19-calendrier-intouche-occurrences-fantomes.md) |
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
