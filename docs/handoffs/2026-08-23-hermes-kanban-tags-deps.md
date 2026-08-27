# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui que
tu remplaces dans `docs/handoffs/`.

> **Multi-agents** : si tu n'es pas l'agent qui a écrit la dernière passation,
> tu reprends la main explicitement (nouvelle entrée). Lis aussi
> [`docs/coordination.md`](docs/coordination.md) — les copies du dépôt, la
> branche de prod, les règles anti-collision.

---

# Passation — 2026-08-23 (matin, 2e session) · Desktop V1.1 : Réglages, priorités, IA, projets

| | |
|---|---|
| **Agent** | Hermes Agent (glm-5.2 via Ollama Cloud) |
| **Branche** | `feat/ui-redesign-claude` — **la branche que sert le VPS** |
| **Commits** | `9cc33b7` (head) — déployé en prod |
| **Prod** | https://brief.srv1899780.hstgr.cloud — `brief-app-1 Healthy` |
| **Tests** | `TZ=UTC npx vitest run` ✅ 262 passed ; `npx tsc --noEmit` ✅ |

## Goal — l'objectif

Corriger les 4 problèmes remontés par Aramis sur la version desktop V1 après
sa première revue visuelle (screenshots du 23/08 matin) :

1. Réglages : projets manquants (Fake, Permis), couleurs, jetons design system
2. Tâches : priorités fausses (inventées par le LLM, pas par Aramis)
3. Dashboard : copywriting + visibilité "Demander à l'IA"
4. Tâches stale : "Faire des pâtes", "Tester le micro" — plus dans Apple Calendar

## Current state — ce qui a été fait

### 1. Réglages (DesktopSettings.tsx)

- **Supprimé "Jetons du design system"** (swatches, Aa, radius) — artefact de
  démo du prototype Claude Design, rien à faire en prod
- **Pastilles agrandies** : 12px → 18px avec bordure subtile pour mieux
  distinguer les couleurs
- **Nom du calendrier Apple** affiché sous chaque projet (ex: "→ Vinted
  Frip&Trend") via `calendarForProjectName()` (nouveau fichier
  `src/lib/calendarMapping.ts`, client-safe)
- **Projets Fake + Permis ajoutés** comme vrais projets :
  - `SEED_PROJECTS` : Fake (tint 7, square), Permis (tint 8, diamond)
  - `DEFAULT_CALENDAR_MAPPING` (caldav.ts) : `fake: "Fake"`, `permis: "Permis"`
  - `projects.json` en prod : 8 projets (Ia → IA corrigé, Fake + Permis ajoutés)
  - `EXTRA_AGENDA_CALENDARS` supprimé : Fake n'est plus un calendrier
    "additionnel" — c'est un vrai projet, inclus via le mapping
- **"Ia" → "IA"** corrigé dans `SEED_PROJECTS` et dans `projects.json` en prod

### 2. Tâches (DesktopTasks.tsx)

- **Badge `p{N}` supprimé** sur chaque ligne de tâche — les priorités sont
  inventées par le parseur LLM (`priority: 3` par défaut, `4` en fallback),
  Aramis ne les a pas définies
- **Carte "Par priorité" supprimée** de la colonne de droite
- La colonne de droite ne contient plus que le bloc "Ajouter sans parler"
- Le champ `priority` reste dans le modèle de données — juste pas affiché

### 3. Dashboard (DesktopDashboard.tsx)

- **"Demander à l'IA" en noir** : fond `C.ink`, texte blanc, plus grand
  (14px bold + 13px medium pour la question), bordure supprimée
