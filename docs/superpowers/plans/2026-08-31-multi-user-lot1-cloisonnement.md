# Lot 1 — Cloisonnement des données par utilisateur

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chaque compte Supabase possède son propre jeu de fichiers JSON, et
aucune route ne peut lire les données d'un autre compte.

**Architecture:** `src/lib/store.ts` cesse d'exporter 18 fonctions globales et
exporte une fabrique `storeForUser(userId)` rendant un objet `Store` lié à un
compte, dont les fichiers vivent sous `BRIEF_DATA_DIR/users/<userId>/`. Les
routes obtiennent ce store par `requireStore()`, qui fait la garde de session
**et** la résolution d'identité en un appel. Les crons, qui n'ont pas de
session, itèrent sur `authorized_users` via la clé service-role Supabase. Une
migration idempotente au démarrage attribue les fichiers existants au compte
d'Aramis.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Vitest,
Supabase (Auth + Postgres), Node `crypto` natif.

**Spec:** [`docs/superpowers/specs/2026-08-31-pivot-multi-utilisateur-design.md`](../specs/2026-08-31-pivot-multi-utilisateur-design.md)

## Global Constraints

- **La priorité 1 est la PLUS HAUTE** (iCalendar). Une seule échelle.
- **Aucun calcul de date via les méthodes locales de `Date`** — tout passe par
  `src/lib/zoned.ts` (`Europe/Paris`). La prod tourne en UTC.
- **Une date illisible devient « pas d'échéance »**, jamais une date approchée.
- **Toute route sous `/api/` commence par une garde.** Après ce lot :
  `requireStore()` si elle touche au store, `requireSession()` sinon.
- **Ne jamais réintroduire `requirePin`, `BRIEF_PIN` ou `x-brief-pin`**
  (supprimés le 2026-08-26).
- **Avant chaque commit : `npx eslint .`, `npx tsc --noEmit`, `npx vitest run`.**
  Un correctif d'UI n'exempte pas les tests.
- **Ne jamais lancer `npm run build`** : un `next dev` tourne sur le port 3100.
- **`userId` = le `sub` du JWT Supabase, un UUID.** Il entre dans un chemin de
  fichier : toute construction de chemin le valide d'abord.
- Le repo est en français pour les commentaires et la documentation, en
  anglais pour le code et les messages de commit.

## Stratégie d'ordre — pourquoi la fabrique coexiste avant de remplacer

Les tâches 1 à 7 **ajoutent** `storeForUser` sans toucher aux 18 exports
libres, qui continuent de lire `BRIEF_DATA_DIR/*.json`. Le code compile et les
531 tests passent à chaque commit.

La tâche 8 **supprime** les exports libres. Le typecheck devient alors la
preuve de complétude : tout consommateur oublié ne compile plus. C'est la
raison d'être de cet ordre — chercher les oublis à la main sur 22 fichiers est
exactement le genre de vérification qui rate.

La tâche 9 (migration au démarrage) vient **après** la 8 : tant que les exports
libres lisent la racine, déplacer les fichiers les casserait.

## File Structure

| Fichier | Responsabilité |
|---|---|
| `src/lib/store.ts` | **Réécrit.** `type Store` + `storeForUser(userId)`. Chemins, file d'écriture par compte, normalisation. Absorbe l'ancien `push-store.ts`. |
| `src/lib/push-subscription.ts` | **Nouveau.** `parseSubscription` et `PushSubscriptionRecord` — pur, sans disque, testable seul. |
| `src/lib/push-store.ts` | **Supprimé** (tâche 8). |
| `src/lib/guard.ts` | **Modifié.** `sessionUserId()`, `requireStore()`, `requireStoreOrMachineToken()`. |
| `src/lib/supabase/admin.ts` | **Nouveau.** Client service-role + `listAuthorizedUserIds()`. `server-only`. |
| `src/lib/migrate-multiuser.ts` | **Nouveau.** Migration idempotente des fichiers globaux. |
| `src/instrumentation.ts` | **Nouveau.** Appelle la migration une fois au démarrage. |
| `src/lib/objective-reconcile.ts` | **Modifié.** Prend un `Store`. |
| `src/lib/webpush.ts` | **Modifié.** `sendPush`/`sendPushToAll` prennent un `Store` pour purger un abonnement expiré du bon compte. |
| `src/lib/reminders.ts` | **Modifié.** `runReminders(store, now)`. |
| `src/lib/caldav.ts` | **Modifié.** `runCalDavSync(store)` ; le timestamp de garde-fou passe par le store. |
| 17 routes sous `src/app/api/` | **Modifiées.** `requireSession()` → `requireStore()`. |
| `src/app/api/cron/*/route.ts` | **Modifiées.** Boucle sur les comptes. |
| `src/lib/no-direct-store-access.test.ts` | **Nouveau.** Fige l'invariant de cloisonnement. |

---

### Task 1 : La fabrique de store

**Files:**
- Modify: `src/lib/store.ts`
- Create: `src/lib/push-subscription.ts`
- Test: `src/lib/store.test.ts` (nouveau)

**Interfaces:**
- Consumes: rien.
- Produces: `type Store`, `storeForUser(userId: string): Store`,
  `USER_ID_PATTERN`. `Store` porte exactement ces méthodes :
  `readProjects()`, `writeProjects(p)`, `readBoard()`, `writeBoard(b)`,
  `updateBoardAtomically(fn)`, `readSettings()`, `updateSettingsAtomically(fn)`,
  `readTags()`, `writeTags(t)`, `readObjectives()`, `writeObjectives(o)`,
  `updateObjectivesAtomically(fn)`, `readItems()`, `saveItems(i)`,
  `patchItem(id, patch)`, `deleteItem(id)`, `updateItemsAtomically(fn)`,
  `patchItems(patches)`, `readSubscriptions()`, `saveSubscription(sub)`,
  `removeSubscription(endpoint)`, `readLastCalDavSync()`,
  `writeLastCalDavSync(at)`.
  `src/lib/push-subscription.ts` exporte `type PushSubscriptionRecord` et
  `parseSubscription(input)` — déplacés tels quels depuis `push-store.ts`.

