# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui que
tu remplaces dans `docs/handoffs/`.

> **Multi-agents** : si tu n'es pas l'agent qui a écrit la dernière passation,
> tu reprends la main explicitement (nouvelle entrée). Lis aussi
> [`docs/coordination.md`](docs/coordination.md) — les copies du dépôt, la
> branche de prod, les règles anti-collision.

---

# Passation — 2026-08-24 (matin) · Kanban, tags, dépendances, fiche tâche, donut fix

| | |
|---|---|
| **Agent** | Hermes Agent (glm-5.2 via Ollama Cloud) |
| **Branche** | `feat/ui-redesign-claude` — **la branche que sert le VPS** |
| **Commits** | `8c740e1` (head) — déployé en prod |
| **Prod** | https://brief.srv1899780.hstgr.cloud — `brief-app-1 Healthy` |
| **Tests** | `TZ=UTC npx vitest run` ✅ 262 passed ; `npx tsc --noEmit` ✅ |

## Goal — l'objectif

Transformer Brief desktop en un "Asana personnalisé" : Kanban avec colonnes
libres, tags/étiquettes (style Trello), sous-tâches éditables, dépendances
entre tâches, et une fiche tâche desktop digne de ce nom.

## Current state — ce qui a été fait (depuis la dernière passation)

### Kanban v2 (Claude Design)

- **Filtres projets** en chips cliquables en haut (toggle par projet)
- **Compteur "N ouvertes"** à côté du titre
- **Section "Non placées"** avec cartes en pilules horizontales draggables
- **WIP limit** affiché sur les colonnes
- **Colonnes libres** : créer (bouton "+ Ajouter une liste"), renommer
  (double-clic), supprimer (×), drag & drop entre colonnes via @dnd-kit
- **Cartes** : tags en barres compactes (28×8px), badge "bloquée" avec cadenas,
  mini waveform si audio, compteur sous-tâches avec barre de progression,
  pastille projet + échéance
- **Note en bas** : "Une liste vide se supprime seule au bout de 30 jours"

### Fiche tâche desktop (DesktopTaskDetail.tsx)

- **Layout 2 colonnes** centré (max-w-1080px mx-auto) — gauche : contenu,
  droite : sidebar méta
- **Barre d'actions en haut** : Modifier, Reporter, Supprimer (icône), Terminer
- **Breadcrumb** "TÂCHES / Projet"
- **Bandeau de blocage** : "Bloquée par N tâche(s)" + bouton "Terminer d'abord"
  si l'item a des dependsOn non terminés
- **Chaîne AVANT/ICI/APRÈS** repliable (ouverte par défaut) avec bouton
  "+ Lier une tâche…" (DependencyPicker avec recherche + pastilles projet)
- **Étiquettes** : pilules nommées colorées + TagPicker (+ Étiquette) avec
  création (nom + ColorPicker en pastilles françaises : Bleu, Rouge, etc.)
- **Audio** : fil d'origine (waveform + transcription dépliable + citation
  surlignée) / enregistrement vocal / section vide discrète
- **Sous-tâches éditables** : checkboxes + progress bar + champ d'ajout
  (Enter pour créer) + items liés (siblings + dépendances)
- **Sidebar** : projet (pastille + calendrier Apple), échéance, étiquettes,
  bloqué par, historique (créée/terminée/sync CalDAV)
- **Click-outside** pour fermer TagPicker et DependencyPicker
- **Suppression de dépendance** : bouton × séparé (pas un span dans un button)

### Tags / Étiquettes

- **API** : `GET/POST /api/tags`, `PATCH/DELETE /api/tags/[id]` (PIN gardé)
- **Stockage** : `tags.json` dans `BRIEF_DATA_DIR`
- **Palette** : 10 couleurs (yellow, orange, red, purple, blue, green, teal,
  brown, pink, sky) avec labels français
- **ColorPicker** : pastilles cliquables (pas de select dropdown)
- **TagManager dans Réglages** : créer/modifier/supprimer des étiquettes
  avec ColorPicker
- **Sur la fiche** : TagPicker avec tags existants + création
- **Sur les cartes Kanban** : barres compactes colorées (nom au title attr)

### Dépendances

