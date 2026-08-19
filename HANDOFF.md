# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui que
tu remplaces dans `docs/handoffs/`.

> **Multi-agents** : si tu n'es pas l'agent qui a écrit la dernière passation,
> tu reprends la main explicitement (nouvelle entrée). Lis aussi
> [`docs/coordination.md`](docs/coordination.md) — les copies du dépôt, la
> branche de prod, les règles anti-collision.

---

# Passation — 2026-08-19 · Types explicites, édition complète, accueil↔Rendez-vous unifiés

| | |
|---|---|
| **Agent** | Claude Code (Sonnet 5) |
| **Branche** | `feat/ui-redesign-claude` — **la branche que sert le VPS** |
| **Commits** | **aucun — rien n'est commité.** Diff local uniquement, en attente de revue avant commit/push (jamais sans demande explicite d'Aramis). |

## Goal — l'objectif

Aramis a fourni un rapport de bug en 13 points (avec captures d'écran) :
impossible de créer une idée ou de choisir explicitement Tâche/Rendez-vous/
Idée à la capture ; aucune édition possible d'un item existant ; la tuile
« Rendez-vous » de l'accueil affiche 0 alors qu'un rendez-vous existe ;
suppression d'un item qui réapparaît après une autre action ; « Rouvrir » mal
orthographié ; retour de fiche qui ramène toujours à l'accueil au lieu de
l'écran de provenance. Consigne explicite : trouver les causes communes, pas
corriger chaque symptôme isolément.

## Current state — ce qui a été fait

**Deux bugs serveur concrets trouvés en lisant le code, avant toute UI :**

1. `sanitizePatch()` dans `src/app/api/items/[id]/route.ts` ne lisait jamais
   `v.status` — le bouton « Convertir en tâche » d'`IdeasScreen` appelait déjà
   `updateItem(id, {status:"active"})`, mais le PATCH était silencieusement
   vidé de ce champ côté serveur. **La conversion idée↔tâche ne persistait
   jamais**, même si l'UI semblait confirmer l'action. Corrigé (+ `notes`, même
   trou).
2. Le bouton « Plus d'options » (`⋯`) de la fiche n'avait **aucun** `onClick`
   — bouton mort. Remplacé par un bouton Modifier fonctionnel.

**Le modèle de données gérait déjà les trois types**, juste mal exposé : un
type = `Item.kind` (`task`/`event`) + `Item.status` (`idea` prime sur tout).
Nouveau `src/lib/item-type.ts` (`itemType()`, `typeLabel()`, `typeColors()`)
centralise cette dérivation, reprise par tous les écrans qui la recalculaient
chacun à sa façon.

**Accueil et onglet Rendez-vous lisaient deux logiques différentes.**
`HomeScreen` filtrait `items` par `kind==="event" && due==aujourd'hui` —
indépendant de l'onglet Rendez-vous (`GET /api/agenda` → `buildDayAgenda`,
qui fusionne items + instantané CalDAV, seule façon de voir un événement
calendrier pas encore réécrit dans `items.json` ou une série récurrente
étendue). `HomeScreen` fait désormais le même appel `/api/agenda` que l'onglet
(`BriefApp.refreshTodayAgenda`), et sépare « Aujourd'hui » en deux sections
Tâches/Rendez-vous. **Bonus trouvé au passage : `counts.ideas` de l'accueil
était TOUJOURS 0** — calculé sur `items` (prop `activeItems`, qui exclut déjà
`status==="idea"` par construction). Remplacé par un `ideaCount` passé
explicitement depuis la même liste que l'écran Idées.

