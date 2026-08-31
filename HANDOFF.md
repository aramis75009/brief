# HANDOFF — Brief

**Ce fichier ne contient qu'une seule passation : la dernière.** Avant de
travailler, lis-le en entier. Avant de partir, remplace-le et archive celui
que tu remplaces dans `docs/handoffs/`.

> **Multi-agents** : si tu n'es pas l'agent qui a écrit la dernière passation,
> tu reprends la main explicitement (nouvelle entrée). Lis aussi
> [`docs/coordination.md`](docs/coordination.md).

---

# Passation — 2026-08-31 (matin) · Kanban « copie Trello » codé, recetté, relu · 9 trouvailles corrigées

| | |
|---|---|
| **Agent** | **Claude Code (Opus 5)**. Même agent que la passation précédente — session coupée en cours de chantier, reprise le 31/08 vers 10 h 45. |
| **Branche** | `feat/kanban-trello` · **Base** `main` (`fb39b9c`) |
| **GitHub** | `origin/main` = `fb39b9c`. **[PR #9](https://github.com/aramis75009/brief/pull/9) ouverte** — 5 commits, +2749 −521 sur 19 fichiers. |
| **Prod** | inchangée depuis la passation précédente. PR #7 **toujours pas déployée** (voir Blockers). |

## Goal

Chantier A du plan `docs/plans/2026-08-31-kanban-trello-calendrier.md` — le
Kanban « copie Trello » : glisser-déposer réel des cartes et des colonnes,
suppression de colonne qui ne perd plus les cartes, échec qui cesse d'être muet.

## Current state

**T1 → T12 faits. T13 à moitié.** Le détail par tâche est dans le plan, cases
cochées, avec une section « État au 2026-08-31, 11 h » en fin de fichier.

### La session coupée avait laissé trois choses cassées

La reprise a commencé par lancer les trois commandes. Ce qu'elles ont trouvé :

1. **`Item.columnOrder` n'existait pas dans `types.ts`.** Le champ était écrit
   dans `store.ts`, `kanban.ts`, les deux sanitizers et la route neuve —
   partout sauf dans le type. **18 erreurs `tsc`, zéro test en échec** : Vitest
   ne typecheck pas. C'est le profil d'erreur exact que la règle « les trois
   commandes avant chaque commit » existe pour attraper.
2. **`DesktopShell.tsx` n'avait jamais été touché.** `handleMoveCard(itemId,
   columnId)` gardait l'ancienne signature et passait par `onSaveItem` — le
   chemin que le plan interdit (A.5 : un toast « Modifications enregistrées »
   par carte renumérotée). `onReorderColumns`, `onAddCard` et `onSetWip`
   n'étaient branchés nulle part : colonnes déplaçables, composeur « + » et
   limite WIP étaient du code mort côté écran.
3. **Deux erreurs ESLint** dans `DesktopKanban` : `previewRef.current = preview`
   en corps de rendu, et `useEffect(() => setName(column.name))`.

### Un vrai bug trouvé par un test neuf

**`reorder` ne réordonnait rien.** Régression introduite par la réécriture
d'A.10 : `renumber()` re-triait les colonnes sur leur ancien `order` juste après
le tri demandé, l'annulant. Réponse **200, board inchangé** — invisible côté
client. Trouvé par le premier test jamais écrit sur `/api/board`
(`src/app/api/board/route.test.ts`, 19 cas). Corrigé : `renumber` numérote dans
l'ordre du tableau reçu, `delete` trie explicitement avant.

### Ce que la reprise a ajouté au-delà du plan

- **T11 (limite WIP)** entièrement recâblée : `wipLimit` sur `KanbanColumn`,
  action `wip` sur `PATCH /api/board`, `setColumnWip()` client, entrée de menu.
  **Indicative** (la colonne pleine accepte le dépôt) et **comptée sur la
  colonne complète**, pas sur les cartes visibles — sous filtre projet, un
  compte à l'écran passerait au vert à tort.
- **Suppression de colonne en deux temps**, nommant le compte réel : « Supprimer
  « À faire » ? 7 cartes repartent en Non placées. » Pas de `window.confirm`
  (aucun autre écran n'en utilise).
- **Les cinq `catch` muets de `DesktopShell` sont remplacés par des toasts
  `err`.** Le succès reste muet — décision, pas oubli (Trello ne dit rien).

### `/code-review high` — 9 trouvailles, 9 corrigées

Lancée sur le diff complet. **Aucune n'était un faux positif** ; toutes
vérifiées dans le code avant correction.

| # | Trouvaille | Correction |
|---|---|---|
| 1 | `moveCardPlan` retassait la colonne QUITTÉE. Or `columnId: null` n'est pas une colonne : c'est tout ce qui n'a jamais été posé sur le board. Sortir la 1re carte des « Non placées » d'un compte à 400 items produisait **400 patches** et tamponnait un `columnOrder` sur des idées et des items archivés | **Retassage supprimé, pas seulement pour `null`.** Il était inutile dans tous les cas : le tri gère les trous, et la colonne CIBLE est de toute façon renumérotée en entier. 2 tests neufs |
| 2 | La carte **revenait visuellement à sa place d'origine** entre le dépôt et le rafraîchissement (`setPlan(null)` synchrone), et la réponse du serveur (`MovedCard[]`) était **jetée** | `onMoveCard` rend une promesse ; l'aperçu ne s'efface qu'une fois la requête rendue |
| 3 | La suppression de colonne sautait la relecture des items sur un compte **client** (`cardCount > 0`), périmé si une carte a été posée depuis un autre onglet, l'iPhone ou la synchro CalDAV → carte à `columnId` mort, invisible : **le bug même que cette PR corrige** | Relecture **inconditionnelle** |
| 4 | Le mode « récupération » de `detachColumn` (3ᵉ argument) **n'avait aucun appelant** : la prod porte déjà des orphelines des suppressions passées, que rien ne réparait | Passe de récupération dans `GET /api/board`. Écriture bornée : plan vide dès que le board est sain. 3 tests neufs |
| 5 | L'action `delete` écrivait des items **sans réconcilier les objectifs** — la liste blanche de champs que l'invariant `AGENTS.md` interdit explicitement | `reconcileObjectivesInStore()` après détachement. 2 tests neufs |
| 6 | `commitWip` refusait `0` et `1000` **en fermant le champ sans rien dire** — indiscernable d'un enregistrement réussi | La saisie est assainie à la frappe (pas de zéro en tête, 3 chiffres max) : l'état invalide devient inatteignable |
| 7 | `useSortable` pose `role="button"` sur la carte, qui **contient** le bouton « ouvrir » → ARIA invalide (plusieurs lecteurs d'écran aplatissent les enfants et masquent ce bouton). Le commentaire affirmait à tort que ce bouton était le seul élément focusable | `attributes: { role: "group" }`. Les pilules « Non placées » gardent `role="button"` — elles ne contiennent aucun bouton. Commentaire corrigé |
| 8 | `normalizeItem` acceptait `-3` et `2.5` (`Number.isFinite`) là où les deux chemins d'écriture exigent un entier ≥ 0 | Même test partout |
| 9 | Import `useEffect` mort | Retiré |

**Contre-recette après corrections** (le `role` et le cycle de vie de l'aperçu
touchaient du comportement déjà recetté) : `role="group"` confirmé sur la carte
et `role="button"` sur les pilules · **clavier toujours fonctionnel** (Espace →
↓ → Espace déplace et persiste) · champ WIP : `0` → vide, `0007` → `7`,
`12345` → `123` · et surtout, **réseau totalement coupé** (`/api/board/cards`
ET `/api/items`) → toast affiché, carte restée à sa place, **zéro rejet non
capturé**.

## Decisions

Rien de neuf à porter dans `DECISIONS.md`. Les décisions de conception sont
celles du plan, déjà arbitrées par `/autoplan` le 30/08.

Une décision de méthode, prise pendant la reprise et assumée :

- **T13, moitié restante (sortir `KanbanColumnView` dans son fichier) : non
  fait.** Déplacer ~350 lignes dans un diff de ~1 100 lignes que personne n'a
  relu, git le rend comme une suppression plus un ajout — la revue y perdrait.
  À faire dans son propre commit **après** `/code-review`.

## Blockers

1. **PR #7 non déployée** — inchangé depuis la passation précédente. Le 202 du
   webhook ne prouve rien : garde-fou d'approbation Telegram, Hermes doit être
   en session.
2. **Pas de SSH vers le VPS depuis le Mac.**

## Next — la prochaine action

1. **Faire relire et merger la [PR #9](https://github.com/aramis75009/brief/pull/9).**
2. **La déployer** — elle ne l'est pas, et PR #7 ne l'est toujours pas non
   plus. Voir Blockers.
3. Reste des chantiers : **B (calendrier)**, suspendu à un arbitrage humain
   (`DECISIONS.md` 2026-08-26, le livrable Claude Design n'est jamais venu) —
   voir chantier B du plan, et les six points « Signalé, non traité » à porter
   dans `TODOS.md`, dont **`caldavSyncedDue`** (divergence silencieuse avec
   iCloud, préalable technique à toute UI de planification).

## Validations — passants / échoués / non lancés

```
$ npx eslint .       → 0 erreur (28 warnings préexistants, −2)
$ npx tsc --noEmit   → 0 erreur
$ npx vitest run     → 531 passants, 1 skipped (41 fichiers)   [+26 sur la reprise]
```

- **Passant, en live sur le dev local** : `GET /` → 200 · `GET /api/board` sans
  session → 401 · `PATCH /api/board/cards` sans session → 401 (la route neuve
  est compilée et gardée).
### Recette navigateur — faite, sur le dev local, connecté

Aramis s'est connecté via `browse handoff` sur `http://localhost:3100`. Le
glisser-déposer a été piloté par **événements pointeur réels** (`browse` n'a pas
de commande `drag` — voir la mémoire `browse-drag-dnd-kit`). **Neuf gestes,
neuf passants, zéro erreur console :**

