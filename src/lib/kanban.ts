/**
 * Logique pure du board Kanban — aucun DOM, aucun accès disque, comme
 * `graph.ts` et `objectives.ts`. Elle tourne **côté serveur**, dans la file
 * d'écriture, sur la liste complète des items.
 *
 * Pourquoi côté serveur : l'écran ne voit qu'un sous-ensemble de chaque colonne
 * (filtre projet, `!doneAt`, items actifs seulement). Lui faire calculer des
 * rangs absolus écraserait l'ordre des cartes qu'il masque, et un onglet resté
 * ouvert renverrait une carte dans sa colonne d'origine alors qu'un autre
 * onglet vient de la déplacer. Le client envoie donc une **intention**
 * (« entre ces deux cartes-là »), jamais des positions.
 */

import type { Item, KanbanColumn } from "./types";

/** Un patch à appliquer, au format attendu par `patchItems`. */
export type ItemPatch = { id: string; patch: Partial<Item> };

/** `undefined` et `null` désignent la même chose : la carte n'est sur aucune colonne. */
function columnOf(item: Item): string | null {
  return item.columnId ?? null;
}

/**
 * Compare deux rangs. Trois branches, jamais une soustraction :
 * `(a ?? Infinity) - (b ?? Infinity)` rend `NaN` quand les deux sont absents,
 * et un comparateur qui rend `NaN` produit un ordre non spécifié — or « les
 * deux absents » est l'état de TOUTES les cartes avant le premier glissement.
 */
function compareRank(a: number | undefined, b: number | undefined): number {
  const aRanked = typeof a === "number" && Number.isFinite(a);
  const bRanked = typeof b === "number" && Number.isFinite(b);
  if (!aRanked && !bRanked) return 0;
  if (!aRanked) return 1;
  if (!bRanked) return -1;
  return (a as number) - (b as number);
}

/**
 * Trie une colonne par rang croissant, les cartes jamais rangées à la main en
 * dernier. Tri **stable** : à rang égal (deux onglets ont pu écrire le même),
 * l'ordre d'entrée est conservé. Ne modifie pas le tableau reçu.
 */
export function sortColumnItems(items: Item[]): Item[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => compareRank(a.item.columnOrder, b.item.columnOrder) || a.index - b.index)
    .map((entry) => entry.item);
}

/**
 * Les cartes d'une colonne, triées. `columnId` à `null` = les non placées.
 *
 * Ne filtre NI les cartes faites NI les autres projets : le serveur réindexe la
 * colonne complète, sinon un dépôt fait sous un filtre projet renumérote les
 * trois cartes visibles et écrase le rang des sept autres.
 */
export function columnItems(items: Item[], columnId: string | null): Item[] {
  return sortColumnItems(items.filter((item) => columnOf(item) === columnId));
}

/** Rend le patch minimal pour amener `item` à la colonne et au rang voulus. */
function rankPatch(item: Item, columnId: string | null, rank: number): ItemPatch | null {
  const patch: Partial<Item> = {};
  if (columnOf(item) !== columnId) patch.columnId = columnId;
  if (item.columnOrder !== rank) patch.columnOrder = rank;
  return Object.keys(patch).length > 0 ? { id: item.id, patch } : null;
}

/**
 * Plan d'un déplacement de carte, exprimé en voisins plutôt qu'en index.
 *
 * `beforeId` est la carte qui doit se retrouver juste AVANT celle qu'on
 * déplace, `afterId` celle juste APRÈS. Les deux absents = dépôt en fin de
 * colonne (zone vide). Un voisin devenu introuvable (carte supprimée pendant le
 * glissement) dégrade vers la fin de colonne au lieu de planter.
 *
 * Rend les patches **minimaux** : un dépôt sur la position d'origine rend un
 * tableau vide, donc `patchItems` sort sans écrire sur le disque.
 */
export function moveCardPlan({
  items,
  itemId,
  toColumnId,
  beforeId,
  afterId,
}: {
  items: Item[];
  itemId: string;
  toColumnId: string | null;
  beforeId?: string;
  afterId?: string;
}): ItemPatch[] {
  const moved = items.find((item) => item.id === itemId);
  if (!moved) return [];

  const to = toColumnId ?? null;

  const target = columnItems(items, to).filter((item) => item.id !== itemId);

  let index = target.length;
  const beforeIndex = beforeId ? target.findIndex((item) => item.id === beforeId) : -1;
  const afterIndex = afterId ? target.findIndex((item) => item.id === afterId) : -1;
  if (beforeIndex !== -1) index = beforeIndex + 1;
  else if (afterIndex !== -1) index = afterIndex;

  target.splice(index, 0, moved);

  const patches: ItemPatch[] = [];
  target.forEach((item, rank) => {
    const patch = rankPatch(item, to, rank);
    if (patch) patches.push(patch);
  });

  // ⚠️ La colonne QUITTÉE n'est pas retassée, volontairement.
  //
  // Elle garde un trou (0, 1, 3) et c'est sans conséquence : `sortColumnItems`
  // trie, il ne compte pas, et le prochain dépôt dans cette colonne la
  // renumérote de toute façon en entier.
  //
  // La retasser coûtait cher pour rien dans un cas précis : `columnId: null`
  // n'est PAS une colonne, c'est « tout ce qui n'a jamais été posé sur le
  // board » — tâches, RDV, idées, items archivés et terminés confondus. Sortir
  // la première carte des « Non placées » d'un compte à 400 items produisait
  // 400 patches et tamponnait un `columnOrder` sur des items que le Kanban
  // n'affiche jamais.
  return patches;
}

/**
 * L'ordre des colonnes après avoir déposé `activeId` à la place de `overId`.
 * À passer tel quel à l'action `reorder` de `PATCH /api/board`.
 */
export function reorderColumnIds(
  columns: KanbanColumn[],
  activeId: string,
  overId: string,
): string[] {
  const ids = [...columns].sort((a, b) => a.order - b.order).map((column) => column.id);
  const from = ids.indexOf(activeId);
  const to = ids.indexOf(overId);
  if (from === -1 || to === -1 || from === to) return ids;
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, activeId);
  return next;
}

/**
 * Renvoie en « non placées » les cartes d'une colonne qu'on supprime.
 *
 * Sans ça, supprimer une colonne laisse ses cartes avec un `columnId` qui ne
 * pointe plus nulle part : elles ne s'affichent dans aucune colonne, et pas
 * davantage dans « non placées » (dont le filtre est `!columnId`). Elles
 * disparaissent du board sans un mot, alors que le menu promet de « vider ».
 *
 * Avec `columnId` à `null` et la liste des colonnes vivantes, ramasse les
 * orphelines déjà produites par les suppressions passées.
 */
export function detachColumn(
  items: Item[],
  columnId: string | null,
  liveColumnIds?: string[],
): ItemPatch[] {
  const live = liveColumnIds ? new Set(liveColumnIds) : null;
  const orphaned = (item: Item): boolean => {
    const column = columnOf(item);
    if (column === null) return false;
    if (columnId !== null) return column === columnId;
    return live !== null && !live.has(column);
  };

  return items
    .filter(orphaned)
    .map((item) => ({ id: item.id, patch: { columnId: null, columnOrder: undefined } }));
}
