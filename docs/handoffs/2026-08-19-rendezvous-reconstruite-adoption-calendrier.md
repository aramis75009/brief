# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui que
tu remplaces dans `docs/handoffs/`.

> **Multi-agents** : si tu n'es pas l'agent qui a écrit la dernière passation,
> tu reprends la main explicitement (nouvelle entrée). Lis aussi
> [`docs/coordination.md`](docs/coordination.md) — les copies du dépôt, la
> branche de prod, les règles anti-collision.

---

# Passation — 2026-08-19 · Rendez-vous reconstruite + adoption calendrier externe

| | |
|---|---|
| **Agent** | Claude Code (Sonnet 5) |
| **Branche** | `feat/ui-redesign-claude` — **la branche que sert le VPS** |
| **Commits** | `6a8d2c7` (réconciliation CalDAV + tri) · `a3ab3ac` (merge avec le fix DTSTART de Hermes) · `64060c7` (vue Rendez-vous + adoption externe) · `6ee2052` (fix incident : fenêtre temporelle) |
| **Prod** | https://brief.srv1899780.hstgr.cloud — saine, déployée, vérifiée en navigateur réel |
| **GitHub** | https://github.com/aramis75009/brief/tree/feat/ui-redesign-claude |

## Goal — l'objectif

Deux demandes d'Aramis dans la continuité l'une de l'autre : (1) fiabiliser la
synchronisation Apple Calendar ↔ Brief et le tri chronologique dans toutes les
vues, (2) reconstruire la vue « Rendez-vous » pour qu'elle reflète fidèlement
Apple Calendar — y compris les événements posés directement dans l'app
Calendrier, pas seulement ceux que Brief a créés.

## Current state — ce qui a été fait

### Partie 1 — Réconciliation CalDAV, idempotence, tri (commit `6a8d2c7`)

- **`decideSync`** (`caldav.ts`) : la Phase 2 de `runCalDavSync` PUTait
  inconditionnellement chaque événement à *chaque* passage (`put=12` toutes
  les 15 min même sans rien changer, preuve par les logs prod) — pas de
  branche « rien n'a changé ». Ajouté : `create` / `adopt` / `skip` /
  `complete`. `complete` est le vrai ajout : un item Brief dont l'événement a
  disparu du calendrier (supprimé par Aramis) est désormais adopté comme
  **terminé** au lieu d'être recréé — c'était la cause des tâches obsolètes
  signalées (« organiser le stock de polos », etc., qui étaient en fait déjà
  `doneAt` et juste non filtrées en recherche).
- **Tri chronologique** : `compareByDue`/`isDueToday` ajoutés à `due.ts`,
  utilisés dans `HomeScreen`, `SearchScreen`, `AgendaScreen`.
- **`SearchScreen`** : masque les items `doneAt` en navigation libre (retrouvables
  par le texte, étiquetés « Terminé »).
- Root cause du « 0 tâches aujourd'hui » signalé par Aramis : **pas un bug**.
  L'item en question (« Rush CSS Codecademy ») a `kind:"event"` dans les
  vraies données de prod, pas `"task"` — classification LLM à la capture, pas
  un défaut de filtrage. Logique de date vérifiée correcte par preuve directe
  sur `items.json` de prod + tests.

### Partie 2 — Vue Rendez-vous reconstruite (commit `64060c7`)

- **`AgendaScreen`** n'avait aucun état `selectedDate` : la pastille noire sur
  « 19 » n'était que le marqueur « aujourd'hui » (aucun `onClick` sur les
  jours), et le contenu listait toute la semaine depuis lundi — d'où
  l'impression « 19 sélectionné, contenu commence à Lundi 17 ». Reconstruite
  autour de `selectedDate` comme unique source d'état : pastilles cliquables,
  bande de 7 jours dérivée de `selectedDate` (`mondayOf`), flèches ±1 jour,
  contenu strictement scopé au jour sélectionné.
- **`src/lib/agenda.ts`** (nouveau) : `buildDayAgenda(items, snapshotEvents,
  dayStart, dayEnd)` — fusionne les items Brief actifs avec un instantané
  CalDAV pour un jour donné, sans dupliquer, en étendant les séries
  récurrentes sur toute la fenêtre (`rrule.ts` : `occurrencesInRange`, qui
  recule d'abord jusqu'à couvrir le jour demandé — `reminders.ts` avance déjà
  `due` d'un item récurrent dès l'ENVOI du rappel, pas seulement à la coche,
  donc l'ancre peut déjà pointer après le jour qu'on regarde).