- [ ] **Step 1: Extraire la partie pure de `push-store.ts`**

Créer `src/lib/push-subscription.ts` avec, déplacés **sans modification**
depuis `src/lib/push-store.ts` : le type `PushSubscriptionRecord`, la fonction
`base64urlByteLength`, la fonction `parseSubscription` et le garde `isRecord`
(exporté, car le store en a besoin). Reprendre les commentaires d'origine.
Ce fichier ne fait aucune entrée-sortie : pas de `server-only`.

Dans `src/lib/push-store.ts`, remplacer ces définitions par un ré-export :

```ts
export { parseSubscription, type PushSubscriptionRecord } from "./push-subscription";
```

- [ ] **Step 2: Écrire les tests d'isolation — le test central du chantier**

Créer `src/lib/store.test.ts` :

```ts
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "brief-store-"));
  process.env.BRIEF_DATA_DIR = dir;
  // Le module lit BRIEF_DATA_DIR à l'import : il faut le recharger par test.
  vi.resetModules();
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("storeForUser", () => {
  it("cloisonne deux comptes : écrire chez A ne change rien chez B", async () => {
    const { storeForUser } = await import("./store");
    const a = storeForUser(A);
    const b = storeForUser(B);

    await a.saveItems([{ id: "i1", kind: "task", title: "chez A" } as never]);

    expect(await a.readItems()).toHaveLength(1);
    expect(await b.readItems()).toEqual([]);
  });

  it("cloisonne aussi les abonnements push", async () => {
    const { storeForUser } = await import("./store");
    const a = storeForUser(A);
    const b = storeForUser(B);

    await a.saveSubscription({
      endpoint: "https://example.com/x",
      keys: { p256dh: "p", auth: "a" },
    });

    expect(await a.readSubscriptions()).toHaveLength(1);
    expect(await b.readSubscriptions()).toEqual([]);
  });

  it("refuse un identifiant qui n'est pas un UUID", async () => {
    const { storeForUser } = await import("./store");
    expect(() => storeForUser("../../etc")).toThrow();
    expect(() => storeForUser("")).toThrow();
    expect(() => storeForUser("pas-un-uuid")).toThrow();
  });

  it("sérialise les écritures d'un même compte", async () => {
    const { storeForUser } = await import("./store");
    const a = storeForUser(A);
    await a.saveItems([{ id: "i1", kind: "task", title: "x", done: false } as never]);

    // Deux lecture-modification-écriture concurrentes : la seconde doit voir
    // le résultat de la première, pas l'état initial.
    await Promise.all([
      a.updateItemsAtomically((items) => items.map((i) => ({ id: i.id, patch: { title: "un" } }))),
      a.updateItemsAtomically((items) => items.map((i) => ({ id: i.id, patch: { notes: "deux" } }))),
    ]);

    const [item] = await a.readItems();
    expect(item.title).toBe("un");
    expect(item.notes).toBe("deux");
  });

  it("rend le même store pour le même compte", async () => {
    const { storeForUser } = await import("./store");
    expect(storeForUser(A)).toBe(storeForUser(A));
  });
});
```

Ajouter `import { vi } from "vitest";` à la liste d'imports.

- [ ] **Step 3: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/lib/store.test.ts`
Expected: FAIL — `storeForUser` n'existe pas.

- [ ] **Step 4: Écrire la fabrique**

Dans `src/lib/store.ts`, **ajouter** (sans rien supprimer) :

```ts
/** Un `sub` de JWT Supabase. Validé avant toute construction de chemin. */
export const USER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Store = {
  readProjects(): Promise<Project[]>;
  writeProjects(projects: Project[]): Promise<void>;
  readBoard(): Promise<KanbanBoard>;
  writeBoard(board: KanbanBoard): Promise<void>;
  updateBoardAtomically(fn: (board: KanbanBoard) => KanbanBoard): Promise<KanbanBoard>;
  readSettings(): Promise<Settings>;
  updateSettingsAtomically(fn: (s: Settings) => Settings): Promise<Settings>;
  readTags(): Promise<Tag[]>;
  writeTags(tags: Tag[]): Promise<void>;
  readObjectives(): Promise<Objective[]>;
  writeObjectives(objectives: Objective[]): Promise<void>;
  updateObjectivesAtomically(
    fn: (objectives: Objective[], items: Item[]) => Objective[] | null,
  ): Promise<Objective[]>;
  readItems(): Promise<Item[]>;
  saveItems(items: Item[]): Promise<void>;
  patchItem(id: string, patch: Partial<Item>): Promise<Item | null>;
  deleteItem(id: string): Promise<boolean>;
  updateItemsAtomically(
    fn: (items: Item[]) => { id: string; patch: Partial<Item> }[],
  ): Promise<Item[]>;
  patchItems(patches: { id: string; patch: Partial<Item> }[]): Promise<number>;
  readSubscriptions(): Promise<PushSubscriptionRecord[]>;
  saveSubscription(sub: Omit<PushSubscriptionRecord, "createdAt">): Promise<void>;
  removeSubscription(endpoint: string): Promise<void>;
  readLastCalDavSync(): Promise<number | null>;
  writeLastCalDavSync(at: number): Promise<void>;
};

/**
 * Le store d'UN compte. Tous ses fichiers vivent sous
 * `BRIEF_DATA_DIR/users/<userId>/`.
 *
 * ⚠️ `userId` entre dans un chemin de fichier — c'est nouveau dans ce module,
 * aucun chemin n'était dynamique avant le 2026-08-31. Un identifiant non
 * validé donnerait une traversée de répertoire (`../../etc`). Le JWT est signé
 * par Supabase, donc le risque est faible ; la garde coûte trois lignes et son
 * absence ne lève aucune erreur.
 *
 * ⚠️ LA FILE D'ÉCRITURE EST PAR COMPTE, pas globale. Elle conserve la
 * garantie d'origine — deux lecture-modification-écriture d'un même compte ne
 * s'écrasent pas, ce dont `updateObjectivesAtomically` dépend puisqu'il lit
 * `items.json` ET `objectives.json` — sans qu'un passage de cron lent chez un
 * utilisateur ne bloque la requête interactive d'un autre.
 */