- **Copywriting "Je parle, c'est rangé" → "Parle. Je m'occupe du reste."**
  (choix d'Aramis parmi 3 options proposées)

### 4. Nettoyage des données en prod

- **"Faire des pâtes"** et **"Tester le micro avec le brief"** marqués
  `doneAt: 2026-08-23T11:00:00.000Z` — ces tâches n'étaient plus dans le
  calendrier Apple mais n'avaient pas de `due` ni `caldavSyncedDue`, donc
  le sync ne pouvait pas les détecter comme supprimées

### 5. TODOS.md mis à jour

- **Calendrier desktop buggé** : reporté par Aramis, gros chantier (P2)
- **Scraper concurrents (Asana, Monday, Trello)** : "Asana personnalisé" (P2)
- Kanban reste séparé (P2)

## Decisions — choix critiques

- **Fake + Permis = vrais projets** (décision Aramis 23/08) : ce ne sont plus
  des calendriers "additionnels" mais des projets à part entière avec leur
  teinte (7, 8) et leur forme. Le mapping CalDAV les inclut.
- **Pas de priorités affichées** : tant qu'Aramis ne les définit pas lui-même,
  on n'affiche rien. Le modèle de données les garde. À rediscuter avec Aramis
  sur la méthode de saisie.
- **`calendarMapping.ts` client-safe** : dupliqué depuis `caldav.ts`
  (server-only) pour permettre à DesktopSettings d'afficher le calendrier
  Apple associé. Le mapping change rarement. Acceptable.

## Changed — fichiers

| Fichier | Nature |
|---|---|
| `src/components/desktop/DesktopSettings.tsx` | Jetons supprimés, pastilles 18px, nom calendrier Apple |
| `src/components/desktop/DesktopTasks.tsx` | Badges priorité + carte "Par priorité" supprimés |
| `src/components/desktop/DesktopDashboard.tsx` | IA button noir, copywriting "Parle. Je m'occupe du reste." |
| `src/lib/projects.ts` | SEED_PROJECTS : +Perso, Sport, IA (corrigé), Fake, Permis |
| `src/lib/caldav.ts` | Mapping +Fake, +Permis ; EXTRA_AGENDA_CALENDARS supprimé |
| `src/lib/calendarMapping.ts` | **NEW** — mapping client-safe pour DesktopSettings |
| `src/lib/caldav.test.ts` | Tests à jour (Fake, Permis mappés) |
| `src/lib/projects.test.ts` | Test formes → test teintes (8 projets, 5 formes) |
| `TODOS.md` | +Calendrier desktop buggé, +Scraper concurrents |

## Validations

| Commande | Résultat |
|---|---|
| `npx tsc --noEmit` | ✅ propre |
| `TZ=UTC npx vitest run` | ✅ 262 passed |
| `docker compose up -d --build` | ✅ Healthy |
| `curl -sI https://brief.srv1899780.hstgr.cloud/` | ✅ HTTP 200 |
| Projects en prod | ✅ 8 projets (IA corrigé, Fake + Permis ajoutés) |
| Tâches stale | ✅ "Faire des pâtes" + "Tester le micro" marqués done |

## Blockers

Aucun. Prod saine sur `9cc33b7`.

## Points à connaître (non bloquants)

1. **Calendrier desktop buggé** : Aramis le sait, reporté (gros chantier, TODOS.md)
2. **Priorités** : retirées de l'affichage, le modèle les garde. À rediscuter
   sur la méthode de saisie (Aramis veut les mettre lui-même)
3. **DESIGN.md §7** : nav horizontale réelle vs rail 248px décrit — pas corrigé
4. **Horizon 7 jours / Ton mur / Idées / Chaîne & sync** : retirés du Dashboard
   sur demande d'Aramis, pas supprimés du code. Ne pas les faire réapparaître
   sans qu'il le redemande.
5. **Couleurs Fake/Permis** : utilisent les teintes 7 (orange #FF9F0A) et 8
   (bleu #5AC8FA) — les couleurs "réserve" des tokens CSS. Si Aramis a des
   calendriers Apple avec d'autres couleurs pour Fake et Permis, il faudra
   ajuster les tokens `--color-p7` et `--color-p8` dans `globals.css`.

## Next — la prochaine action

1. **Revue visuelle d'Aramis** sur écran ≥1024px : force-quitter la PWA,
   rouvrir, vérifier que Réglages n'a plus les jetons, que les pastilles sont
   plus grosses avec le nom du calendrier, que Tâches n'a plus les priorités,
   que "Demander à l'IA" est en noir, et que le copywriting est bon.
2. **Scraper les concurrents** (Asana, Monday, Trello) pour identifier les
   fonctionnalités à adapter — chantier demandé par Aramis.
3. **Calendrier desktop** à reprendre quand Aramis le demande (gros chantier).
4. **Priorités** : définir avec Aramis comment il veut les saisir.
5. **Couleurs Fake/Permis** : vérifier avec Aramis si les teintes 7/8
   correspondent à ses calendriers Apple.

---

## Historique des passations

| Date | Sujet | Agent | Fiche |
|---|---|---|---|
| **2026-08-23 (matin, 2e)** | **Desktop V1.1 : Réglages, priorités, IA, projets** | **Hermes Agent** | *(cette passation)* |
| 2026-08-23 (matin) | Déploiement desktop V1 + audio/IA du 22/08 | Hermes Agent | [fiche](docs/handoffs/2026-08-23-hermes-deploy-desktop-v1.md) |
| 2026-08-23 (nuit) | Version desktop V1 (5 écrans, nav pilule, dashboard 3 cartes) | Claude Code | [fiche](docs/handoffs/2026-08-23-claude-code-desktop-v1.md) |
| 2026-08-22 (soir) | Audio storage, assistant IA, sheets, couleurs projets, perf iPhone | Hermes Agent | [fiche](docs/handoffs/2026-08-22-audio-storage-ia-sheets-couleurs.md) |
| 2026-08-20 (soir 2) | Coche d'une occurrence dont `due` a déjà avancé (cron) | Hermes Agent | [fiche](docs/handoffs/2026-08-22-hermes-audio-ia-sheets.md) |
| 2026-08-20 (soir) | Occurrence cochée vs `due` avancé par le cron | Claude Code | [fiche](docs/handoffs/2026-08-20-occurrence-cochee-due-avance-cron.md) |
| 2026-08-20 (après-midi) | Séance push corrigée + icône PWA + DESIGN.md restauré | Claude Code | [fiche](docs/handoffs/2026-08-20-phantom-occurrence-icone-design-restaure.md) |
| 2026-08-20 (jour) | Accès agents aux tâches/RDV + query token | Hermes Agent | [fiche](docs/handoffs/2026-08-20-acces-agents-query-token.md) |