# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui que
tu remplaces dans `docs/handoffs/`.

> **Multi-agents** : si tu n'es pas l'agent qui a écrit la dernière passation,
> tu reprends la main explicitement (nouvelle entrée). Lis aussi
> [`docs/coordination.md`](docs/coordination.md) — les copies du dépôt, la
> branche de prod, les règles anti-collision.

---

# Passation — 2026-08-27 (matin) · Écran Tâches & RDV : tri chronologique + filtres d'état câblés + « Faites » réparé

| | |
|---|---|
| **Agent** | **Hermes Agent** — *je passe la main* (passation précédente : Hermes Agent, 26/08 soir) |
| **Branche** | `feat/email-password-auth` = **prod** (déployée le 26/08 soir) |
| **Commits** | `db53fed` = HEAD local + origin ; **DÉPLOYÉ en prod le 27/08 (matin)** — Aramis a validé le fix en signalant le tri ; prod = `832a811` (fix + passation) |

## Goal — l'objectif

Analyse des captures d'Aramis (27/08, écran Tâches & RDV) → **3 bugs réels
corrigés et validés** : tri chronologique des lignes, filtres d'état câblés
(ils étaient calculés mais jamais appliqués), et filtre « Faites » qui ne
pouvait jamais rien afficher. Deux points restants documentés pour la suite.

## Current state — ce qui a été fait

### 1. ✅ Tri chronologique des lignes Tâches & RDV (fix `db53fed`)

**Symptôme (capture Aramis 27/08)** : dans le groupe « Sport », « Aller
courir » (sam. 29) était affiché AVANT « Séance push » (jeu. 27) et « Séance
pull » (ven. 28) — la liste suivait l'ordre de `items.json`, pas les dates.

**Cause** : `weekOccurrenceRows` (src/lib/desktopDashboard.ts) poussait les
lignes dans l'ordre d'itération des items ; seules les occurrences D'UNE
série étaient triées entre elles.

**Fix** : `return rows.sort((a, b) => a.due.localeCompare(b.due))` à la sortie
de `weekOccurrenceRows`. Toutes les lignes ont un `due` non-null (les items
sans `due` sont écartés plus haut) → le tri est sûr. Test de régression ajouté
(reproduit la capture : courir/push/pull → jeu, ven, sam).

### 2. ✅ Filtres d'état câblés — « Aujourd'hui » / « En retard » / « Faites » agissent enfin

**Symptôme** : les compteurs des filtres bougeaient mais la liste ne
changeait JAMAIS (warning eslint `filtered is assigned a value but never
used` dans `DesktopTasks.tsx:83`).

**Cause** : `groups` se construisait depuis `rows` (non filtrées) au lieu de
`filtered` — `filterRowsByState` était appelé puis son résultat ignoré.

**Fix** : `groups` boucle désormais sur `filtered` (`DesktopTasks.tsx`).
Le warning eslint associé a disparu (30 warnings restants = imports morts
pré-existants, inoffensifs).

### 3. ✅ Filtre « Faites » réparé — il ne pouvait RIEN afficher

**Symptôme** : « Faites (0) » permanent (capture Aramis 27/08).

**Cause** : `weekOccurrenceRows` excluait les items `doneAt` À LA SOURCE
(`if (it.doneAt) continue`) — or `filterRowsByState` ne peut renvoyer de
lignes « Faites » que si l'item est fait → contradiction, filtre mort.

**Fix** : les items faits restent dans `rows` (une ligne à leur `due`
courant, sans développer d'occurrences résiduelles — une série faite garde
UNe seule ligne) ; c'est `filterRowsByState` qui les écarte du filtre par
défaut (`!r.item.doneAt`) et les garde pour « Faites ». Tests adaptés à la
nouvelle sémantique + test « série faite = 1 ligne ».

**Comportement résultant (vérifié par tests)** : « Toutes » montre les
actifs (items + occurrences de la semaine), « Faites » montre les items
faits, « En retard » / « Aujourd'hui » lisent l'occurrence (`row.due`).

## Decisions — choix critiques (journal complet dans `DECISIONS.md`)

- **RAS pour cette session** — les décisions actives restent celles des
  passations précédentes (auth Supabase, CalDAV source de vérité, statuts
  tâche, pas de reactflow…). Aucun arbitrage nouveau d'Aramis.

## Changed — fichiers et composants

