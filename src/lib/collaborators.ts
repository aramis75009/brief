import "server-only";
import { listCollaboratorRows, listAuthorizedUserIds } from "./supabase/admin";
import { storeForUser, type Store } from "./store";
import type { Item } from "./types";

/**
 * Collaborateurs — tâches assignées entre comptes Brief (2026-09-07).
 *
 * Modèle : l'item VIT chez son propriétaire (champ `assigneeId` = userId du
 * collaborateur). Le collaborateur ne possède RIEN : il LIT les items qui
 * lui sont assignés et peut COCHER (une seule route de complétion, jamais
 * d'édition libre). Toute la vérité reste chez le propriétaire — comme un
 * « share » iCalendar, pas une copie. Si le propriétaire désassigne ou
 * supprime, la tâche disparaît de la vue du collaborateur au rechargement.
 *
 * ⚠️ Invariant de cloisonnement (`no-direct-store-access.test.ts`) : une
 * route ne choisit JAMAIS le store elle-même. Ce module est l'équivalent
 * serveur des crons (qui itèrent les comptes), mais les fonctions exportées
 * filtrent TOUJOURS sur l'identité de la session (`me`) ou sur un
 * `assigneeId` déjà présent dans les données du propriétaire — jamais sur
 * un identifiant choisi par le client.
 */

/** Un item assigné, enrichi du compte chez qui il vit. */
export type AssignedItem = Item & { ownerUserId: string };

/** Nom d'affichage par défaut : les 8 premiers caractères de l'UUID. */
export function fallbackDisplayName(userId: string): string {
  return userId.slice(0, 8);
}

/**
 * Les items des AUTRES comptes assignés à `me`.
 *
 * Parcourt les comptes autorisés, lit les items de chacun, garde ceux où
 * `assigneeId === me`. Rend des copies enrichies de `ownerUserId` — le
 * client rappelle ce propriétaire à la route de complétion, qui ne le croit
 * pas sur parole (relit chez le propriétaire, exige l'assignation).
 */
export async function itemsAssignedTo(me: string): Promise<AssignedItem[]> {
  let others: string[];
  try {
    others = (await listAuthorizedUserIds()).filter((id) => id !== me);
  } catch {
    return []; // clé service absente ou table muette — la liste du propriétaire suffit
  }
  const out: AssignedItem[] = [];
  // Séquentiel volontaire : quelques comptes à la maison, pas de pression de
  // latence, et un échec disque chez l'un n'interrompt pas les autres.
  for (const ownerId of others) {
    let store: Store;
    try {
      store = storeForUser(ownerId);
    } catch {
      continue;
    }
    let items: Item[];
    try {
      items = await store.readItems();
    } catch {
      continue;
    }
    for (const it of items) {
      if (it.assigneeId === me) out.push({ ...it, ownerUserId: ownerId });
    }
  }
  return out;
}

/**
 * Coche « fait » d'une tâche partagée, par son ASSIGNÉ.
 *
 * `ownerId` vient du `ownerUserId` que le client a reçu de `itemsAssignedTo`
 * — il n'est jamais cru sur parole : on relit l'item chez ce propriétaire et
 * on exige `assigneeId === me` avant d'écrire. Un client malveillant avec une
 * session valide ne peut donc cocher que les tâches réellement assignées à
 * son compte, chez un propriétaire qui les possède vraiment.
 */
export async function completeAssigned(
  me: string,
  ownerId: string,
  itemId: string,
  done: boolean,
): Promise<{ ok: true; item: AssignedItem } | { ok: false; status: number; error: string }> {
  let store: Store;
  try {
    store = storeForUser(ownerId);
  } catch {
    return { ok: false, status: 400, error: "Propriétaire invalide." };
  }
  let items: Item[];
  try {
    items = await store.readItems();
  } catch {
    return { ok: false, status: 503, error: "Lecture impossible chez le propriétaire." };
  }
  const target = items.find((it) => it.id === itemId);
  if (!target) return { ok: false, status: 404, error: "Item introuvable." };
  if (target.assigneeId !== me) {
    return { ok: false, status: 403, error: "Cette tâche ne t'est pas assignée." };
  }
  const now = new Date().toISOString();
  let updated: Item | null;
  try {
    updated = await store.patchItem(itemId, {
      doneAt: done ? now : null,
      lastCompletedOccurrenceAt: done ? now : null,
    });
  } catch {
    return { ok: false, status: 503, error: "Écriture impossible chez le propriétaire." };
  }
  if (!updated) return { ok: false, status: 404, error: "Item introuvable." };
  return { ok: true, item: { ...updated, ownerUserId: ownerId } };
}

export { listCollaboratorRows };