| # | Geste | Résultat |
|---|---|---|
| 1 | Carte « Non placées » → colonne « À faire » | placée, **rang conservé après rechargement** |
| 2 | Carte déposée **sur une carte précise** (contrat voisin-relatif A.3) | insérée au bon rang, conservé après rechargement |
| 3 | Carte d'une colonne → « Non placées » | sortie du board (impossible avant) |
| 4 | Colonne « Fait » tirée par sa pastille en tête | `Fait → À faire → En cours`, **persisté** |
| 5 | Suppression de « À faire » (2 cartes) | confirmation « **2 cartes repartent en Non placées** », puis les 2 cartes **réapparaissent** et survivent au rechargement |
| 6 | « + » de colonne sous filtre projet « My Flip » | carte créée **visible sous le filtre** (elle a hérité du projet), champ resté ouvert |
| 7 | Limite WIP 1 sur une colonne, puis dépôt d'une 2ᵉ carte | compteur `2/1` + bordure rouge danger, **et le dépôt est accepté** (indicative, pas prescriptive) |
| 8 | Clavier : focus carte → Espace → ↓ → Espace | carte déplacée, **persisté après rechargement** |
| 9 | `fetch` saboté sur `/api/board/cards`, puis dépôt | **toast « Le déplacement n'a pas été enregistré. »** et la carte revient à sa place serveur |