export function storeForUser(userId: string): Store;
```

Points d'implémentation :

1. `if (!USER_ID_PATTERN.test(userId)) throw new Error(...)` en première ligne.
2. Un cache `Map<string, Store>` pour rendre le même objet par compte (le test
   « rend le même store » le fige), et une `Map<string, Promise<unknown>>` pour
   les files d'écriture.
3. `userDir(userId) = join(DATA_DIR, "users", userId)`.
4. Les fonctions internes `readJson` / `writeJson` prennent le répertoire en
   paramètre. **Conserver l'écriture atomique** (`temp` + `rename`) et le
   suffixe `.${process.pid}.tmp`.
5. **Réutiliser telles quelles** `normalizeItem`, `normalizeObjective`,
   `SEED_BOARD`, `SEED_PROJECTS`, `normalizeSettings` et toute la logique
   existante, y compris les sentinelles `null` de `readProjects` et
   `readBoard`. Aucun comportement ne change ; seul le chemin change.
6. `readSubscriptions` / `saveSubscription` / `removeSubscription` reprennent
   le corps de `push-store.ts`, avec `isRecord` importé de
   `./push-subscription`. **Passer leur écriture par la file sérialisée** —
   l'ancien `push-store.ts` ne le faisait pas, et un abonnement enregistré
   pendant un passage de cron pouvait être perdu.
7. `readLastCalDavSync` / `writeLastCalDavSync` lisent
   `caldav-last-sync.json` sous le répertoire du compte, au format
   `{ at: number }`, avec `null` si absent ou illisible.

- [ ] **Step 5: Lancer les tests**

Run: `npx vitest run src/lib/store.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Vérifier que rien n'a régressé**

Run: `npx vitest run && npx tsc --noEmit && npx eslint .`
Expected: 536 passants (531 + 5), 0 erreur de type, 0 warning.

- [ ] **Step 7: Commit**

```bash
git add src/lib/store.ts src/lib/store.test.ts src/lib/push-subscription.ts src/lib/push-store.ts
git commit -m "feat(store): fabrique storeForUser, un jeu de fichiers par compte"
```

---

### Task 2 : `requireStore()` — la porte unique des routes

**Files:**
- Modify: `src/lib/guard.ts`
- Test: `src/lib/guard.test.ts`

**Interfaces:**
- Consumes: `storeForUser`, `USER_ID_PATTERN` (tâche 1).
- Produces:
  - `sessionUserId(): Promise<string | null>`
  - `requireStore(): Promise<{ userId: string; store: Store } | Response>`
  - `requireStoreOrMachineToken(req, envName, opts?): Promise<{ userId: string; store: Store } | Response>`

- [ ] **Step 1: Écrire les tests**

Ajouter à `src/lib/guard.test.ts`, en suivant le patron de moquage de
`readSessionClaims` déjà présent dans ce fichier :

```ts
describe("requireStore", () => {
  it("rend 401 sans session", async () => {
    mockClaims(null);
    const r = await requireStore();
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).status).toBe(401);
  });

  it("rend le store du compte de la session", async () => {
    mockClaims({ sub: "11111111-1111-4111-8111-111111111111" });
    const r = await requireStore();
    expect(r).not.toBeInstanceOf(Response);
    expect((r as { userId: string }).userId).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("rend 401 si le JWT n'a pas de `sub` exploitable", async () => {
    mockClaims({ email: "x@y.z" });          // pas de sub
    const r = await requireStore();
    expect((r as Response).status).toBe(401);
  });

  it("rend 401 si le `sub` n'est pas un UUID", async () => {
    mockClaims({ sub: "../../etc" });
    const r = await requireStore();
    expect((r as Response).status).toBe(401);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run src/lib/guard.test.ts`
Expected: FAIL — `requireStore` n'existe pas.

- [ ] **Step 3: Implémenter**

```ts
/**
 * L'identifiant du compte connecté (`sub` du JWT), ou `null`.
 *
 * Validé contre `USER_ID_PATTERN` ici plutôt qu'au moment de construire le
 * chemin : une session dont le `sub` est inexploitable doit être refusée à la
 * porte, pas provoquer une exception au fond du store.
 */
export async function sessionUserId(): Promise<string | null> {
  const claims = await readSessionClaims();
  const sub = claims?.sub;
  if (typeof sub !== "string" || !USER_ID_PATTERN.test(sub)) return null;
  return sub;
}

/**
 * Garde de session ET résolution du store, en un seul appel.
 *
 * Remplace le couple `requireSession()` + résolution d'identité : il devient
 * impossible d'avoir l'un sans l'autre, et impossible de se tromper de compte
 * à l'intérieur d'une route. Les routes qui ne touchent pas au store
 * (`transcribe`, `parse`, `audio`) gardent `requireSession()`.
 *
 * Renvoie une `Response` 401 ou le couple `{ userId, store }` : l'appelant
 * teste `instanceof Response`.
 */
export async function requireStore(): Promise<{ userId: string; store: Store } | Response> {
  const userId = await sessionUserId();
  if (!userId) {
    return Response.json({ error: "Session invalide ou expirée." }, { status: 401 });
  }
  return { userId, store: storeForUser(userId) };
}
```

