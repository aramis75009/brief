# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui que
tu remplaces dans `docs/handoffs/`.

> **Multi-agents** : si tu n'es pas l'agent qui a écrit la dernière passation,
> tu reprends la main explicitement (nouvelle entrée). Lis aussi
> [`docs/coordination.md`](docs/coordination.md) — les copies du dépôt, la
> branche de prod, les règles anti-collision.

---

# Passation — 2026-08-20 (après-midi) · Séance push corrigée + icône PWA + DESIGN.md restauré

| | |
|---|---|
| **Agent** | Claude Code (Sonnet 5) |
| **Branche** | `feat/ui-redesign-claude` — **la branche que sert le VPS** |
| **Commits** | `8b293c8` (fix occurrence avancée) · `6d01cb8` (icône) · `e972e59` (DESIGN.md) — tous déployés |
| **Prod** | https://brief.srv1899780.hstgr.cloud — `brief-app-1 Healthy`, vérifiée en navigateur avec le vrai compte |

## Goal — l'objectif

Trois demandes d'Aramis dans la même session : implémenter l'icône PWA
choisie dans Claude Design (`BriefIcon.dc.html`), corriger un bug qu'il a
rencontré en usage réel (« Séance push » ne se coche pas comme une tâche
normale), et — arrivé en cours de route — remettre en place un `DESIGN.md`
correct après avoir découvert que l'ancien avait été supprimé sans être
remplacé.

## Current state — ce qui a été fait

**1. Bug « Séance push » corrigé** (`8b293c8`). Root cause via
`superpowers:systematic-debugging` : `buildDayAgenda` (`src/lib/agenda.ts`)
ne comparait jamais la date d'une occurrence calendrier au `due` courant de
l'item lié. Cocher un rendez-vous récurrent avance `due`
(`completionPatch` ne pose jamais `doneAt` sur une récurrence) sans jamais
toucher au calendrier Apple (décision 19/08) — sa série RRULE recontient
donc pour toujours l'occurrence déjà traitée. Un test existant
(`agenda.test.ts`) assertait même explicitement ce comportement avec le même
titre et la même règle (`FREQ=WEEKLY;BYDAY=MO,TH`) — corrigé, plus un nouveau
test de régression. **Vérifié en prod avec le vrai item d'Aramis** (pas
seulement en test) : avant déploiement, l'app montrait « Séance push » non
coché dans Rendez-vous malgré la tentative de coche du matin ; après
déploiement, `/browse` + PIN confirme « Aucun rendez-vous — Ce jour est
entièrement libre » pour aujourd'hui.

**2. Icône PWA implémentée** (`6d01cb8`) — variante « Trois destinations »
(`BriefIcon.dc.html`, variante B) du projet Claude Design « Brief PWA et
desktop », choisie et documentée par Aramis. Régénéré avec `sharp` :
`icon-192/512.png`, `apple-touch-icon.png`, `icon-maskable-512.png` (zone
sûre 80 %), `favicon-32.png`, `favicon.ico` (PNG embarqué 16+32).
`manifest.ts` : `background_color`/`theme_color` `#F5F3F0` → `#F4F4F2`
(alignés sur `--color-bg`, qui avait migré dans `globals.css` sans que le
manifest ne suive). **Non confirmé visuellement** : iOS ne recharge pas
l'icône d'une PWA déjà installée (piège connu, `DESIGN.md` historique) — à
vérifier au prochain réinstall d'écran d'accueil, pas avant.

**3. `DESIGN.md` restauré** (`e972e59`) — **pas** l'ancien (système
corail/General Sans, supprimé le 20/08 au matin, cette suppression-là reste
valide). En cours de session, Aramis a signalé que la suppression avait
laissé un vide : plus aucun document ne décrivait le système v1
(Plus Jakarta, ink, task/meet/idea) réellement en prod depuis le 18/08 — j'en
avais moi-même laissé une trace dans un commit annulé (voir Decisions). Il a
fait générer un `DESIGN.md` correct par Claude Design et me l'a transmis en
plein milieu de cette session ; je l'ai écrit tel quel, en ajoutant la
sous-section icône PWA (absente du document reçu) et en retirant l'écart
« manifest.ts #F5F3F0 » déjà corrigé au point 2. `AGENTS.md`/`CLAUDE.md`
remis à jour pour pointer dessus.