Les données d'Aramis ont été **remises comme trouvées** après la recette
(6 cartes en Non placées, colonnes `À faire / En cours / Fait`, aucune limite
WIP, carte de test supprimée). Vérifié à l'écran.

- **Non lancé** : `npm run build` (règle du repo — un `npm run dev` tourne sur
  le port 3100).
- **Non lancé** : la PR #9 n'est **pas déployée**. Elle ne tourne que sur le
  dev local.

## Changed — livré dans la PR #9 (5 commits bisectables)

| Fichier | Nature |
|---|---|
| `src/lib/types.ts` | `Item.columnOrder`, `KanbanColumn.wipLimit` |
| `src/lib/kanban.ts` + `.test.ts` | **neuf** — `sortColumnItems`, `columnItems`, `moveCardPlan`, `reorderColumnIds`, `detachColumn` |
| `src/app/api/board/route.ts` (`GET`) | passe de récupération des orphelines des suppressions passées |
| `src/lib/store.ts` | `updateItemsAtomically`, `updateBoardAtomically`, `normalizeItem` normalise `columnOrder` |
| `src/app/api/board/cards/route.ts` + `.test.ts` | **neuve** — `PATCH`, intention voisin-relative, calcul en file |
| `src/app/api/board/route.ts` | `delete` détache les cartes · action `wip` · les 5 actions en file · **fix `renumber`** |
| `src/app/api/board/route.test.ts` | **neuf** — 19 cas, la route n'en avait aucun |
| `src/app/api/items/route.ts`, `items/[id]/route.ts` | `coerce` / `sanitizePatch` acceptent `columnId` + `columnOrder` |
| `src/lib/api.ts` | `moveCard()`, `setColumnWip()` |
| `src/components/desktop/DesktopKanban.tsx` | réécriture dnd-kit multi-conteneur, WIP, confirmation de suppression, composeur |
| `src/components/desktop/KanbanCard.tsx` | cesse d'être un `<button>` ; bouton « ouvrir » au survol ; radius 18 |
| `src/components/desktop/DesktopShell.tsx` | tous les gestes du board câblés, toasts `err` |
| `src/components/BriefApp.tsx` | `quickAddTask` accepte `columnId` ; `onRefreshItems` / `onFlash` passés au desktop |
| `docs/plans/2026-08-31-kanban-trello-calendrier.md` | **neuf** — le plan `/autoplan`, cases à jour |

---

## Historique des passations

| Date | Sujet | Agent | Lien |
|---|---|---|---|
| 2026-08-31 (matin) | Kanban Trello codé et vert, recette bloquée sur la connexion | Claude Code (Opus 5) | (cette passation) |
| 2026-08-31 (nuit) | Réglages desktop déployés + première recette navigateur | Claude Code (Opus 5) | [fiche](docs/handoffs/2026-08-31-nuit-reglages-desktop-recette-navigateur.md) |
| 2026-08-30 (nuit, tard) | Accès agenda machine + Réglages derrière le profil — PR #4 et #5 | Claude Code (Opus 5) | [fiche](docs/handoffs/2026-08-30-nuit-tard-agenda-machine-reglages.md) |
| 2026-08-30 (nuit) | Graphe & Objectifs déployé + recette round 1 | Claude Code | [fiche](docs/handoffs/2026-08-30-nuit-graphe-objectifs-deploye-recette1.md) |
| 2026-08-30 (soir) | Graphe & Objectifs, le moteur — PR #3 | Claude Code | [fiche](docs/handoffs/2026-08-30-graphe-objectifs-moteur-pr3.md) |
| 2026-08-30 (session) | Chantier Objectifs & Projets codé, recette à faire | Hermes Agent | [fiche](docs/handoffs/2026-08-30-hermes-objectifs-projets-recette.md) |
