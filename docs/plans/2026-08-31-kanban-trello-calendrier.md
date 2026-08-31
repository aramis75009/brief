<!-- /autoplan restore point: ~/.gstack/projects/aramis75009-brief/feat-kanban-trello-autoplan-restore-20260830-232330.md -->

# Plan — Kanban « copie Trello » + calendrier desktop

**Branche :** `feat/kanban-trello` (chantier A) · **Base :** `main` (`fb39b9c`)
**Auteur :** Claude Code (Opus 5), 2026-08-31 · **Revue :** `/autoplan`
**Origine :** `TODOS.md` P1 « ⚠️ Bug Kanban » + P3 notes du 30/08 points **3** et **6**.

> **Révisé après trois voix indépendantes** (CEO, design, eng). Codex absent de
> la machine → `[subagent-only]`. Le plan initial avait un **défaut de
> conception central** (réindexation client sur liste filtrée) et **deux
> arguments produits faux**. Les deux sont corrigés ci-dessous.

---

## Ce que la revue a changé — résumé

| # | Trouvaille | Voix | Effet |
|---|---|---|---|
| **C1** | `coerce()` (`api/items/route.ts:39-57`) **ne lit pas `columnId`** — la création de carte au Kanban aurait produit une carte non placée | eng | A.6 refait |
| **C2** | Réindexer **côté client** sur `visibleItems` (filtré projet + `!doneAt` + `activeItems`) **écrase l'ordre des cartes masquées** | eng | **A.3 refait** |
| **C3** | Positions absolues + onglet périmé → **annule un déplacement fait ailleurs** | eng | **A.3 refait** |
| **C4** | Supprimer une colonne **orpheline ses cartes** : plus dans aucune colonne (`:568`), pas dans « Non placées » (`:401` teste `!columnId`). Le menu promet « **Vider** et supprimer » et ne vide rien. Déclenchable par le « + » | **CEO + design + eng** | **A.9, neuf** |
| **C5** | Le dépôt qui échoue est **muet** → la carte revient sans explication | design + eng | A.5 |
| **H1** | `(a ?? Infinity) - (b ?? Infinity)` = **`NaN`** — toutes les cartes au 1er chargement | eng | A.2 |
| **H2/H3** | `normalizeItem` et `sanitizePatch` ignoreraient `columnOrder` | eng | A.1 |
| **H4** | `PATCH /api/board` fait un lecture-modification-écriture **hors file** | eng | A.10 |
| **H6** | `useSortable` pose `role=button` sur un `<div>` qui enveloppe un `<button>` → **Espace ouvre la fiche au lieu de saisir** | design + eng | A.4 |
| **B!** | **`AgendaItem` n'a ni `rrule`, ni `dependsOn`, ni `priority`** et `durationMinutes` n'est jamais saisi → **3 des 4 différenciateurs de B ne sont pas constructibles** | design | **Chantier B refait** |
| **T!** | `Toast.tsx` + `flash()` **existent et tournent en desktop** (`BriefApp.tsx:888`) — `TODOS.md` #8 est faux | design | A.5 |

**Deux erreurs de raisonnement de ma part, corrigées :**

1. J'ai justifié la route dédiée par « N appels = N cycles concurrents avec le
   cron ». **Faux** : `serialize()` sérialise déjà toutes les écritures. La
   vraie raison est **l'atomicité d'un mouvement** (il touche 2 colonnes ; N
   appels laissent voir un ordre à moitié appliqué).
2. J'ai présenté quatre différenciateurs du calendrier comme acquis. **Trois
   n'existent pas dans `AgendaItem`.**

**Consensus des voix (2 sur 3 ou plus) :** C4 (perte de cartes) et C5 (échec
muet) sont remontés indépendamment par plusieurs voix. Signal fort.

---

# Chantier A — Kanban « copie Trello » (branche `feat/kanban-trello`)

## A.0 — Constats vérifiés dans le code

