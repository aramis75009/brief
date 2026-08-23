# Plan — Kanban + Tags + Sous-tâches + Dépendances visuelles (v2)

> **Pour Hermes:** Exécuter tâche par tâche, commits fréquents, tests à chaque étape.

**Goal:** Transformer Brief desktop en un "Asana personnalisé" : vue Kanban avec colonnes libres (comme Trello), tags/étiquettes colorées (comme Trello), sous-tâches, et dépendances visuelles entre tâches (nœuds comme n8n).

**Architecture:** Nouvel écran desktop `DesktopKanban.tsx` + extensions du modèle de données + nouveau composant `DependencyGraph.tsx`. Mobile inchangé.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, Vitest. Drag & drop : `@dnd-kit/core` + `@dnd-kit/sortable`. Vue nœuds : `reactflow`.

---

## Changements vs v1 (retours Aramis 23/08)

1. **Colonnes LIBRES** (comme Trello) — pas dérivées d'un statut. L'utilisateur crée, nomme, réordonne ses colonnes. Bouton "+ Ajouter une liste". Stockées dans `boards.json`.
2. **Tags = étiquettes Trello** — palette de couleurs, créer/modifier/supprimer, mode daltonien. Stockés dans `tags.json`.
3. **Plus de `startedAt`** sur Item — les colonnes ne sont plus dérivées d'un statut, c'est l'utilisateur qui place ses cartes où il veut.
4. **`columnId` sur Item** — référence vers une colonne du board. Si null → carte non placée (boîte de réception).

---

## Tâches

### Phase 1 : Modèle de données

#### Tâche 1 : Étendre le type Item + nouveaux types

**Files:** Modify `src/lib/types.ts`

Sur `DraftItem` :
- `tags?: string[]` — IDs de tags
- `dependsOn?: string[]` — IDs d'items prédécesseurs
- `columnId?: string | null` — ID de colonne Kanban (null = non placé)

Nouveaux types :
```ts
type KanbanColumn = {
  id: string;
  name: string;        // nom libre, défini par l'utilisateur
  order: number;       // position dans le board
};

type KanbanBoard = {
  columns: KanbanColumn[];
  updatedAt: string;
};

type Tag = {
  id: string;
  name: string;
  color: string;       // nom de couleur (comme Trello : jaune, orange, rouge, violet, bleu, vert, teal, marron, rose, sky)
};
```

#### Tâche 2 : Stockage boards.json + tags.json

**Files:** Modify `src/lib/store.ts`

- `readBoard()` / `writeBoard()` — lit/écrit `boards.json`
- `readTags()` / `writeTags()` — lit/écrit `tags.json`
- `normalizeItem()` garantit `tags: []`, `dependsOn: []`, `columnId: null` par défaut

#### Tâche 3 : API routes

**Files:** Create `src/app/api/board/route.ts`, `src/app/api/tags/route.ts`. Modify `src/app/api/items/[id]/route.ts`

- `GET /api/board` — retourne le board (colonnes)
- `PATCH /api/board` — ajoute/renomme/réordonne/supprime une colonne
- `GET /api/tags` — retourne tous les tags
- `POST /api/tags` — crée un tag
- `PATCH /api/tags/[id]` — modifie un tag
- `DELETE /api/tags/[id]` — supprime un tag
- `PATCH /api/items/[id]` accepte `tags`, `dependsOn`, `columnId`

Toutes gardées par PIN.

### Phase 2 : Vue Kanban (colonnes libres comme Trello)

#### Tâche 4 : Installer @dnd-kit

```bash
npm install @dnd-kit/core @dnd-kit/sortable
```

#### Tâche 5 : DesktopKanban.tsx — board avec colonnes libres

**Files:** Create `src/components/desktop/DesktopKanban.tsx`

- Colonnes rendues depuis `board.columns` (triées par `order`)
- Bouton "+ Ajouter une liste" à droite (comme Trello)
- Renommer une colonne : double-clic sur le titre
- Supprimer une colonne : menu "..." → les cartes retournent en non placées
- Drag & drop :
  - Cartes entre colonnes (change `columnId`)
  - Réordonnancement dans une colonne
  - Réordonnancement des colonnes

#### Tâche 6 : KanbanCard.tsx — carte individuelle

**Files:** Create `src/components/desktop/KanbanCard.tsx`

Affiche :
- Pastille projet (couleur + forme)
- Titre
- Tags (pills colorées)
- Compteur sous-tâches (ex: "3/5")
- Échéance
- Badge dépendances (ex: "⚠ 2")
- Click ouvre la fiche (panneau détail Calendrier)