- **Modèle** : `Item.dependsOn: string[]` (IDs d'items prédécesseurs)
- **API** : `PATCH /api/items/[id]` accepte `dependsOn` (sanitizePatch corrigé)
- **Chaîne** : AVANT (dependsOn) / ICI (item courant) / APRÈS (items qui
  dépendent de celui-ci, calculé depuis items[])
- **DependencyPicker** : recherche + pastilles projet + échéance courte
- **Bandeau de blocage** en tête de fiche si dépendances non terminées
- **Suppression** : bouton × à côté de chaque dépendance dans la chaîne

### Dashboard

- **Donut "Aujourd'hui"** : compte les tâches du jour (depuis items[],
  pas depuis l'agenda qui exclut les doneAt). Bug du 0% corrigé.
- **Label "Cette semaine"** au-dessus des barres de progression
- **weekProgressByProject** : limit 3 → 8 (tous les projets visibles)
- **"Demander à l'IA"** en noir (fond C.ink, texte blanc)
- **Copywriting** : "Parle. Je m'occupe du reste."

### Coche de validation (desktop + mobile)

- **CheckIcon** blanche sur fond noir quand doneAt (avant : point blanc 8px)
- **Toast** "Tâche terminée ✓" / "Tâche rouverte" (avant : seulement
  pour les récurrences)

### Projets

- **Fake** (tint 8 marron #A2845E) et **Permis** (tint 7 orange #FF9500)
  ajoutés comme vrais projets
- **"Ia" corrigé en "IA"** dans SEED_PROJECTS et projects.json
- **Mapping CalDAV** : Fake et Permis ajoutés
- **EXTRA_AGENDA_CALENDARS supprimé** : Fake est un vrai projet maintenant
- **calendarMapping.ts** : fichier client-safe pour DesktopSettings

## Decisions — choix critiques

- **Colonnes Kanban libres** (comme Trello) — pas dérivées d'un statut.
  L'utilisateur crée, nomme, réordonne. Stockées dans `boards.json`.
- **Tags en pastilles** (pas de select dropdown) — labels français, 10 couleurs
- **Click-outside** pour fermer les pickers (useEffect + mousedown listener)
- **Donut = aujourd'hui, barres = semaine** — labels clairs
- **Pas de `startedAt`** sur Item — les colonnes ne sont pas dérivées d'un
  statut, c'est l'utilisateur qui place ses cartes

## Changed — fichiers principaux

| Fichier | Nature |
|---|---|
| `src/components/desktop/DesktopKanban.tsx` | Réécrit (filtres, non placées, WIP, colonnes libres) |
| `src/components/desktop/KanbanCard.tsx` | Réécrit (tags barres, badge bloquée, waveform, progress) |
| `src/components/desktop/DesktopTaskDetail.tsx` | Réécrit (2 colonnes, bandeau, chaîne, étiquettes, pickers) |
| `src/components/desktop/DesktopSettings.tsx` | +TagManager (créer/modifier/supprimer étiquettes) |
| `src/components/desktop/DesktopDashboard.tsx` | Donut fix + labels + "Cette semaine" |
| `src/components/desktop/DesktopTasks.tsx` | CheckIcon au lieu de point blanc |
| `src/components/desktop/DesktopShell.tsx` | Câblage Kanban + TaskDetail + tags + deps |
| `src/components/desktop/DesktopHeader.tsx` | Onglet "Kanban" ajouté |
| `src/components/desktop/types.ts` | +DesktopScreen "kanban", "détail", "graphe" |
| `src/components/HomeScreen.tsx` | RowCheckbox : fond noir + CheckIcon blanche |
| `src/components/BriefApp.tsx` | Toast "Tâche terminée ✓" + onDeleteItem prop |
| `src/lib/types.ts` | +tags, +dependsOn, +columnId sur DraftItem ; +KanbanColumn, KanbanBoard, Tag, TagColor, TAG_COLORS |
| `src/lib/store.ts` | +readBoard/writeBoard, +readTags/writeTags, normalizeItem (+tags/dependsOn/columnId) |
| `src/lib/caldav.ts` | +Fake, +Permis dans mapping ; EXTRA_AGENDA_CALENDARS supprimé |
| `src/lib/projects.ts` | +Perso, Sport, IA (corrigé), Fake, Permis dans SEED_PROJECTS |
| `src/lib/calendarMapping.ts` | **NEW** — mapping client-safe |
| `src/lib/api.ts` | +fetchBoard, addColumn, renameColumn, deleteColumn, fetchTags, createTag, updateTag, deleteTag |
| `src/app/api/board/route.ts` | **NEW** — GET/PATCH board |
| `src/app/api/tags/route.ts` | **NEW** — GET/POST tags |
| `src/app/api/tags/[id]/route.ts` | **NEW** — PATCH/DELETE tag |
| `src/app/api/items/[id]/route.ts` | sanitizePatch : +columnId, +tags, +dependsOn, +subtasks |
| `src/app/globals.css` | p7/p8 : Permis orange, Fake marron |

## Validations

| Commande | Résultat |
|---|---|
| `npx tsc --noEmit` | ✅ propre |
| `TZ=UTC npx vitest run` | ✅ 262 passed |
| Prod HTTP | ✅ 200 |
| Conteneur | ✅ Healthy |
| Sync CalDAV | ✅ Forcé, Fake découvert |

## Blockers

Aucun. Prod saine sur `8c740e1`.

## Points à connaître

1. **Vue graphe (nœuds n8n)** : le prompt Claude Design est prêt (voir plus
   bas). Aramis va le donner à Claude Design via son MCP. Le prototype `.dc.html`
   devra être implémenté avec `reactflow`.
2. **Calendrier desktop buggé** : reporté (gros chantier, TODOS.md)
3. **Priorités** : retirées de l'affichage, le modèle les garde. À rediscuter
   sur la méthode de saisie (Aramis veut les mettre lui-même)
4. **DESIGN.md §7** : nav horizontale réelle vs rail 248px décrit — pas corrigé
5. **Horizon 7 jours / Ton mur / Idées / Chaîne & sync** : retirés du Dashboard
   sur demande d'Aramis. Ne pas les faire réapparaître sans qu'il le redemande.
6. **Projet Fake** : l'unique événement Fake ("Commander les sacs Nike") est
   déjà doneAt. Les futurs événements seront adoptés avec projectId=fake.
7. **Sous-agent échoué** : un delegate_task a échoué (erreur modèle) pour
   réécrire les 3 composants. KanbanCard et DesktopKanban ont été faits par
   le sous-agent avant l'échec. DesktopTaskDetail a été fait manuellement.

## Next — la prochaine action

**C'est Claude Code qui reprend la main** (demande explicite d'Aramis) :

1. **Recevoir le prototype Claude Design** pour la vue graphe (nœuds n8n).
   Aramis va utiliser Claude Design via son MCP pour générer un `.dc.html`.
   Voir le prompt ci-dessous.

2. **Implémenter la vue graphe** avec `reactflow` :
   - Nouvel onglet "Graphe" dans la nav desktop
   - `src/components/desktop/DependencyGraph.tsx`
   - Nœuds = tâches, edges = dépendances (bézier curves)
   - États : vert (disponible), orange (en cours), rouge (bloquée), gris (terminée)
   - Zoom, pan, drag des nœuds
   - Filtres par projet + "Voir seulement les bloquées"
   - Panel de détail au clic, fiche complète au double-clic
   - `npm install reactflow`

3. **Corriger le calendrier desktop** (gros chantier, reporté)

4. **Scraper les concurrents** — matrice dans
   `docs/research/concurrents-matrix-2026-08-23.md`

5. **Écrire la prochaine passation** avant de repartir

### Prompt Claude Design pour la vue graphe

Le prompt est dans le message Telegram d'Aramis. Il décrit :
- Nœuds = tâches (pastille projet, titre, échéance, statut, tags, sous-tâches, audio)
- Edges = dépendances (bézier, plein si levée, pointillé si bloquante)
- Layout gauche→droite (AVANT → ICI → APRÈS)
- Zoom, pan, drag
- Filtres par projet + "Voir seulement les bloquées"
- Panel de détail au clic, fiche au double-clic
- États : vert/orange/rouge/gris
- Tokens Claude Design v1

---

## Historique des passations

| Date | Sujet | Agent | Fiche |
|---|---|---|---|
| **2026-08-24 (matin)** | **Kanban, tags, dépendances, fiche tâche, donut fix** | **Hermes Agent** | *(cette passation)* |
| 2026-08-23 (matin, 2e) | Desktop V1.1 : Réglages, priorités, IA, projets | Hermes Agent | [fiche](docs/handoffs/2026-08-23-hermes-kanban-tags-deps.md) |
| 2026-08-23 (matin) | Déploiement desktop V1 + audio/IA du 22/08 | Hermes Agent | [fiche](docs/handoffs/2026-08-23-hermes-deploy-desktop-v1.md) |
| 2026-08-23 (nuit) | Version desktop V1 (5 écrans, nav pilule, dashboard 3 cartes) | Claude Code | [fiche](docs/handoffs/2026-08-23-claude-code-desktop-v1.md) |
| 2026-08-22 (soir) | Audio storage, assistant IA, sheets, couleurs projets, perf iPhone | Hermes Agent | [fiche](docs/handoffs/2026-08-22-audio-storage-ia-sheets-couleurs.md) |