**Suppression d'un item adopté du calendrier Apple pouvait être recréée par
la synchro suivante.** `DELETE /api/items/[id]` ne touchait jamais CalDAV ;
pour un item `externalUid` (posé directement dans Calendrier), l'événement
source restait sur iCloud, et `decideExternalSync` le recréait au passage
suivant avec le même id déterministe (`caldav-<uid>`). Fix : tombstone
persistant (`deletedExternalUids` dans le même fichier que le garde-fou de
fréquence, `caldav-last-sync.json`) — `DELETE` enregistre l'UID
synchroneusement, `decideExternalSync` force `delete-remote` au lieu de
`create` tant que le calendrier n'a pas confirmé la disparition, purge
automatique une fois confirmé. **Pas testable en réel en local** (pas
d'identifiants CalDAV dans `.env.local`) — couvert par tests unitaires
(`caldav.test.ts`) et par le raisonnement du Constat clé n°4 du plan
(`/Users/ams/.claude/plans/fizzy-humming-ladybug.md`, conservé pour référence).
Les items brief-owned (non adoptés) n'avaient PAS ce bug — Phase 1 du sync
les nettoie déjà correctement au passage suivant, vérifié en lisant
`runCalDavSync`.

**Capture** (`CaptureSheet.tsx`) : chaque brouillon a maintenant un sélecteur
Tâche/RDV/Idée explicite (`TypeSegmented`, nouveau composant partagé avec la
fiche) + un `<input type="datetime-local">` pour Tâche/RDV. `/api/parse`
propose désormais `status:"idea"` au modèle (note sans action ni échéance
claire) — proposition, jamais définitive, l'utilisateur tranche à la revue.

**Fiche** (`TaskDetailScreen.tsx`) : mode édition complet — type, titre,
projet (`<select>`), date/heure (masqué pour Idée, requis pour RDV, bloque
Enregistrer avec message inline sinon), notes (champ jamais affiché ni
éditable avant cette session). Sauvegarde par un seul PATCH
(`updateItem`). Erreur réseau → toast, reste en édition, ne perd pas la
saisie.

**Texte « Rouvrir » → « Réouvrir »** (`TaskDetailScreen.tsx`, seule
occurrence trouvée par `grep -rn "Rouvrir" src/`, revérifié après coup).

**Retour de fiche vers l'écran de provenance** : `BriefApp.tsx` mémorise
l'écran courant au moment d'ouvrir une fiche (`openTask`/`returnScreen`) au
lieu de forcer `setScreen("home")`. Recherche → Fiche → Retour → Recherche,
vérifié en navigateur réel.

## Decisions — choix critiques ou irréversibles

- **`itemType()` = dérivé de `kind`+`status`, pas un nouveau champ.** Le
  modèle le permettait déjà (`status:"idea"` filtré partout) ; ajouter un
  troisième enum aurait dupliqué la source de vérité et forcé une migration
  de `items.json` en prod pour zéro bénéfice.
- **Pas de suppression CalDAV synchrone dans `DELETE /api/items/[id]`.** Un
  appel réseau iCloud dans le chemin de suppression ajouterait de la latence
  et un point de panne à une action utilisateur ; le tombstone + la prochaine
  passe cron (~15 min, latence déjà acceptée par décision Aramis du 17/08)
  suffit à garantir qu'un item supprimé ne revient jamais, sans bloquer la
  requête sur le réseau iCloud.
- **RDV vide à la confirmation de capture → préremplissage automatique**
  (prochaine heure pleine, ou 9h le lendemain après 20h) plutôt que blocage —
  friction minimale à la capture. **En édition d'un item existant → blocage
  avec message inline** — l'utilisateur édite un item déjà connu, l'erreur
  explicite vaut mieux qu'une date devinée à sa place.
- **Datetime natif (`<input type="datetime-local">`), pas de calendrier
  custom.** Hors périmètre des 13 points demandés ; le contrôle natif donne
  la meilleure UX mobile (roue native iOS) sans construire un composant.

## Changed — fichiers et composants

| Fichier | Nature |
|---|---|
| `src/app/api/items/[id]/route.ts` | fix `status`/`notes` dans `sanitizePatch` (exporté) ; `DELETE` enregistre le tombstone CalDAV |
| `src/app/api/items/[id]/route.test.ts` | nouveau — 13 tests `sanitizePatch` |
| `src/lib/item-type.ts` + `.test.ts` | nouveau — `itemType()`/`typeLabel()`/`typeColors()` |
| `src/lib/due.ts` + `due.test.ts` | `isoToLocalInputValue`/`localInputToIso` (aller-retour `<input type="datetime-local">`, via `zoned.ts`) |
| `src/lib/caldav.ts` + `caldav.test.ts` | `readSyncState`/`writeSyncState` (remplace `readLastSync`/`writeLastSync`) ; `recordDeletedExternalUid` ; `decideExternalSync` : 5ᵉ paramètre `isTombstoned` |
| `src/app/api/parse/route.ts` | prompt + `coerce()` : le modèle peut proposer `status:"idea"` |
| `src/components/TypeSegmented.tsx` | nouveau — sélecteur Tâche/RDV/Idée partagé capture + fiche |
| `src/components/CaptureSheet.tsx` | `DoneStage` : type + date/heure éditables par brouillon, prop `onUpdateDraft` |
| `src/components/TaskDetailScreen.tsx` | mode édition complet, notes affichées, bouton Modifier (remplace le bouton mort), « Réouvrir » |
| `src/components/icons.tsx` | `EditIcon` (crayon) |
| `src/components/HomeScreen.tsx` | prop `todayAgenda`/`ideaCount` remplace le calcul local ; section « Aujourd'hui » scindée Tâches/Rendez-vous ; `TodayAgendaGroup`/`TodayAgendaFallbackRow` |
| `src/components/BriefApp.tsx` | `refreshTodayAgenda`, `updateDraft`, `saveItemEdit`, `openTask`/`returnScreen` |

## Validations — passants / échoués / non lancés

| Commande | Résultat |
|---|---|
| `npx vitest run` | ✅ **215 passed \| 1 skipped** (216) — 31 tests nouveaux cette session (13 route + 8 item-type + 7 due + 3 caldav, net) |
| `npx tsc --noEmit` | ✅ propre |
| `npx eslint .` | ✅ 23 problèmes — **identiques à la baseline** (vérifié par `git stash` + eslint avant/après, même liste, même compte) |
| QA navigateur (`npm run dev -p 3100`, `/browse`, PIN local) | ✅ voir détail ci-dessous |

**QA navigateur, scénarios réellement exécutés (pas supposés) :**
- Dictée « ce soir sortir les poubelles, déjeuner avec Paul demain midi, et
  il faudrait repenser le logo un jour » → 3 brouillons, types corrects
  (Tâche/RDV/Idée) proposés par le LLM, switch manuel testé (Tâche→RDV→Tâche
  sur le 1er brouillon) → envoi → accueil : Tâches 1, Idées 1 (**avant le fix,
  ce compteur aurait affiché 0 quel que soit le nombre réel d'idées**).
- Idée « Repenser le logo » → Convertir en tâche → toast → **rechargement
  complet de la page** → Idées repasse à 0 (persistance serveur confirmée,
  pas seulement optimiste côté client).
- Fiche « Déjeuner avec Paul » ouverte depuis Recherche → Modifier → type
  Rendez-vous→Idée (champ date disparaît)→Rendez-vous (réapparaît, valeur
  conservée) → date vidée → Enregistrer → erreur inline « Un rendez-vous a
  besoin d'une date et d'une heure. » (formulaire conservé) → type Tâche,
  titre modifié → Enregistrer → succès → Retour → **revient sur Recherche**,
  pas Accueil.
- Tâche terminée → bouton fiche affiche « Réouvrir ».
- Suppression d'un item → **rechargement complet** → absent. Coche d'un
  AUTRE item ensuite → **nouveau rechargement complet** → item supprimé
  toujours absent (scénario exact du rapport d'Aramis).
- Dictée « Appel avec le comptable ce soir à 20h » → LLM propose RDV
  aujourd'hui 20h directement → accueil : « Rendez-vous 1 · Calendrier Apple »
  (**avant le fix, aurait pu rester à 0 selon la source d'un événement** —
  ici confirmé aussi correct dans le cas simple) → section « RENDEZ-VOUS »
  visible sous Aujourd'hui → onglet Rendez-vous (même tuile cliquée) : même
  événement listé à 20h sous APRÈS-MIDI, aujourd'hui — **confirmation directe
  que les deux écrans lisent la même source**.

**Non vérifié** : le tombstone CalDAV (tâche 4) contre un vrai compte iCloud —
aucun identifiant `BRIEF_CALDAV_*` dans `.env.local`. Couvert par 2 tests
unitaires nouveaux dans `caldav.test.ts` ; comportement attendu par
construction, pas observé en conditions réelles.

**Bug pré-existant reconfirmé, non corrigé (hors périmètre)** : `<button>`
imbriqué dans `TodayRow`/`RowCheckbox` (déjà noté `TODOS.md` P2) — génère
une erreur d'hydration React visible en console à chaque rendu d'une ligne
« Aujourd'hui ». Réutilisé tel quel par `TodayAgendaGroup` (nouveau) sans le
modifier — je n'ai pas élargi son usage, juste hérité du composant existant.

## Blockers — ce qui bloque

Rien pour le code. **Pour le déploiement : rien n'est commité.** Le diff est
volumineux (11 fichiers modifiés, 4 nouveaux, ~650 lignes) — laissé en attente
de revue d'Aramis avant tout `git add`/commit, conformément à la règle du
projet (jamais de commit sans demande explicite).

## Next — la prochaine action

1. Revue du diff par Aramis (`git diff` — rien n'est encore indexé).
2. Sur accord : commit (message `feat: explicit item types, full editing,
   home/agenda single source of truth, caldav deletion tombstone`) puis PR
   normale — pas de push direct.
3. Après déploiement : observer un premier passage `runCalDavSync` réel pour
   confirmer le tombstone en conditions réelles (supprimer un item adopté en
   prod, vérifier qu'il ne revient pas après le prochain cron CalDAV) — seul
   chemin non testable en local faute d'identifiants iCloud dev.

---

## Historique des passations

| Date | Sujet | Agent | Fiche |
|---|---|---|---|
| **2026-08-19** | **Types explicites, édition complète, accueil↔Rendez-vous unifiés** | **Claude Code** | *(cette passation)* |
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