| # | Constat | Preuve |
|---|---|---|
| 1 | Aucune position stockée : l'ordre est celui d'écriture dans `items.json` | `DesktopKanban.tsx:568` ; `types.ts:123` |
| 2 | La cible de dépôt est la colonne entière, pas un interstice | `:142` `useDroppable({id: column.id})` |
| 3 | Colonnes non déplaçables — l'API `reorder` existe **sans appelant** | `api/board/route.ts` ; `api.ts:365` |
| 4 | **Le bouton « + » supprime la colonne** | `:250-268` |
| 5 | « Définir une limite (WIP) » est un bouton mort ; le champ n'existe pas | `:308-313` ; `types.ts:259` |
| 6 | La carte n'a pas de poignée : `<div>` draggable autour d'un `<button>` | `:54-66` + `KanbanCard.tsx:80` |
| 7 | TODO P1 « tags unplaced dans la mauvaise colonne » — **périmé** | `:398-401` |
| **8** | **Supprimer une colonne fait disparaître ses cartes** (C4) | `api/board/route.ts:54-64` |
| **9** | Le dépôt qui échoue est muet — 5 `catch { /* silencieux */ }` | `DesktopShell.tsx:113-138` |
| **10** | `DragOverlay` est **dans** le conteneur `overflow-x` → rogné, décalé au scroll | `:666` dans `:565` |
| **11** | « Non placées » n'est **pas** une cible de dépôt : on ne peut pas sortir une carte du board | `:529-562` |
| **12** | La limite WIP compterait les cartes **visibles** → ment sous filtre | `:147` |
| **13** | « Une liste vide se supprime seule au bout de 30 jours » — **texte sans code** | `:661` |

## A.1 — Modèle

```ts
/** Rang dans la colonne Kanban (0 = en haut). Absent = jamais rangée à la main. */
columnOrder?: number;
```

Trois écritures obligatoires, sans quoi le champ se perd en silence :

- **`normalizeItem`** (`store.ts:210-229`) : `Number.isFinite(it.columnOrder) ? it.columnOrder : undefined`. C'est la leçon du 19/08 appliquée à un nombre — un `"3"` venu d'un `items.json` édité à la main ne doit pas atteindre le comparateur.
- **`sanitizePatch`** (`api/items/[id]/route.ts`) : accepter `columnOrder` entier ≥ 0.
- **`coerce`** (`api/items/route.ts:39-57`) : accepter `columnId` **et** `columnOrder` (C1) — sinon le composeur A.6 crée des cartes hors colonne.

## A.2 — `src/lib/kanban.ts` (pur, testé, patron `graph.ts`)