- **`caldav.ts`** : `runCalDavSync` écrit désormais, à chaque passage réel, un
  instantané `caldav-agenda-snapshot.json` de tous les événements des 6
  calendriers que Brief connaît (pas seulement `brief-*`) — pour afficher les
  événements posés directement dans l'app Calendrier (« Rentre Jeanne »,
  « Terminé Learn CSS », etc., invisibles avant car `listBriefEvents` filtre
  strictement `brief-*`).
- **`api/agenda/route.ts`** réécrite (l'ancienne était du code mort, jamais
  appelée, avec des `.getHours()`/`.getDay()` en violation de l'invariant
  fuseau). `GET ?date=AAAA-MM-JJ`.

### Partie 3 — Adoption des événements externes (commit `64060c7`, décision Aramis)

Aramis, après avoir vu la vue Rendez-vous : les événements posés directement
dans Calendrier ne doivent pas juste s'AFFICHER, ils doivent devenir de
**vraies tâches Brief** (rappel, coche). Proposition initiale d'exclure
« Personnel » (jugé « bruit ») **rejetée par Aramis** : il y range aussi de
vraies tâches (« relancer Revolut pour un remboursement de 1000€ »), et rien
ne distingue programmatiquement les deux dans un même calendrier. Décision :
**adopter tout, sans tri** — voir `DECISIONS.md`, entrée du 19/08.

- **`decideExternalSync`** (`caldav.ts`, Phase 3 de `runCalDavSync`) :
  événement sans item lié → `create` ; item adopté actif dont l'événement
  diffère → `update` (le calendrier gagne toujours) ; événement disparu →
  `complete` (jamais recréé) ; item coché dans Brief, événement encore
  présent → `delete-remote` (Brief supprime l'événement d'origine — il n'y a
  pas de PUT à arrêter comme pour un item `brief-*`).
- `Item.externalUid`/`externalCalendar` marquent un item adopté.
  `buildEventIcs` l'exclut du PUT `brief-<id>` (sinon duplication).

### ⚠️ Incident en cours de session, corrigé et documenté (commit `6ee2052`)

**Le premier passage réel de l'adoption externe en prod a créé 145 tâches
parasites.** Cause : la requête CalDAV (`queryCalendarEvents`) n'avait **aucune
borne temporelle** — pour « Personnel », un calendrier qu'Aramis utilise depuis
des années, ça a remonté tout l'historique (des événements de mai-juin, avant
même l'existence de Brief), pas juste les événements actuels.

- **Remédiation immédiate** : `items.json` restauré depuis la sauvegarde prise
  une commande avant l'incident (`deploy/backup.sh`, 29 items, zéro
  `externalUid`), via `docker cp` + `mv` atomique dans le conteneur. Le
  calendrier Apple lui-même n'a jamais été touché (l'action « create » n'écrit
  que dans `items.json` ; « delete-remote » ne se déclenche que pour un item
  déjà coché, aucun des 145 ne l'était).
- **Fix racine** : `queryCalendarEvents` prend une fenêtre optionnelle.
  `listBriefEvents` (réconciliation `brief-*`) reste **volontairement non
  bornée** — zéro changement de comportement, elle tourne sans ce problème
  depuis le 17/08 parce que Brief ne crée que des événements proches de leur
  échéance et les nettoie une fois terminés. `listAllEvents` (agenda +
  adoption externe, la seule à lire l'historique perso d'Aramis) est bornée à
  `agendaWindow()` : 30 jours passés, 180 à venir.
- **Redéployé et revérifié** : un second passage réel forcé a adopté **10**
  items (Rentre Jeanne, Terminé Learn CSS, Réveil, Ranger appartement, Séance
  pull, Aller courir, Rendre brief fonctionnel, Départ Jeanne, 2 vacances) —
  compte cohérent, vérifié un par un.

## Decisions — choix critiques ou irréversibles