**Incident en cours de route, résolu avant de committer** : le dépôt distant
avait avancé de 8 commits (Hermes Agent) pendant que je travaillais, dont un
qui **supprimait `DESIGN.md`** et un autre qui **restructurait
`buildDayAgenda`** (mécanisme `applyOverride` pour les décalages
RECURRENCE-ID/EXDATE — un bug voisin mais différent du mien). Détecté via
`scripts/coord/status.sh` + vérification directe (le script donne un faux
« prod injoignable », [[coord-scripts-faux-positifs]] en mémoire) avant tout
push — stash, fast-forward, ré-application du fix à la main sur la nouvelle
version du fichier, deux tests existants corrigés pour ne plus dépendre d'un
`due` qui collisionnait avec mon nouveau filtre. Sans cette vérification,
j'aurais committé un `DESIGN.md` contredisant une décision explicite
d'Aramis (« je veux pas du tout qu'il suive le design.md de l'ancienne
version ») et probablement cassé le fix RECURRENCE-ID d'Hermes.

## Decisions — choix critiques ou irréversibles

- **`DESIGN.md` est de retour, mais ce n'est pas l'ancien.** Voir
  `DECISIONS.md` (entrée 2026-08-20 après-midi) pour le distinguo complet —
  ne pas re-débattre, et surtout ne jamais ressusciter le contenu
  corail/General Sans supprimé le matin même.
- **L'icône PWA change de sens** : de « état d'enregistrement » (barres de
  niveau audio) à « trois destinations » (task/meet/idea). Voir
  `DECISIONS.md` (entrée icône, 2026-08-20) pour le pourquoi.

## Changed — fichiers et composants

| Fichier | Nature |
|---|---|
| `src/lib/agenda.ts` | filtre `notBefore` : ignore toute occurrence calendrier antérieure au `due` de l'item lié |
| `src/lib/agenda.test.ts` | 1 test corrigé (assertait l'ancien bug), 1 test de régression ajouté |
| `public/icon-{192,512}.png`, `apple-touch-icon.png`, `icon-maskable-512.png`, `favicon-32.png` | régénérés (variante B, `sharp`) |
| `src/app/favicon.ico` | régénéré (PNG embarqué 16+32) |
| `src/app/manifest.ts` | `background_color`/`theme_color` `#F5F3F0` → `#F4F4F2` |
| `DESIGN.md` | **recréé** — système v1 réel (Aramis / Claude Design), pas l'ancien |
| `AGENTS.md`, `CLAUDE.md` | pointeurs vers `DESIGN.md` restaurés |
| `DECISIONS.md` | 2 nouvelles entrées (icône, restauration DESIGN.md) |

## Validations — passants / échoués / non lancés

| Commande | Résultat |
|---|---|
| `npx vitest run` | ✅ **239 passed \| 1 skipped** (240) |
| `npx tsc --noEmit` | ✅ propre |
| `npx eslint .` | ✅ 23 problèmes — baseline inchangée |
| Vérif liens markdown (`AGENTS.md`/`CLAUDE.md`/`DESIGN.md`/`DECISIONS.md`) | ✅ tous résolvent (1 lien cassé pré-existant ailleurs dans `DECISIONS.md`, sans rapport) |
| `/browse` prod + PIN réel | ✅ aucune erreur console, « Séance push » absent de Rendez-vous aujourd'hui (confirmé sur les vraies données) |
| Déploiement VPS (les 3 commits) | ✅ `git rev-parse HEAD` = `e972e59` côté VPS, `brief-app-1 Healthy`, `GET /` 200 |
| Backup avant déploiement | ✅ `20260820-174529` |
| **Icône réellement visible sur l'écran d'accueil iOS** | **Non vérifié** — iOS ne recharge pas l'icône d'une PWA déjà installée, purge nécessaire (voir `docs/coordination.md`, section PWA iOS en cache) |

## Blockers — ce qui bloque

Rien. Prod saine, tout déployé, vérifié.

## Next — la prochaine action

1. **Vérifier l'icône sur l'iPhone d'Aramis** au prochain réinstall d'écran
   d'accueil (Réglages → Safari → Effacer l'historique et les données de
   sites → retirer l'icône → recharger → PIN → ré-ajouter à l'écran
   d'accueil). Sans ça, impossible de confirmer visuellement que la
   variante B s'affiche.
2. **Le chantier annoncé par Aramis reste en attente** (`TODOS.md`, P2) :
   stocker les enregistrements vocaux bruts. Vérifier `useRecorder.ts` +
   `/api/transcribe` d'abord, puis `superpowers:brainstorming`.
3. Rien d'urgent ni de cassé par ailleurs.

---

## Historique des passations

| Date | Sujet | Agent | Fiche |
|---|---|---|---|
| **2026-08-20 (après-midi)** | **Séance push corrigée + icône PWA + DESIGN.md restauré** | **Claude Code** | *(cette passation)* |
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