| Fonction | Contrat |
|---|---|
| `sortColumnItems(items)` | Tri stable. **Comparateur à trois branches** — jamais `∞ − ∞` (H1) : les deux sans rang → égalité (ordre d'entrée) ; un seul sans rang → il passe après ; sinon comparaison numérique. |
| `moveCardPlan({ items, itemId, toColumnId, beforeId, afterId })` | Prend les **voisins**, pas un index (C2/C3). Rend `{ id, patch }[]` minimal. Tourne **côté serveur, sur la colonne complète**. |
| `reorderColumnIds(columns, activeId, overId)` | Liste d'ids ordonnée pour l'action `reorder`. |
| `detachColumn(items, columnId)` | Patches remettant `columnId: null`, `columnOrder: undefined` (A.9). |

**Tests** — dépôt en tête / milieu / queue ; changement de colonne ; dépôt sur
place (→ **zéro patch**) ; départ de « non placées » ; retour vers « non
placées » ; colonne vide ; item inconnu ; **rangs dupliqués** (état atteignable
à deux onglets) ; **items sans rang mélangés** (vérifier l'ordre, pas seulement
l'absence d'exception) ; **propriété** : jamais deux rangs égaux dans une
colonne, jamais un item perdu.

## A.3 — Le contrat serveur — **refait après la revue**

**Le client envoie une intention, pas des positions.**

```
PATCH /api/board/cards
{ itemId, toColumnId: string | null, beforeId?: string, afterId?: string }
```

`beforeId`/`afterId` sont les ids des cartes **voisines visibles** au point de
dépôt. Le serveur relit la colonne **complète** et calcule les rangs lui-même.

**Pourquoi c'est la seule forme correcte :** le client ne voit qu'un
sous-ensemble (filtre projet `:394`, `!doneAt` `:568`, `activeItems` seulement).
Lui faire calculer des positions absolues, c'est écraser l'ordre de ce qu'il ne
voit pas (C2) et ressusciter un déplacement fait dans un autre onglet (C3).

**Le calcul tourne DANS la file d'écriture.** Nouveau
`updateItemsAtomically(fn)` dans `store.ts`, calqué sur
`updateObjectivesAtomically` (`store.ts:183`) : `patchItems` relit bien dans
`serialize`, mais le **calcul** des patches se ferait avant, hors file, sur des
données périmées.

- Nom de route `/api/board/cards` et **pas** `/api/items/order` : un segment
  statique masque `[id]` dans l'App Router (M1).
- **Reste en `PATCH`.** Le préflight CORS est ce qui protège du CSRF ; un `POST`
  en content-type simple deviendrait une requête sans préflight capable de
  mélanger tout le board avec le cookie de la victime.
- `requireSession()` seul — **jamais** `requireSessionOrMachineToken` : c'est
  une route d'écriture (`AGENTS.md`).
- Validation : `Array.isArray` avant tout, ids typés `string` explicitement
  (`String(objet)` rend `"[object Object]"`), doublons refusés, `columnId`
  vérifié contre `readBoard()`.
- Réponse : **l'état frais des colonnes touchées**, pour que l'UI optimiste se
  réconcilie au lieu de croire un succès sur un item supprimé.
- `reconcileObjectivesInStore()` après écriture (invariant `AGENTS.md`).

## A.4 — UI dnd-kit (`sortable@10` + `core@6.3.1`, déjà installés)

L'API installée porte tout ce qu'il faut (`useSortable`, `setActivatorNodeRef`,
`sortableKeyboardCoordinates`, les deux stratégies, `MeasuringStrategy`).
**Le multi-conteneur, lui, n'est pas fourni par la bibliothèque : c'est le
morceau à écrire.**

- **Discriminant `active.data.current.type`** (`card` | `column`) dans les trois
  handlers. Deux ids droppables distincts par colonne (`col-x` pour la colonne,
  `col-x:body` pour la zone de cartes), sinon le dépôt en zone vide et le
  réordonnancement de colonne se disputent la même cible.
- **Détection composée** `pointerWithin` → `rectIntersection` → `closestCorners`.
  `closestCorners` seul vise la mauvaise colonne au-dessus d'une gouttière.
- `measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}` — sans
  quoi une colonne vidée en cours de glissement cesse d'être une cible.
- **Auto-scroll** : trois conteneurs défilants imbriqués (board `overflow-x`
  `:565`, colonne `overflow-y` `:324`, barre `:548`). Sans réglage, déposer dans
  une colonne hors écran est **impossible** — c'est bloquant pour « copie
  Trello ». Restreindre l'ancêtre défilant explicitement.
- **`DragOverlay` sorti** du conteneur `overflow-x` (A.0 #10).
- **La carte cesse d'être un `<button>`** (H6) : `KanbanCard` rend un `<div>`
  non focusable, la carte entière est saisissable (comportement Trello), et
  l'ouverture de la fiche passe par un bouton « ouvrir » révélé au survol —
  ce qui règle du même geste `TODOS.md` P3 #9 (hover Kanban). Sans ça, Espace
  ouvre la fiche au lieu de saisir la carte, et A.7 est inatteignable.
- **Poignée de colonne** : la pastille de l'en-tête (`setActivatorNodeRef`),
  sinon tirer une colonne rend le renommage inutilisable.
- **Indicateur de dépôt = placeholder Trello** : bloc gris `rgba(16,16,16,.05)`
  à la hauteur mesurée de la carte tirée, inséré à l'index cible, **la source
  retirée du flux** (pas `opacity: .4`). Le défaut dnd-kit (voisins qui se
  translatent) ne ressemble pas à Trello.
  → **Rayon : 18** (échelle `DESIGN.md` §2). Le 16 actuel de `KanbanCard.tsx:86`
  est hors échelle ; le placeholder allait le figer.
- **« Non placées » devient droppable** (A.0 #11).

## A.5 — L'échec cesse d'être muet

`Toast.tsx` + `flash()` **existent et sont montés en desktop**
(`BriefApp.tsx:182`, `:888`). `TODOS.md` P3 #8 se trompe en disant l'inverse.

- Échec du dépôt → retour à l'état serveur **+ toast `err`** « Le déplacement
  n'a pas été enregistré. »
- **Succès : muet** (Trello ne dit rien). C'est une décision, pas un oubli.
- **Ne pas** router le batch par `saveItemEdit` (`BriefApp.tsx:283`) : il flashe
  « Modifications enregistrées. » à chaque appel → 12 toasts pour un dépôt.
  Chemin dédié `onMoveCard` → `PATCH /api/board/cards` → mise à jour groupée.

## A.6 — Le bouton « + » (A.0 #4)

Règle Aramis : un bouton mort se câble, il ne se supprime pas. « + » ouvre un
composeur qui crée un vrai item.

- **Hérite du filtre projet actif.** Sans ça, créer une carte pendant qu'un
  filtre est posé produit une carte **immédiatement invisible**.
- Placement **en bas de colonne** (Trello) ; le champ **reste ouvert** après
  Entrée, la colonne défile pour suivre.
- `kind: "task"` par défaut ; Échap ferme ; titre vide refusé côté client (le
  serveur le refuse déjà, `coerce`).
- Dépend de C1 (`coerce` doit lire `columnId`/`columnOrder`).

## A.7 — Limite WIP (A.0 #5, #12)

- `KanbanColumn.wipLimit?: number` + action `wip` sur `PATCH /api/board`.
- **Indicative, pas prescriptive** : la colonne pleine accepte le dépôt et
  alerte (comportement Trello Plus). Bloquer demanderait d'expliquer le refus.
- Le seuil reste `>` (« limite 3 » alerte à 4), **mais compté sur la colonne
  complète**, pas sur la liste filtrée (A.0 #12).
- L'alerte passe à l'échelle de la colonne (bordure `:156`), pas sur un libellé
  mono de 10 px.

## A.8 — Clavier

`KeyboardSensor` + `sortableKeyboardCoordinates`. **Dépend de A.4** (la carte
doit cesser d'être un `<button>`).

## A.9 — Supprimer une colonne cesse de faire disparaître les cartes (C4) — **P1**

Trois voix sur trois l'ont signalé, dont deux comme critique.

- L'action `delete` (`api/board/route.ts:54-64`) remet `columnId: null` et
  `columnOrder: undefined` sur les items de la colonne, **dans la même écriture**.
- Le menu dit « Supprimer la liste » et non plus « Vider et supprimer » — il
  renvoie les cartes en « Non placées ». Réversible, proche de l'archivage Trello.
- Confirmation nommant le compte : « Supprimer « À faire » ? Ses 7 cartes
  repartent en Non placées. »
- **Passe de récupération** : les items dont le `columnId` pointe une colonne
  disparue sont déjà invisibles en prod. `readBoard` + balayage au chargement.
- La note « se supprime seule au bout de 30 jours » (A.0 #13) est retirée :
  texte sans code, même règle que « jamais de bouton mort ».

## A.10 — `updateBoardAtomically` (H4)

`PATCH /api/board` lit hors file (`readBoard()` `:28`) et n'écrit que sous
`serialize` — deux PATCH concurrents perdent une mise à jour. Théorique
aujourd'hui (`reorder` n'a pas d'appelant) ; ce plan branche `reorder` sur un
geste rapide et ajoute `wip`. Ajouter `updateBoardAtomically(fn)` dans
`store.ts` (patron `updateSettingsAtomically`, `:125`) et y basculer les 4
actions.

## A.11 — Hors périmètre, explicitement

- Kanban mobile ; glisser plusieurs cartes ; toasts de succès.
- **Deux onglets ouverts** : dernier écrivain gagne. Le contrat voisin-relatif
  d'A.3 supprime la corruption (C3) mais pas la course. Un contrôle de version
  optimiste serait un chantier de store entier.
- **`caldavSyncedDue`** — voir « Signalé, non traité » plus bas.
- **Ce qui ne survivra pas au pivot multi-user** (`TODOS.md` P0) : la route
  `/api/board/cards`, le board singleton (`boards.json`), `wipLimit`. **Ce qui
  survit** : `src/lib/kanban.ts`, pur et testé.

---

# Chantier B — Le calendrier (branche séparée, `design/calendrier-plan-jour`)

> **A et B ne partagent plus la branche.** A est du code mergeable seul ; B est
> un artefact suspendu à un arbitrage humain. `docs/coordination.md` : un agent
> = une branche à la fois.

## B.0 — La contrainte

`DECISIONS.md` 2026-08-26 : calendrier **et fiche tâche** entièrement redessinés
par Claude Design, « **Aramis fournira** le livrable ». D'ici là, ne pas refiner
en code. Le livrable n'est jamais venu — cinq jours de blocage.

⚠️ **Que ce soit moi qui le produise est un renversement de décision.** Il
demande une entrée `DECISIONS.md` datée, pas un glissement.

## B.1 — Ce que Brief peut différencier — **corrigé, c'était faux**

| Différenciateur annoncé | Constructible aujourd'hui ? |
|---|---|
| Tâches **sans créneau** | ✅ oui (`items`, `DesktopCalendar.tsx:153`) |
| **Charge** d'une journée | ❌ **non.** `durationMinutes` est optionnel, **jamais saisi** (aucune UI ne l'écrit, absent de `parse.ts`) et vaut 60 min par repli côté CalDAV. Une barre de charge afficherait *les événements Apple*. |
| **Dernière occurrence** | ❌ **non.** `AgendaItem` (`agenda.ts:32-46`) n'a ni `rrule`, ni `doneAt`. |
| **Dépendances** | ❌ **non.** Ni `dependsOn` ni `priority` dans `AgendaItem` ; pour une entrée CalDAV pure `briefItemId` est `null`. |

Et `DesktopCalendar` **ne s'alimente qu'à `fetchAgendaDay`** — invariant écrit
en tête du fichier (une seule définition d'« occurrence du jour »).

**Conséquence :** un `.dc.html` montrant charge et « dernière occurrence »
dessinerait une interaction que le back-end ne sait pas exécuter.

## B.2 — Géométrie mesurée

`DesktopShell` : `minWidth 1024`, `maxWidth 1560`, `padding 16/20/20`.
`DesktopCalendar` : `1fr 320px`, gap 12, gouttière d'heures 58 px.
→ **85 px par jour à 1024 px**, 167 px à 1560 px. La grille plafonne déjà à
3 voies parce qu'« au-delà un titre ne se lit plus ».

## B.3 — Ce que la revue conteste

Aramis a arbitré **B-c** (Plan + Grille) au gate des prémisses. Les deux voix
qui se sont prononcées le contestent, pour des raisons opposées :

- **CEO** : « B-c n'est pas un arbitrage, c'est le refus d'arbitrer » — la
  plainte était « ça fait doublon », B-c garde le doublon et ajoute un écran.
- **Design** : sans charge ni dernière occurrence, la vue « Plan » livrée
  d'abord serait « un Calendrier Apple **dégradé** ». Recommande **B-a** : le
  seul différenciateur atteignable à données constantes est **glisser une tâche
  sans créneau sur un créneau pour lui donner une heure**.

→ **Remonté au gate final.** Le choix d'Aramis tient tant qu'il ne le change pas.

## B.4 — Le brief du livrable, s'il est maintenu

1. **Aucun artboard desktop n'existe** : `docs/design-system-ref.dc.html` est
   exclusivement iOS. Le livrable doit poser le cadre (1024→1560, chrome
   `DesktopHeader`, paddings) ou il sera dessiné dans le vide.
2. **Trois journées, pas une** : une légère, **la journée à 5 RDV croisés**
   (c'est elle qui décide), une à 12 tâches sans créneau.
3. **Le panneau de droite en fait partie** : `DesktopCalendar` embarque sa
   propre fiche (`SelectionPanel:446-509`), un **troisième** design de fiche à
   côté de `DesktopTaskDetail`. À inclure ou exclure noir sur blanc.
4. **Chaque donnée annotée** : réelle / dérivable / à créer.

## B.5 — Deux bugs du calendrier à fermer dans la refonte

- `DesktopCalendar.tsx:129-146` : toute erreur de `fetchAgendaDay` devient `[]`.
  **Une journée qui a échoué à charger est indiscernable d'une journée libre.**
  Dans un outil de planification, c'est le pire faux négatif possible.
- Même bloc : `UnauthorizedError` est relancé dans un `void Promise.all().then()`
  **sans `.catch` terminal** → rejet non géré, rien à l'écran.

---

# Signalé, non traité (hors périmètre — pour `TODOS.md`)

1. **⚠️ `caldavSyncedDue` — divergence silencieuse avec iCloud.** Vérifié :
   `dtstartBaseline` (`caldav.ts:542-547`) compare `remote.dtstart` à
   `caldavSyncedDue`, **jamais à `due`**. Une écriture locale de `due` ne touche
   pas `caldavSyncedDue` (`sanitizePatch` ne l'invalide pas) → `remoteDiffers`
   faux → `decideSync` rend `skip` → **aucun PUT**. Le bouton « Repousser +1j »
   (`DesktopCalendar.tsx:499`) fait donc diverger Brief d'Apple en silence.
   **C'est le préalable technique à toute UI de planification** (B-a comme B-b).
   Non traité ici : toucher à la synchro dépasse largement la demande.
2. **`columnId` ne veut rien dire.** Vérifié par balayage : aucune logique
   métier ne le lit (ni `graphStatus`, ni les rappels, ni CalDAV, ni le digest).
   Glisser une carte dans « Fait » **ne la coche pas** ; une tâche cochée
   disparaît du board (`:568`). → remonté au gate final.
3. **Aucun état de chargement en desktop** : `DesktopShell` ne reçoit pas de
   prop `loading` ; `Skeleton.tsx` n'est utilisé nulle part sous
   `components/desktop/`. Board en chargement et board vide sont identiques.
4. **`openCount` ne se réconcilie pas** avec la somme des pastilles de colonne.
5. **Tags et projets partagent la palette** — une barre bleue et un disque bleu
   ne veulent pas dire la même chose.
6. **`DESIGN.md` §3 décrit une sidebar** que `DesktopShell` n'a pas.

---

# Tâches d'implémentation

- [x] **T1 (P1)** — `store.ts` — `updateItemsAtomically` + `updateBoardAtomically`, `normalizeItem` normalise `columnOrder` · *C2/C3/H2/H4*
- [x] **T2 (P1)** — `src/lib/kanban.ts` + tests — les 4 fonctions pures, comparateur 3 branches · *H1*
- [x] **T3 (P1)** — `PATCH /api/board/cards` + tests — intention voisin-relative, calcul en file · *C2/C3*
- [x] **T4 (P1)** — `api/board/route.ts` — `delete` détache les cartes ; les 4 actions en file · *C4/H4*
- [x] **T5 (P1)** — `coerce` + `sanitizePatch` acceptent `columnId`/`columnOrder` · *C1/H3*
- [x] **T6 (P1)** — `KanbanCard` cesse d'être un `<button>` ; bouton « ouvrir » au survol · *H6*
- [x] **T7 (P1)** — `DesktopKanban` : `useSortable`, discriminant type, collision composée, `MeasuringStrategy.Always`, auto-scroll, `DragOverlay` sorti, placeholder Trello, « Non placées » droppable
- [x] **T8 (P1)** — échec du dépôt → retour serveur + toast `err`, sans passer par `saveItemEdit` · *C5*
- [x] **T9 (P2)** — colonnes déplaçables (branche l'API `reorder` existante)
- [x] **T10 (P2)** — composeur « + » héritant du filtre projet, en bas de colonne
- [x] **T11 (P2)** — WIP indicative, comptée sur la colonne complète
- [x] **T12 (P2)** — clavier (dépend de T6)
- [~] **T13 (P3)** — ~~retirer la note « 30 jours »~~ **fait** (disparue avec la réécriture, comme le bouton mort « WIP » qui est maintenant câblé) ; sortir `KanbanColumnView` dans son fichier — **non fait**, voir note ci-dessous

---

# Validation

`npx eslint .` · `npx tsc --noEmit` · `npx vitest run` avant tout commit.

**Recette navigateur : en local (`npm run dev` + `/browse` sur localhost), pas
en prod.** La prod est injoignable depuis le Mac (SSH refusé, `curl` sur
`brief.srv1899780.hstgr.cloud` → HTTP 000), PR #7 n'est toujours pas déployée
après trois demandes, et la prod est deux merges derrière. Faire dépendre la
validation d'un blocage non levé, c'est une ligne « non lancé » dans la
passation. Le glisser-déposer est précisément ce qu'aucun test Vitest ne prouve.

# Risques restants

1. **Le multi-conteneur dnd-kit est le morceau long.** L'API répond ; le patron
   est à écrire. C'est là que le temps passera, pas dans `kanban.ts`.
2. **Deux onglets** : course non résolue, assumée.
3. **Usage réel du Kanban en prod : non mesuré.** La voix CEO demandait
   combien d'items portent un `columnId`. **Impossible depuis le Mac** (prod
   injoignable). Si la réponse est « presque aucun », le périmètre P2 (T9-T12)
   mérite d'être rediscuté.


---

# État au 2026-08-31, 11 h — reprise après coupure de session

**T1 → T12 : faits.** `npx eslint .` 0 erreur · `npx tsc --noEmit` 0 erreur ·
`npx vitest run` 524 passants, 1 skipped (41 fichiers).

Ce que la reprise a trouvé et corrigé, en plus du plan :

1. **`Item.columnOrder` n'existait pas dans `types.ts`.** Le champ était écrit
   dans `store.ts`, `kanban.ts`, les deux sanitizers et la route — partout sauf
   dans le type. 18 erreurs `tsc`, **zéro test en échec** : Vitest ne typecheck
   pas. C'est exactement le profil d'erreur que la règle « les trois commandes
   avant chaque commit » existe pour attraper.
2. **`DesktopShell.tsx` n'avait pas été touché.** `handleMoveCard(itemId,
   columnId)` gardait l'ancienne signature et passait par `onSaveItem` — le
   chemin que le plan interdit explicitement (A.5). Les cinq `catch` muets sont
   remplacés par des toasts `err`. `onReorderColumns`, `onAddCard` et `onSetWip`
   n'étaient branchés nulle part : le glisser-déposer des colonnes, le composeur
   « + » et la limite WIP étaient du code mort côté écran.
3. **`reorder` ne réordonnait rien** — régression introduite par la réécriture
   d'A.10. `renumber()` re-triait sur l'ancien `order` juste après le tri
   demandé, l'annulant. Réponse 200, board inchangé. Trouvé par le premier test
   écrit sur `/api/board` (la route n'en avait aucun).
4. **`previewRef.current = preview` en corps de rendu** (erreur ESLint
   `react-hooks/refs`) → `setPlan()` écrit le ref et l'état ensemble.
5. **`useEffect(() => setName(column.name))`** (erreur ESLint
   `set-state-in-effect`) → le champ se remplit à l'ouverture de l'édition.

**T13, moitié restante — non fait, volontairement.** Sortir `KanbanColumnView`
dans son fichier déplacerait ~350 lignes à l'intérieur d'un diff de ~1 100
lignes que personne n'a encore relu : git le rendrait comme une suppression
plus un ajout, et la revue y perdrait plus qu'elle n'y gagnerait. À faire dans
son propre commit **après** que ce chantier ait passé `/code-review`.

**Recette navigateur — FAITE**, sur le dev local (port 3100), connecté via
`browse handoff`. Neuf gestes, neuf passants, zéro erreur console : dépôt entre
colonnes avec rang conservé au rechargement · insertion voisin-relative sur une
carte précise · sortie vers « Non placées » · colonne déplacée et persistée
(le geste qui ne faisait rien avant le fix de `renumber`) · suppression d'une
colonne pleine → les cartes réapparaissent · composeur « + » sous filtre projet
· limite WIP dépassée (bordure rouge, dépôt quand même accepté) · clavier
Espace/flèches/Espace · `fetch` saboté → **toast d'erreur** et retour à l'état
serveur. Détail dans `HANDOFF.md`. Données d'Aramis remises comme trouvées.

Le glisser-déposer a été piloté par **événements pointeur réels** : `browse` n'a
pas de commande `drag`, et dnd-kit n'écoute ni `click` ni les événements souris
— voir la mémoire `browse-drag-dnd-kit`.


---

# `/code-review high` — 2026-08-31, 11 h 30

Neuf trouvailles, **aucun faux positif**, neuf corrigées. Les quatre qui
comptent, parce qu'elles touchent des choses que le plan avait prévues :

1. **A.9 n'était fait qu'à moitié.** Le plan demandait une « passe de
   récupération » pour les cartes déjà orphelinées par les suppressions
   passées. `detachColumn` portait bien le mode (3ᵉ argument, testé) mais
   **aucun appelant** : la prod garde ses orphelines. Ajoutée dans
   `GET /api/board`, avec écriture bornée.
2. **A.3 laissait une régression visuelle.** L'aperçu s'effaçait au dépôt,
   donc la carte se redessinait à sa position d'origine le temps de
   l'aller-retour serveur, puis sautait. Et la réponse fraîche que la route
   construit « pour que l'UI optimiste se réconcilie » n'était lue par
   personne. `onMoveCard` rend maintenant une promesse.
3. **L'invariant « pas de liste blanche de champs » d'`AGENTS.md` était
   violé** par l'action `delete`, qui écrit des items sans réconcilier les
   objectifs. Aucun effet fonctionnel aujourd'hui — c'est exactement le
   raisonnement que l'invariant interdit.
4. **`moveCardPlan` traitait `columnId: null` comme une colonne.** Ce n'en est
   pas une : c'est tout ce qui n'a jamais été posé sur le board, idées et items
   archivés compris. Le retassage de la colonne quittée a été **supprimé
   entièrement** — il était inutile partout (le tri gère les trous ; la cible
   est renumérotée en entier de toute façon).

Contre-recette navigateur passée sur les corrections qui touchaient du
comportement déjà validé (`role="group"` et clavier, champ WIP, réseau coupé).

```
npx eslint .       → 0 erreur (28 warnings préexistants)
npx tsc --noEmit   → 0 erreur
npx vitest run     → 531 passants, 1 skipped
```