- **Apple Calendar adopté intégralement, sans tri bruit/signal** (Aramis,
  19/08) — voir `DECISIONS.md`. Tout événement des 6 calendriers connus
  devient une tâche Brief, y compris « Personnel ». Un faux positif
  (« Rentre Jeanne » comme tâche) est acceptable ; un faux négatif (rater une
  vraie tâche) ne l'est pas.
- **La lecture CalDAV pour l'agenda/l'adoption est bornée à 30j passés / 180j
  à venir (`agendaWindow`) ; la réconciliation `brief-*` reste non bornée.**
  Ne JAMAIS fusionner les deux lectures dans un seul appel non borné — c'est
  exactement ce qui a produit l'incident des 145 tâches.
- **Un item adopté (`externalUid` posé) n'est jamais écrit sous `brief-<id>`.**
  `buildEventIcs` retourne `null` pour ces items — la garder ainsi, sinon
  duplication de l'événement sur le calendrier d'Aramis.

## Changed — fichiers et composants

| Fichier | Nature |
|---|---|
| `src/lib/caldav.ts` | `decideSync`, `decideExternalSync`, `toCalendarEvent`, `agendaWindow`, instantané agenda, fenêtre temporelle |
| `src/lib/agenda.ts` | **nouveau** — fusion items Brief + instantané pour un jour |
| `src/lib/rrule.ts` | `occurrencesInRange` (extension récurrente bidirectionnelle) |
| `src/lib/due.ts` | `compareByDue`, `isDueToday` |
| `src/lib/types.ts` | `Item.externalUid`, `Item.externalCalendar` |
| `src/app/api/agenda/route.ts` | réécrite — `GET ?date=AAAA-MM-JJ`, zoned.ts |
| `src/components/AgendaScreen.tsx` | reconstruite — `selectedDate` unique source d'état |
| `src/components/HomeScreen.tsx`, `SearchScreen.tsx` | tri + filtrage `doneAt` |
| `src/components/BriefApp.tsx` | branchement `AgendaScreen` (nouvelles props) |
| `DECISIONS.md` | entrée « adoption totale, sans tri bruit/signal » |
| `TODOS.md` | 2 entrées P2 différées (voir Blockers) |
| `docs/handoffs/2026-08-19-crash-caldav-corrige-coordination.md` | archive de la passation précédente (Hermes) |

## Validations — passants / échoués / non lancés

| Commande | Résultat |
|---|---|
| `npx tsc --noEmit` | ✅ propre |
| `npx vitest run` | ✅ **177 passed \| 1 skipped** (178) — 41 nouveaux tests cette session |
| `npx eslint .` | ✅ 23 problèmes, **tous préexistants** (aucun nouveau — vérifié par diff avant/après à chaque étape) |
| Déploiement VPS | ✅ `brief-app-1 Healthy`, HEAD `6ee2052` |
| Navigateur réel (prod) | ✅ aucune erreur console, PIN accepté, écran Rendez-vous testé avec les vraies données (17/18/19/20/25 août, flèche de navigation, événements adoptés) |
| Sync CalDAV forcée (prod) | ✅ passage réel après le fix : `externalAdopted:10`, `put:0 adopted:0 deleted:0` (réconciliation `brief-*` intacte) |

Non vérifié : le cron des rappels (`/api/cron/reminders`) n'a pas été observé
en train d'envoyer un Web Push pour un item adopté — attendu au prochain
passage naturel, pas testé en forçant.

## Blockers — ce qui bloque

Rien. Deux améliorations différées, notées dans `TODOS.md` (P2) :
tuile « Rendez-vous » de l'accueil qui ne compte pas les événements
externes/adoptés étendus par récurrence, et un bug préexistant (pas introduit
cette session) de `<button>` imbriqué dans `HomeScreen.tsx` (`TodayRow` /
`RowCheckbox`).

## Next — la prochaine action

Rien d'urgent côté code. Observer les prochains passages de sync (toutes les
15 min) : `docker logs brief-app-1 | grep caldav` — `externalAdopted` devrait
rester bas (0-2 par passage) une fois les événements actuels absorbés ; un
nombre élevé et répété signalerait un nouveau problème de fenêtre ou de
déduplication à investiguer immédiatement, pas à laisser courir.

---

## Historique des passations

| Date | Sujet | Agent | Fiche |
|---|---|---|---|
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
