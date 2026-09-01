import type { Store } from "../store";

/**
 * Un `Store` en mémoire pour les tests de routes.
 *
 * Depuis le pivot multi-utilisateur, une route n'importe plus de fonctions
 * libres : elle reçoit son store de `requireStore()`. Moquer `@/lib/store`
 * ne suffit donc plus — c'est `guard.requireStore` qu'on moque, et il lui faut
 * un store à rendre.
 *
 * Chaque méthode non fournie lève : un test qui touche une partie du store
 * qu'il n'a pas préparée doit le dire, pas recevoir un `undefined` silencieux
 * qui casse trois assertions plus loin.
 */
export function fakeStore(overrides: Partial<Store> = {}): Store {
  const notStubbed =
    (name: string) =>
    (): never => {
      throw new Error(`fakeStore : ${name}() appelée sans avoir été fournie par le test.`);
    };

  const base: Store = {
    readProjects: notStubbed("readProjects"),
    writeProjects: notStubbed("writeProjects"),
    readBoard: notStubbed("readBoard"),
    writeBoard: notStubbed("writeBoard"),
    updateBoardAtomically: notStubbed("updateBoardAtomically"),
    readSettings: notStubbed("readSettings"),
    updateSettingsAtomically: notStubbed("updateSettingsAtomically"),
    readTags: notStubbed("readTags"),
    writeTags: notStubbed("writeTags"),
    readObjectives: notStubbed("readObjectives"),
    writeObjectives: notStubbed("writeObjectives"),
    updateObjectivesAtomically: notStubbed("updateObjectivesAtomically"),
    readItems: notStubbed("readItems"),
    saveItems: notStubbed("saveItems"),
    patchItem: notStubbed("patchItem"),
    deleteItem: notStubbed("deleteItem"),
    updateItemsAtomically: notStubbed("updateItemsAtomically"),
    patchItems: notStubbed("patchItems"),
    readSubscriptions: notStubbed("readSubscriptions"),
    saveSubscription: notStubbed("saveSubscription"),
    removeSubscription: notStubbed("removeSubscription"),
    readUserJson: notStubbed("readUserJson"),
    writeUserJson: notStubbed("writeUserJson"),
    audioDir: notStubbed("audioDir"),
  };

  return { ...base, ...overrides };
}

/** L'identifiant de compte utilisé par les tests. Un UUID, comme un vrai `sub`. */
export const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";