#### Tâche 7 : Câbler dans DesktopShell

**Files:** Modify `src/components/desktop/DesktopShell.tsx`, `DesktopHeader.tsx`, `types.ts`

- Ajouter "Kanban" dans `NAV_ITEMS` et `DesktopScreen`
- Router vers `DesktopKanban` quand `screen === "kanban"`
- Passer `items`, `projects`, `board`, `tags`, `onMoveCard`, `onAddColumn`, etc.

#### Tâche 8 : Tests — logique board

**Files:** Create `src/lib/kanban.test.ts`

- Ajout/suppression/renommage colonne
- Déplacement de carte (change `columnId`)
- Réordonnancement colonnes
- Cartes sans `columnId` → section "Non placées" à gauche

### Phase 3 : Tags (étiquettes Trello)

#### Tâche 9 : TagManager.tsx — gestion des étiquettes

**Files:** Create `src/components/desktop/TagManager.tsx`

Modal (comme Trello) :
- Liste des tags existants avec badge couleur + nom + bouton edit
- Recherche "Parcourir les étiquettes..."
- Bouton "Créer une nouvelle étiquette" (nom + choix couleur dans palette)
- Palette de couleurs Trello : jaune, orange, rouge, violet, bleu, vert, teal, marron, rose, sky
- Bouton "Activer la version pour personnes daltoniennes" (ajoute initiale sur le badge)

#### Tâche 10 : Tags sur les cartes + tâches

**Files:** Modify `KanbanCard.tsx`, `DesktopTasks.tsx`

- Tags affichés en pills colorées sur les cartes Kanban et lignes de tâches
- Click sur un tag filtre par ce tag

#### Tâche 11 : Tests — tags

**Files:** Create `src/lib/tags.test.ts`

- Création/modification/suppression tag
- Validation (nom non-vide, couleur dans la palette)
- Application sur un item (max 10)

### Phase 4 : Sous-tâches (déjà présentes, à afficher)

#### Tâche 12 : Sous-tâches sur la carte Kanban

**Files:** Modify `KanbanCard.tsx`

- Compteur "3/5" si l'item a des subtasks
- Click déploie la liste avec checkboxes
- Cocher appelle `onSaveItem` avec la subtask modifiée

#### Tâche 13 : Sous-tâches éditables sur la fiche détail

**Files:** Modify le panneau de détail (DesktopCalendar)

- Section "Sous-tâches" : liste + champ pour ajouter
- Checkboxes + bouton supprimer

### Phase 5 : Dépendances (vue nœuds n8n)

#### Tâche 14 : Installer reactflow

```bash
npm install reactflow
```

#### Tâche 15 : DependencyGraph.tsx — vue nœuds

**Files:** Create `src/components/desktop/DependencyGraph.tsx`

- Chaque item = nœud (carte compacte : titre + pastille projet + statut)
- `dependsOn` = edges (flèches entre nœuds)
- Nœuds draggables, zoom/pan
- Couleur nœud : vert (dépendances terminées) / orange (en cours) / rouge (bloqué)

#### Tâche 16 : Câbler DependencyGraph dans DesktopShell

**Files:** Modify `DesktopShell.tsx`, `DesktopHeader.tsx`

- Onglet "Graphe" dans la nav

#### Tâche 17 : Éditer les dépendances depuis la fiche

**Files:** Modify le panneau de détail (DesktopCalendar)

- Section "Dépendances" : liste + recherche d'item + lien cliquable + supprimer

### Phase 6 : Tests + déploiement

#### Tâche 18 : Tests dépendances

**Files:** Create `src/lib/dependencies.test.ts`

- Pas de cycle (détection à l'ajout)
- Max 20 dépendances
- IDs existants

#### Tâche 19 : Build + typecheck + tests

```bash
npx tsc --noEmit && TZ=UTC npx vitest run && npm run build
```

#### Tâche 20 : Commit + push + deploy

#### Tâche 21 : Passation

---

## Risques

- **@dnd-kit + reactflow** : ~120KB, desktop-only, acceptable
- **Colonnes libres** : plus de complexité (board persistant) mais correspond exactement à ce qu'Aramis veut (comme Trello)
- **Pas de cycles de dépendances** : détection simple à l'ajout
- **Performance reactflow** : 27 items = aucun souci

## Non couvert

- Vue Timeline / Gantt
- Vue Table / Spreadsheet
- AI suggestions proactives