# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui que
tu remplaces dans `docs/handoffs/`.

> **Multi-agents** : si tu n'es pas l'agent qui a écrit la dernière passation,
> tu reprends la main explicitement (nouvelle entrée). Lis aussi
> [`docs/coordination.md`](docs/coordination.md) — les copies du dépôt, la
> branche de prod, les règles anti-collision.

---

# Passation — 2026-08-26 (matin) · Cinq chantiers poussés, déployés ; refonte Calendrier + Fiche par Claude Design

| | |
|---|---|
| **Agent** | **Hermes Agent** — *je passe la main* (passation précédente : Claude Code, 25/08 soir) |
| **Branches** | `feat/ui-redesign-claude` = **prod, à jour = `d97f47d`** ; `chantiers-frontend-2026-08-25` (fusionnée en ff, à jour = `d97f47d`) |
| **Commits** | `d97f47d` = HEAD local + origin + **prod déployée** (8 commits d'avance sur l'ancienne prod `f3c2b70`) |
| **Base de la passation précédente** | `5b42116` (Claude Code, 25/08 soir) |

## Goal — l'objectif

Les cinq chantiers front-end de Claude Code (onde de capture, DnD Kanban,
chevauchement calendrier, fiche tâche, graphe) ont été **poussés et déployés
en prod** (accord explicite d'Aramis le 26/08 : « ok push … et déploie »).
La suite : Aramis a vu la preview et tranche deux **refontes Claude Design**
(calendrier desktop + fiche tâche desktop) — le terrain est prêt pour Claude
Design / le prochain agent.

## Current state — ce qui a été fait

### 1. Les 5 chantiers + la décision — poussés et DÉPLOYÉS (26/08)

- Branche `chantiers-frontend-2026-08-25` (7 commits : `c3ebd53`, `5e07462`,
  `dcad9ce`, `62ad6a6`, `e696f4f`, `6840e21` handoff, + `d97f47d` décision)
  poussée, puis **fast-forward dans `feat/ui-redesign-claude`** et push.
- **Prod déployée** via bundle+scp+ff (`/docker/brief` = `d97f47d`) +
  `docker compose --env-file .env.production up -d --build` — vérifiée par
  `GET /` 200 et API 401 sans PIN (26/08).
- Récap des 5 chantiers (causes racines + recettes mesurées : dans la
  passation précédente, archive `docs/handoffs/2026-08-25-cinq-chantiers-frontend-claude-code.md`).

### 2. Valids avant/après déploiement (26/08, Hermes)

- `npm run build` **réussi** (le portail jamais franchi : `next dev` ne
  tournait plus ; port 3000 = bridge WhatsApp). 26 routes compilées, warnings
  « Dynamic filesystem access » pré-existants sur `store.ts` (pas des erreurs).
- **Rendu mobile de la capture recetté** en Chromium 390×844 (seul chantier
  touchant du code partagé mobile : `CaptureSheet.tsx`, `BriefApp.tsx`,
  `Waveform.tsx`) : idle conforme au design system, listening → waveform
  pilotée par l'état React (micro stub → niveaux → `scaleY` varient), 0 erreur
  console.
- Preview publique HTTPS (localtunnel) servie à Aramis pour relecture sur
  téléphone + PC — c'est elle qui a déclenché les décisions de redesign.

### 3. Bug de déploiement attrapé au passage (26/08)

`npm run build` et `next start` étaient **interdits** ici tant qu'un dev
tournait… et le port 3000 de ce conteneur est **pris par le bridge WhatsApp**
(Express) — `next start` échouait en EADDRINUSE. Build seule, `next start` sur
3001 (courte recette), puis serveur standalone sur 3002 (isolé de la prod).

## Decisions — choix critiques (journal complet dans `DECISIONS.md`)

- **Calendrier desktop + fiche tâche → refonte complète par Claude Design
  (26/08, Aramis après la preview)**. Ne plus rafistoler ces deux écrans en
  code ; attendre le livrable `.dc.html` puis porter. Inscrit en tête de
  `DECISIONS.md` (2026-08-26) et dans `TODOS.md` (P1).
- Rappel : « une teinte désigne, elle ne décore jamais » — la palette
  d'étiquettes saturée reste un arbitrage produit ouvert (`TODOS.md`, P2).

## Changed — fichiers et composants

| Fichier | Nature |
|---|---|
| `DECISIONS.md` | +entrée 2026-08-26 (calendrier + fiche → Claude Design) |
| `TODOS.md` | sections mises à jour (P1) + fiche tâche ajoutée |
| `docs/handoffs/2026-08-25-cinq-chantiers-frontend-claude-code.md` | **NEW** — archive de la passation précédente |
| `HANDOFF.md` | cette passation |

(Les fichiers des 5 chantiers — `src/lib/waveform.ts`, `calendarLanes.ts`,
modifs `graph.ts`/`Desktop*`/`CaptureSheet`… — sont détaillés dans l'archive
ci-dessus ; `package-lock.json` et `AGENTS.md` intacts vérifié.)

## Validations

### ✅ Passants

| Commande / geste | Résultat |
|---|---|
| `npx eslint .` | 0 erreur (état de la branche, 25/08) |
| `npx tsc --noEmit` | propre (25/08) |
| `npx vitest run` | 325 passed, 1 skipped (25/08) |
| `npm run build` | **réussi** (26/08, exit 0) |
| Recette mobile capture (Chromium 390×844) | idle + listening conformes, 0 erreur console |
| Preview publique (localtunnel) | accessible, jeux de données de démo isolés |
| Prod | `GET /` 200, API 401 sans PIN (les) |

### ⚠️ Non lancés / À vérifier

1. **Le tirage de lien au doigt (graphe)** — ancres `mousedown` : non branché
   sur tactile. Le graphe reste desktop, mais à savoir.
2. **Le « +N » du calendrier au-delà de 4 voies** — testé à 4 événements
   simultanés, pas à 10 (le calendrier va de toute façon être redessiné).
3. **La synchro CalDAV** — pas de `.env.local` de production en local, test
   d'intégration toujours skipped.
4. **Démo preview locale** — `data/` du repo contient un `items.json`
   d'ÉCHANTILLON au format ancien (`dueAt`/`completedAt`, 3 items) ; pas
   touché, mais à ne pas confondre avec les vraies données.

## Blockers

**Aucun blocage technique.** Points d'attention :

- **`npm install` sous Windows abîme `package-lock.json`** (supprime les champs
  `libc`) — avant tout commit depuis Windows, `git diff --stat package-lock.json`
  doit être vide.
- **Le remote prod (/docker/brief) est HTTPS sans credentials** : se déployer
  par bundle+scp+ff (pas de push depuis le VPS). Voir `docs/coordination.md`.
- **Ne pas lancer `npm run dev` sur ce conteneur** (AGENTS.md) : le port 3000
  appartient au bridge WhatsApp ; `.next` vit dans `/opt/data/Projets/brief`
  (copie Hermes), PAS dans `/docker/brief`.

## Next — la prochaine action

1. **Aramis fournit les livrables Claude Design** pour le calendrier desktop et
   la fiche tâche → les porter selon le workflow éprouvé (analyser le `.dc.html`
   avec gstack, PUIS coder).
2. Trancher les deux arbitrages produit ouverts dans `TODOS.md` (filtre projet
   de « Non placées », palette d'étiquettes).
3. Quand les vrais statuts de tâche arriveront : ne toucher que `graphStatus()`
   dans `src/lib/graph.ts` (décision 24/08).

---

## Historique des passations

| Date | Sujet | Agent | Fiche |
|---|---|---|---|
| **2026-08-26 (matin)** | **Cinq chantiers poussés et déployés ; refonte Calendrier + Fiche par Claude Design** | **Hermes Agent** | *(cette passation)* |
| 2026-08-25 (soir) | Cinq chantiers front-end : waveform, DnD Kanban, calendrier, fiche, graphe | Claude Code | [fiche](docs/handoffs/2026-08-25-cinq-chantiers-frontend-claude-code.md) |
| 2026-08-25 (matin) | État du repo + défi Kanban/dépendances/Graphe pour Claude Code | Hermes Agent | [fiche](docs/handoffs/2026-08-25-hermes-etat-repo-mission-bugs.md) |
| 2026-08-24 (après-midi) | Vue Graphe et recette de l'existant | Claude Code | [fiche](docs/handoffs/2026-08-24-graphe-recette-claude-code.md) |
| 2026-08-24 (matin) | Kanban, tags, dépendances, fiche tâche, donut fix | Hermes Agent | [fiche](docs/handoffs/2026-08-24-kanban-tags-dependances-fiche.md) |
| 2026-08-23 (matin, 2e) | Desktop V1.1 : Réglages, priorités, IA, projets | Hermes Agent | [fiche](docs/handoffs/2026-08-23-hermes-kanban-tags-deps.md) |
| 2026-08-23 (matin) | Déploiement desktop V1 + audio/IA du 22/08 | Hermes Agent | [fiche](docs/handoffs/2026-08-23-hermes-deploy-desktop-v1.md) |
| 2026-08-23 (nuit) | Version desktop V1 (5 écrans, nav pilule, dashboard 3 cartes) | Claude Code | [fiche](docs/handoffs/2026-08-23-claude-code-desktop-v1.md) |