| Fichier | Nature |
|---|---|
| `src/lib/desktopDashboard.ts` | tri chronologique de `weekOccurrenceRows` ; items faits gardés (1 ligne) pour le filtre « Faites » |
| `src/lib/desktopDashboard.test.ts` | +2 tests (tri multi-items, série faite = 1 ligne), 1 test adapté (fait gardé) |
| `src/components/desktop/DesktopTasks.tsx` | `groups` construit sur `filtered` (filtres d'état câblés) |

## Validations

### ✅ Passants

| Commande / geste | Résultat |
|---|---|
| `npx eslint .` | **0 erreur**, 30 warnings (imports morts pré-existants — le warning `filtered`/`groupByProject` de DesktopTasks a disparu) |
| `npx tsc --noEmit` | propre |
| `TZ=UTC npx vitest run` | **374 passed** (373 + 1 nouveau) |

### ❌ Échoués

Aucun.

### ⚠️ Non lancés / À vérifier

1. **Vérification visuelle (Aramis)** : le tri est DÉPLOYÉ en prod (27/08
   matin) — un rechargement de l'écran Tâches & RDV doit montrer les lignes
   par date croissante (27 avant 28, séances par jour). Si l'ancien ordre
   persiste : rechargement forcé (PWA desktop = cache navigateur).

## Blockers

**Aucun blocage technique.** Rappels d'état :

- **La prod est sur `feat/email-password-auth`** (plus `feat/ui-redesign-claude`,
  qui reste 25+ commits en retard, ne pas merger sans demande).
- **Le PIN est mort** (auth Supabase, cookie httpOnly) ; les scripts qui
  l'utilisaient (`brief-agents.sh agenda`) sont à migrer — `TODOS.md` § P0 bis.
- **Remote prod HTTPS sans credentials** : se déployer par bundle+scp+ff.
- **Ne pas lancer `npm run dev` ici** (port 3000 = bridge WhatsApp).

## Points restants repérés sur les captures (27/08) — NON corrigés, à trancher

1. **Cohérence des compteurs** : badge nav « Tâches & RDV (14) » = items
   actifs (`DesktopShell`), filtre « Toutes (17) » = occurrences de la
   semaine (séries développées) — deux périmètres différents qui peuvent
   dérouter. Comportement voulu, mais à clarifier si Aramis relève l'écart.
2. **Question en attente (Aramis)** : les séries Frip & Trend s'arrêtent au
   31/08 (`UNTIL=20260831T235959Z`). Prolonger en continu (10 en semaine,
   15-20 le week-end) ? Réponse à intégrer (RRULE/UNTIL côté CalDAV + items).

## Next — la prochaine action

1. **Déploiement de `db53fed`** sur validation d'Aramis (voir Validations).
2. **Réponse à la question Frip & Trend** (prolonger les séries après le 31/08 ?).
3. Les points différés de `TODOS.md` § P0 bis restent : `brief-agents.sh
   agenda` cassé, purge état client à la déconnexion, README/coordination/
   agent-calendar-access périmés (variables Supabase manquantes, `BRIEF_PIN`
   encore listé).
4. Les refontes Claude Design (calendrier desktop + fiche tâche) en attente
   du livrable `.dc.html`.

---

## Historique des passations

| Date | Sujet | Agent | Fiche |
|---|---|---|---|
| **2026-08-27 (matin)** | **Tâches & RDV : tri + filtres câblés + « Faites » réparé** | **Hermes Agent** | *(cette passation)* |
| 2026-08-26 (soir) | Auth Supabase (email + mdp) DÉPLOYÉE — PIN retiré | Hermes Agent | [fiche](docs/handoffs/2026-08-26-auth-supabase-deployee.md) |
| 2026-08-26 (après-midi) | PIN → Supabase Auth : code + provisionnement prêts, déploiement pour Hermes | Claude Code | [fiche](docs/handoffs/2026-08-26-email-password-auth-claude-code.md) |
| 2026-08-26 (matin) | Cinq chantiers poussés et déployés ; refonte Calendrier + Fiche par Claude Design | Hermes Agent | [fiche](docs/handoffs/2026-08-26-matin-chantiers-deployes-hermes.md) |
| 2026-08-25 (soir) | Cinq chantiers front-end : waveform, DnD Kanban, calendrier, fiche, graphe | Claude Code | [fiche](docs/handoffs/2026-08-25-cinq-chantiers-frontend-claude-code.md) |
| 2026-08-25 (matin) | État du repo + défi Kanban/dépendances/Graphe pour Claude Code | Hermes Agent | [fiche](docs/handoffs/2026-08-25-hermes-etat-repo-mission-bugs.md) |
| 2026-08-24 (après-midi) | Vue Graphe et recette de l'existant | Claude Code | [fiche](docs/handoffs/2026-08-24-graphe-recette-claude-code.md) |
| 2026-08-24 (matin) | Kanban, tags, dépendances, fiche tâche, donut fix | Hermes Agent | [fiche](docs/handoffs/2026-08-24-kanban-tags-dependances-fiche.md) |
| 2026-08-23 (matin, 2e) | Desktop V1.1 : Réglages, priorités, IA, projets | Hermes Agent | [fiche](docs/handoffs/2026-08-23-hermes-kanban-tags-deps.md) |
| 2026-08-23 (matin) | Déploiement desktop V1 + audio/IA du 22/08 | Hermes Agent | [fiche](docs/handoffs/2026-08-23-hermes-deploy-desktop-v1.md) |
| 2026-08-23 (nuit) | Version desktop V1 (5 écrans, nav pilule, dashboard 3 cartes) | Claude Code | [fiche](docs/handoffs/2026-08-23-claude-code-desktop-v1.md) |