Pour `requireStoreOrMachineToken`, conserver **exactement** l'ordre de
`requireSessionOrMachineToken` (présence d'une pièce d'identité machine
d'abord, sinon session) et son commentaire d'origine sur la raison de cet
ordre. Pendant ce lot, un appelant machine valide reçoit le store de
`BRIEF_OWNER_USER_ID` — le lot 2 remplacera ça par l'identité portée par le
jeton. Si `BRIEF_OWNER_USER_ID` est absent ou invalide, renvoyer **503** avec
un message explicite, jamais un store au hasard.

Garder `requireSession()` et `requireSessionOrMachineToken()` : d'autres routes
s'en servent encore.

- [ ] **Step 4: Lancer les tests**

Run: `npx vitest run src/lib/guard.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/guard.ts src/lib/guard.test.ts
git commit -m "feat(guard): requireStore() rend la garde et le store en un appel"
```

---

### Task 3 : L'inventaire des comptes (clé service-role)

**Files:**
- Create: `src/lib/supabase/admin.ts`
- Test: `src/lib/supabase/admin.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces: `listAuthorizedUserIds(): Promise<string[]>`.

- [ ] **Step 1: Écrire les tests**

```ts
describe("listAuthorizedUserIds", () => {
  it("lève un message explicite si SUPABASE_SECRET_KEY manque", async () => {
    delete process.env.SUPABASE_SECRET_KEY;
    await expect(listAuthorizedUserIds()).rejects.toThrow(/SUPABASE_SECRET_KEY/);
  });

  it("ne rend que des identifiants au format UUID", async () => {
    // moquer @supabase/supabase-js pour rendre une ligne valide et une invalide
    expect(await listAuthorizedUserIds()).toEqual([
      "11111111-1111-4111-8111-111111111111",
    ]);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run src/lib/supabase/admin.test.ts` → FAIL.

- [ ] **Step 3: Implémenter**

```ts
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { USER_ID_PATTERN } from "../store";

/**
 * Accès Supabase avec la clé SERVICE-ROLE — celle qui contourne RLS.
 *
 * ⚠️ C'est la clé la plus puissante du projet. Elle n'existe que dans ce
 * fichier, et ce fichier n'exporte PAS le client : seulement les quelques
 * fonctions métier qui en ont besoin, chacune filtrant explicitement sur un
 * `user_id`. Le filet RLS n'existe pas sur ce chemin — la discipline le
 * remplace, et une surface réduite est ce qui rend cette discipline tenable.
 *
 * Pourquoi elle est nécessaire : les crons n'ont aucune session. Sans elle,
 * `/api/cron/reminders` ne peut pas savoir quels comptes existent.
 */
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_SECRET_KEY (ou NEXT_PUBLIC_SUPABASE_URL) manquante : les crons ne peuvent pas lister les comptes.",
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Les comptes autorisés. Source unique de l'itération des crons.
 *
 * Les identifiants sont refiltrés contre `USER_ID_PATTERN` : ils vont servir à
 * construire des chemins de fichiers, et une ligne aberrante en base ne doit
 * pas atteindre le système de fichiers.
 */
export async function listAuthorizedUserIds(): Promise<string[]> {
  const { data, error } = await adminClient().from("authorized_users").select("user_id");
  if (error) throw new Error(`Lecture de authorized_users impossible : ${error.message}`);
  return (data ?? [])
    .map((r) => r.user_id)
    .filter((id): id is string => typeof id === "string" && USER_ID_PATTERN.test(id));
}
```

Vérifier que `@supabase/supabase-js` est déjà une dépendance
(`node_modules/@supabase/supabase-js` existe via `@supabase/ssr`) ; si elle
n'est pas dans `package.json`, l'y ajouter explicitement plutôt que de
dépendre d'une dépendance transitive.

- [ ] **Step 4: Tests + commit**

Run: `npx vitest run src/lib/supabase/admin.test.ts` → PASS.

```bash
git add src/lib/supabase/admin.ts src/lib/supabase/admin.test.ts package.json
git commit -m "feat(supabase): listAuthorizedUserIds via la cle service-role"
```

---

### Task 4 : Porter les modules de `src/lib/`

**Files:**
- Modify: `src/lib/objective-reconcile.ts`, `src/lib/webpush.ts`,
  `src/lib/reminders.ts`, `src/lib/caldav.ts`
- Test: `src/lib/reminders.test.ts`, `src/lib/caldav.test.ts`,
  `src/lib/caldav.integration.test.ts`

**Interfaces:**
- Consumes: `type Store` (tâche 1).
- Produces:
  - `reconcileObjectivesInStore(store: Store, nowIso?: string): Promise<Objective[]>`
  - `sendPush(store: Store, sub, payload): Promise<SendOutcome>`
  - `sendPushToAll(store: Store, subs, payload): Promise<SendOutcome[]>`
  - `runReminders(store: Store, now?: Date): Promise<ReminderRun>`
  - `runCalDavSync(store: Store): Promise<CalDavSyncRun>`

- [ ] **Step 1: `objective-reconcile.ts`**

Ajouter `store: Store` en premier paramètre ; remplacer
`updateObjectivesAtomically(...)` par `store.updateObjectivesAtomically(...)`.
Le corps ne change pas.

- [ ] **Step 2: `webpush.ts`**

`sendPush` purge l'abonnement expiré (404/410) à la ligne 78 via
`removeSubscription`. Ajouter `store: Store` en premier paramètre de `sendPush`
et `sendPushToAll`, et remplacer l'appel par `store.removeSubscription(...)`.

Ajouter au commentaire de `sendPush` :

```
 * ⚠️ Le store est celui du DESTINATAIRE : purger un abonnement expiré doit
 * retirer la ligne du compte qui l'a enregistrée, jamais d'un autre.
```

- [ ] **Step 3: `reminders.ts`**

`runReminders(store: Store, now: Date = new Date())`. Remplacer `readItems()`,
`readSubscriptions()` et `patchItems()` par leurs équivalents sur `store`, et
passer `store` à `sendPushToAll`. `pendingReminders` reste **pure et
inchangée** — c'est elle que la majorité des tests couvrent.

- [ ] **Step 4: `caldav.ts`**

`runCalDavSync(store: Store)`. Remplacer les imports `patchItem`, `readItems`,
`saveItems` par les méthodes du store. Le garde-fou des 15 minutes lit et écrit
aujourd'hui `LAST_SYNC_FILE` directement dans `DATA_DIR` : basculer sur
`store.readLastCalDavSync()` / `store.writeLastCalDavSync()`.

**Ne pas toucher** aux variables d'environnement CalDAV dans ce lot : elles
restent globales jusqu'au lot 3. Ajouter un commentaire au-dessus de leur
déclaration :

```ts
// ⚠️ GLOBALES ET MONO-COMPTE — un seul compte iCloud pour toute l'app.
// Deviennent des identifiants par utilisateur au lot 3 du pivot
// (`docs/superpowers/specs/2026-08-31-pivot-multi-utilisateur-design.md`).
```

- [ ] **Step 5: Adapter les tests existants**

Dans `reminders.test.ts`, `caldav.test.ts` et `caldav.integration.test.ts`,
remplacer les moquages de `@/lib/store` par la construction d'un store de test
sur un répertoire temporaire (même patron que `store.test.ts`, tâche 1), ou par
un objet littéral implémentant les seules méthodes utilisées.

**Préférer le répertoire temporaire** : il teste le vrai chemin d'écriture, et
c'est ce que ces tests faisaient déjà indirectement.

- [ ] **Step 6: Vérifier**

Run: `npx vitest run && npx tsc --noEmit`
Expected: tout passe. Les routes appellent encore les exports libres, qui
existent toujours.

- [ ] **Step 7: Commit**

```bash
git add src/lib/
git commit -m "refactor(lib): reminders, caldav, webpush et objectifs prennent un Store"
```

---

### Task 5 : Porter les 13 routes à garde de session

**Files:**
- Modify: `src/app/api/{board/cards,board,chat,items/[id],items,objectives,overview,parse,projects,search,settings,tags/[id],tags}/route.ts`
- Test: `src/app/api/board/route.test.ts`, `src/app/api/board/cards/route.test.ts`, `src/app/api/settings/route.test.ts`

**Interfaces:**
- Consumes: `requireStore()` (tâche 2), `reconcileObjectivesInStore(store, …)` (tâche 4).
- Produces: rien de nouveau.

- [ ] **Step 1: Porter chaque route, une par une**

Transformation mécanique, identique partout :

```ts
// AVANT
const denied = await requireSession();
if (denied) return denied;
const items = await readItems();

// APRÈS
const session = await requireStore();
if (session instanceof Response) return session;
const { store } = session;
const items = await store.readItems();
```

Retirer l'import `@/lib/store` de chaque route, et passer `store` à
`reconcileObjectivesInStore` là où il est appelé (`board/cards`, `board`,
`items`, `items/[id]` — 6 appels au total).

Cas particulier : **`parse/route.ts`** n'utilise le store que pour
`readProjects()`. Elle passe quand même à `requireStore()` — les projets sont
des données de compte.

Ordre suggéré, du plus simple au plus complexe : `tags`, `tags/[id]`,
`search`, `parse`, `settings`, `projects`, `overview`, `chat`, `objectives`,
`board`, `board/cards`, `items`, `items/[id]`.

- [ ] **Step 2: Adapter les trois fichiers de test de routes**

`board/route.test.ts`, `board/cards/route.test.ts` et `settings/route.test.ts`
moquent aujourd'hui `@/lib/store` et `@/lib/guard`. Moquer désormais
`requireStore` pour qu'il rende `{ userId, store }` où `store` est bâti sur un
répertoire temporaire.

- [ ] **Step 3: Vérifier après chaque route**

Run: `npx vitest run && npx tsc --noEmit`

- [ ] **Step 4: Commit (un commit pour l'ensemble des 13)**

```bash
git add src/app/api/
git commit -m "refactor(api): les routes de session passent par requireStore()"
```

---

### Task 6 : Porter les routes machine et push

**Files:**
- Modify: `src/app/api/capture/route.ts`, `src/app/api/digest/route.ts`,
  `src/app/api/agenda/route.ts`, `src/app/api/push/subscribe/route.ts`,
  `src/app/api/push/test/route.ts`
- Test: `src/app/api/digest/route.test.ts`

**Interfaces:**
- Consumes: `requireStore`, `requireStoreOrMachineToken` (tâche 2).
- Produces: rien de nouveau.

- [ ] **Step 1: Les deux routes push**

`push/subscribe` et `push/test` passent de `requireSession()` à
`requireStore()`, et de `@/lib/push-store` au store. `parseSubscription`
s'importe désormais de `@/lib/push-subscription`. `push/test` passe `store` à
`sendPushToAll`.

- [ ] **Step 2: `agenda`**

`requireSessionOrMachineToken(req, "BRIEF_DIGEST_TOKEN", …)` →
`requireStoreOrMachineToken(req, "BRIEF_DIGEST_TOKEN", …)`, puis
`store.readItems()`.

- [ ] **Step 3: `capture` et `digest`**

Ces deux routes portent un jeton machine sans identité. Pendant ce lot, elles
écrivent dans le Brief de `BRIEF_OWNER_USER_ID` :

```ts
const denied = requireMachineToken(req, "BRIEF_CAPTURE_TOKEN");
if (denied) return denied;

// ⚠️ MONO-COMPTE JUSQU'AU LOT 2. Ce jeton ne porte aucune identité : il écrit
// dans le Brief du propriétaire. Le lot 2 le remplace par un jeton par compte
// (table `machine_tokens`), et cette constante disparaît.
const store = ownerStore();
if (store instanceof Response) return store;
```

Ajouter dans `src/lib/guard.ts` :

```ts
/**
 * Le store du compte propriétaire (`BRIEF_OWNER_USER_ID`).
 *
 * ⚠️ TRANSITOIRE — lot 1 seulement. Les jetons machine `capture` et `digest`
 * ne portent pas encore d'identité ; ils écrivent chez le propriétaire. Le lot
 * 2 les remplace par des jetons par compte et supprime cette fonction.
 *
 * Renvoie 503 plutôt qu'un store au hasard si la variable manque : une capture
 * vocale qui atterrit dans le mauvais Brief ne se voit pas.
 */
export function ownerStore(): Store | Response;
```

- [ ] **Step 4: Vérifier et commiter**

```bash
npx vitest run && npx tsc --noEmit && npx eslint .
git add src/app/api/
git commit -m "refactor(api): routes machine et push sur le store du compte"
```

---

### Task 7 : Les crons itèrent sur les comptes

**Files:**
- Modify: `src/app/api/cron/reminders/route.ts`, `src/app/api/cron/caldav-sync/route.ts`
- Create: `src/lib/cron-sweep.ts`
- Test: `src/lib/cron-sweep.test.ts`

**Interfaces:**
- Consumes: `listAuthorizedUserIds` (tâche 3), `storeForUser` (tâche 1),
  `runReminders`, `runCalDavSync` (tâche 4).
- Produces: `sweepUsers<T>(opts): Promise<SweepResult<T>>` où

```ts
export type SweepResult<T> = {
  runs: { userId: string; result: T }[];
  failures: { userId: string; error: string }[];
  deferred: string[];        // comptes non traités faute de temps
};
```

- [ ] **Step 1: Écrire les tests du balayage**

```ts
describe("sweepUsers", () => {
  it("un compte en échec n'empêche pas les suivants", async () => {
    const r = await sweepUsers({
      userIds: ["a", "b", "c"],
      budgetMs: 10_000,
      run: async (id) => {
        if (id === "b") throw new Error("items.json corrompu");
        return id;
      },
    });
    expect(r.runs.map((x) => x.result)).toEqual(["a", "c"]);
    expect(r.failures).toEqual([{ userId: "b", error: "items.json corrompu" }]);
  });

  it("reporte les comptes restants quand le budget est dépassé", async () => {
    const r = await sweepUsers({
      userIds: ["a", "b", "c"],
      budgetMs: 0,
      run: async (id) => id,
    });
    expect(r.runs).toHaveLength(1);       // le premier passe toujours
    expect(r.deferred).toEqual(["b", "c"]);
  });

  it("fait tourner l'ordre d'un passage à l'autre", async () => {
    const seen: string[][] = [];
    for (let pass = 0; pass < 3; pass++) {
      const order: string[] = [];
      await sweepUsers({
        userIds: ["a", "b", "c"],
        budgetMs: 10_000,
        offset: pass,
        run: async (id) => { order.push(id); return id; },
      });
      seen.push(order);
    }
    expect(seen).toEqual([["a", "b", "c"], ["b", "c", "a"], ["c", "a", "b"]]);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run src/lib/cron-sweep.test.ts` → FAIL.

- [ ] **Step 3: Implémenter `sweepUsers`**

```ts
/**
 * Parcourt les comptes en appliquant `run` à chacun.
 *
 * DEUX PROPRIÉTÉS, toutes deux invisibles si elles manquent :
 *
 *   1. UN ÉCHEC EST ISOLÉ. Sans le try/catch, un `items.json` corrompu chez un
 *      utilisateur éteindrait les rappels de TOUS les autres — et le cron
 *      continuerait de répondre 200.
 *
 *   2. L'ORDRE TOURNE. Si le budget de temps coupe toujours au même endroit,
 *      les derniers comptes ne seraient jamais traités et leurs rappels
 *      deviendraient `stale`, c'est-à-dire abandonnés silencieusement par
 *      `pendingReminders`. À 2-5 comptes c'est théorique ; la rotation coûte
 *      trois lignes et supprime la classe de bug.
 *
 * Le premier compte est TOUJOURS traité, même à budget nul : un budget mal
 * réglé doit dégrader le débit, jamais tout arrêter.
 */
export async function sweepUsers<T>(opts: {
  userIds: string[];
  budgetMs: number;
  run: (userId: string) => Promise<T>;
  offset?: number;
}): Promise<SweepResult<T>>;
```

Rotation : `const ordered = [...userIds.slice(k), ...userIds.slice(0, k)]` avec
`k = (offset ?? 0) % userIds.length` (garder `k = 0` si la liste est vide).

- [ ] **Step 4: Brancher les deux crons**

`reminders/route.ts` :

```ts
const denied = requireMachineToken(req, "BRIEF_CRON_TOKEN");
if (denied) return denied;

const startedAt = Date.now();
const userIds = await listAuthorizedUserIds();
const sweep = await sweepUsers({
  userIds,
  budgetMs: 40_000,                       // maxDuration vaut 50
  offset: Math.floor(startedAt / 60_000), // un cran par minute
  run: (userId) => runReminders(storeForUser(userId)),
});
```

Le journal reste chiffré **par compte** — un cron dont la sortie est vide ne
permet pas de distinguer « rien à faire » de « cassé depuis trois jours » :

```ts
for (const { userId, result } of sweep.runs) {
  console.log(`[cron] user=${userId} checked=${result.checked} due=${result.due} …`);
}
for (const f of sweep.failures) console.error(`[cron] user=${f.userId} en échec : ${f.error}`);
if (sweep.deferred.length) {
  console.warn(`[cron] budget atteint, ${sweep.deferred.length} compte(s) reporté(s)`);
}
```

`caldav-sync/route.ts` : même patron, mais la bascule des Réglages est **par
compte** — lire `store.readSettings()` à l'intérieur de `run` et sortir avant
tout appel réseau si `caldavSync` est faux, en conservant le commentaire
d'origine sur ce point.

- [ ] **Step 5: Vérifier et commiter**

```bash
npx vitest run && npx tsc --noEmit && npx eslint .
git add src/lib/cron-sweep.ts src/lib/cron-sweep.test.ts src/app/api/cron/
git commit -m "feat(cron): les passages iterent sur tous les comptes"
```

---

### Task 8 : Supprimer les exports globaux — la preuve de complétude

**Files:**
- Modify: `src/lib/store.ts`
- Delete: `src/lib/push-store.ts`

**Interfaces:**
- Consumes: tout ce qui précède.
- Produces: `src/lib/store.ts` n'exporte plus que `type Store`,
  `storeForUser`, `USER_ID_PATTERN`.

- [ ] **Step 1: Supprimer**

Retirer les 18 exports libres de `store.ts` et le fichier `push-store.ts`
(`git rm`). Mettre à jour l'en-tête du module : il annonce aujourd'hui « Brief
a exactement un utilisateur » — c'est devenu faux.

- [ ] **Step 2: Le typecheck est la preuve**

Run: `npx tsc --noEmit`
Expected: **0 erreur.** Chaque erreur ici est un consommateur oublié — la
corriger, ne jamais la contourner en réintroduisant un export libre.

- [ ] **Step 3: Vérifier et commiter**

```bash
npx vitest run && npx eslint .
git add -A src/lib/
git commit -m "refactor(store): supprime les exports globaux, le typecheck prouve le cloisonnement"
```

---

### Task 9 : La migration des données existantes

**Files:**
- Create: `src/lib/migrate-multiuser.ts`, `src/instrumentation.ts`
- Test: `src/lib/migrate-multiuser.test.ts`

**Interfaces:**
- Consumes: `USER_ID_PATTERN` (tâche 1).
- Produces: `migrateToMultiUser(): Promise<MigrationReport>` où

```ts
export type MigrationReport =
  | { status: "already-migrated" }
  | { status: "fresh-install" }
  | { status: "blocked"; reason: string }
  | { status: "migrated"; userId: string; files: string[] };
```

- [ ] **Step 1: Écrire les tests**

```ts
const OWNER = "11111111-1111-4111-8111-111111111111";

it("ne touche à rien sur une installation neuve", async () => {
  expect(await migrateToMultiUser()).toEqual({ status: "fresh-install" });
});

it("déplace les fichiers globaux vers le compte propriétaire", async () => {
  await writeFile(join(dir, "items.json"), '[{"id":"i1"}]');
  await writeFile(join(dir, "settings.json"), "{}");
  process.env.BRIEF_OWNER_USER_ID = OWNER;

  const r = await migrateToMultiUser();

  expect(r.status).toBe("migrated");
  expect(await readFile(join(dir, "users", OWNER, "items.json"), "utf8")).toContain("i1");
  // l'original est préservé, jamais supprimé
  expect(await readFile(join(dir, "_pre-multiuser", "items.json"), "utf8")).toContain("i1");
});

it("est idempotente : un second passage ne refait rien", async () => {
  await writeFile(join(dir, "items.json"), '[{"id":"i1"}]');
  process.env.BRIEF_OWNER_USER_ID = OWNER;

  await migrateToMultiUser();
  expect(await migrateToMultiUser()).toEqual({ status: "already-migrated" });
});

it("ne devine JAMAIS le propriétaire : sans la variable, elle ne touche rien", async () => {
  await writeFile(join(dir, "items.json"), '[{"id":"i1"}]');
  delete process.env.BRIEF_OWNER_USER_ID;

  const r = await migrateToMultiUser();

  expect(r.status).toBe("blocked");
  expect(await readdir(join(dir))).not.toContain("users");
});

it("refuse un BRIEF_OWNER_USER_ID qui n'est pas un UUID", async () => {
  await writeFile(join(dir, "items.json"), '[{"id":"i1"}]');
  process.env.BRIEF_OWNER_USER_ID = "../../etc";
  expect((await migrateToMultiUser()).status).toBe("blocked");
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run src/lib/migrate-multiuser.test.ts` → FAIL.

- [ ] **Step 3: Implémenter**

Les huit fichiers à migrer : `items.json`, `projects.json`, `boards.json`,
`tags.json`, `objectives.json`, `settings.json`, `push-subscriptions.json`,
`caldav-last-sync.json`.

Algorithme, dans cet ordre exact :

```
1. si users/<owner>/ existe (ou users/ contient déjà un compte) → already-migrated
2. si aucun des 8 fichiers n'existe à la racine                 → fresh-install
3. si BRIEF_OWNER_USER_ID absent ou non conforme à USER_ID_PATTERN → blocked
4. copier chaque fichier présent vers users/<owner>/
5. déplacer les originaux vers _pre-multiuser/
6. journaliser chaque fichier, rendre { status: "migrated", userId, files }
```

En-tête du module :

```ts
/**
 * Migration unique : les fichiers globaux d'avant le 2026-08-31 deviennent le
 * Brief du compte propriétaire.
 *
 * TROIS PROPRIÉTÉS :
 *
 *   1. IDEMPOTENTE. Rejouer un démarrage ne refait rien.
 *
 *   2. NON DESTRUCTIVE. Les originaux partent dans `_pre-multiuser/`, jamais
 *      à la corbeille. `deploy/backup.sh` les emporte comme le reste.
 *
 *   3. ELLE NE DEVINE JAMAIS. Sans `BRIEF_OWNER_USER_ID`, elle s'arrête et le
 *      dit. Un Brief vide se voit au premier écran ; des données attribuées au
 *      mauvais compte, non — et la synchro CalDAV les propagerait au calendrier
 *      Apple de quelqu'un d'autre avant que personne ne s'en aperçoive.
 */
```

- [ ] **Step 4: Brancher `instrumentation.ts`**

```ts
/**
 * `register()` est appelé UNE FOIS au démarrage du serveur et doit se terminer
 * avant la première requête (doc Next 16 :
 * `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md`).
 * C'est la seule garantie du framework qui convienne à une migration de
 * fichiers : une route ne doit jamais lire un `items.json` à moitié déplacé.
 */
export async function register() {
  // `register` s'exécute aussi en runtime Edge, où `node:fs` n'existe pas.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { migrateToMultiUser } = await import("./lib/migrate-multiuser");
    const report = await migrateToMultiUser();
    switch (report.status) {
      case "migrated":
        console.log(
          `[migration] ${report.files.length} fichier(s) attribué(s) au compte ${report.userId} : ${report.files.join(", ")}`,
        );
        break;
      case "blocked":
        console.error(`[migration] BLOQUÉE — ${report.reason}. Aucun fichier touché.`);
        break;
      case "already-migrated":
      case "fresh-install":
        console.log(`[migration] rien à faire (${report.status})`);
        break;
    }
  } catch (e) {
    // Une exception ici empêcherait le serveur de démarrer, écran de connexion
    // compris — même raisonnement que le garde-fou de `src/proxy.ts`.
    console.error("[migration] échec inattendu, démarrage poursuivi :", e);
  }
}
```

`migrateToMultiUser` ne doit **jamais lever** : une exception ici empêcherait
le serveur de démarrer. Envelopper l'appel dans un `try/catch` qui journalise
en `console.error` et laisse le serveur monter.

- [ ] **Step 5: Vérifier et commiter**

```bash
npx vitest run && npx tsc --noEmit && npx eslint .
git add src/lib/migrate-multiuser.ts src/lib/migrate-multiuser.test.ts src/instrumentation.ts
git commit -m "feat(migration): attribue les donnees existantes au compte proprietaire"
```

---

### Task 10 : Figer l'invariant de cloisonnement

**Files:**
- Create: `src/lib/no-direct-store-access.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces: rien.

- [ ] **Step 1: Écrire le test**

```ts
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Le cloisonnement repose sur UNE règle : une route obtient son store par
 * `requireStore()`, jamais en fabriquant un `storeForUser` avec un
 * identifiant qu'elle a choisi elle-même.
 *
 * Ce test la rend mécanique. Sans lui, la règle vit dans la documentation,
 * et une route ajoutée dans six mois la violerait sans que rien ne le
 * signale : le code compile, les tests passent, et un compte lit les données
 * d'un autre.
 *
 * Les crons et la migration ont le droit d'appeler `storeForUser` — ils
 * n'ont pas de session. D'où la liste d'exceptions, volontairement courte.
 */
const ALLOWED = [
  "src/app/api/cron/reminders/route.ts",
  "src/app/api/cron/caldav-sync/route.ts",
];

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

describe("cloisonnement", () => {
  it("aucune route ne fabrique un store elle-même", async () => {
    const offenders: string[] = [];
    for (const file of await walk("src/app/api")) {
      if (ALLOWED.includes(file)) continue;
      if ((await readFile(file, "utf8")).includes("storeForUser")) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Lancer**

Run: `npx vitest run src/lib/no-direct-store-access.test.ts`
Expected: PASS (les tâches 5 et 6 ont porté toutes les routes).

- [ ] **Step 3: Commit**

```bash
git add src/lib/no-direct-store-access.test.ts
git commit -m "test: fige l'invariant de cloisonnement des routes"
```

---

### Task 11 : Documentation et passation

**Files:**
- Modify: `AGENTS.md`, `DECISIONS.md`, `README.md`, `TODOS.md`, `HANDOFF.md`
- Create: `docs/handoffs/2026-08-31-pivot-multi-utilisateur-lot1.md` (archive de
  la passation remplacée)

- [ ] **Step 1: `DECISIONS.md`**

Nouvelle entrée en haut, avec le POURQUOI de chacune des six décisions du
tableau du spec, et la mention que le lot 3 (CalDAV par compte) est décidé mais
non implémenté.

- [ ] **Step 2: `AGENTS.md`**

- Le patron de garde devient `requireStore()` pour les routes qui touchent au
  store ; `requireSession()` reste pour les autres.
- La section « Stockage » indique la partition `users/<userId>/`.
- Nouvel invariant : « Le `userId` entre dans un chemin de fichier — il est
  validé contre `USER_ID_PATTERN`. »
- Nouvel invariant : « Aucune route n'appelle `storeForUser` ; un test le fige. »
- Les deux nouvelles variables d'environnement.

- [ ] **Step 3: `README.md`**

Ajouter `SUPABASE_SECRET_KEY` et `BRIEF_OWNER_USER_ID` au tableau des
variables, en précisant qu'elles sont **lues à l'exécution** (pas au build,
contrairement aux `NEXT_PUBLIC_*`).

- [ ] **Step 4: `TODOS.md`**

La section « Pivot multi-utilisateur Brief » devient : lot 1 fait, lots 2 et 3
décrits avec leur renvoi au spec.

- [ ] **Step 5: `HANDOFF.md`**

Nouvelle passation, gabarit de `docs/coordination.md` : Agent, Branche, Base,
Goal, Current state, Decisions, Blockers, Next action, **Validations avec les
trois états** (passant / échoué / non lancé). Archiver la précédente dans
`docs/handoffs/`.

Y inscrire explicitement les trois actions qui reviennent à Aramis : poser les
deux variables via Hermes, faire lancer `backup.sh` avant le déploiement, et ne
créer le compte agent **qu'après** vérification.

- [ ] **Step 6: Vérification finale et commit**

```bash
npx eslint . && npx tsc --noEmit && npx vitest run
git add -A
git commit -m "docs: passation du lot 1 multi-utilisateur"
```

---

## Definition of Done

- [ ] `npx eslint .` → 0 erreur, 0 warning
- [ ] `npx tsc --noEmit` → 0 erreur
- [ ] `npx vitest run` → tous passants, y compris les tests neufs
- [ ] `src/lib/store.ts` n'exporte plus aucune fonction globale
- [ ] `src/lib/push-store.ts` n'existe plus
- [ ] Aucune route sous `src/app/api/` n'appelle `storeForUser` (test figé)
- [ ] `HANDOFF.md` à jour, ancienne passation archivée
- [ ] **Non fait volontairement** : `npm run build` (un `next dev` tourne sur
      le port 3100 — règle du repo). À signaler comme *non lancé* dans les
      validations de la passation.
