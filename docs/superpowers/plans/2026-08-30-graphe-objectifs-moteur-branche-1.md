# Graphe & Objectifs — Moteur, Branche 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dependency graph usable — objectives visible and non-overlapping, editable objectives with real dependencies and auto-completion, a persisted layout, and the ability to remove a dependency — without any risky new interaction.

**Architecture:** Pure logic in `src/lib/objectives.ts` and `src/lib/graph.ts` (TDD, Vitest in UTC). A server-side reconcile pass keeps `Objective.achievedAt` in sync after any item or objective mutation. Layout persistence is client-side localStorage, same pattern as `src/lib/queue.ts`. UI changes are confined to `DesktopObjectives.tsx`, `DependencyGraph.tsx`, and `DesktopShell.tsx`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Vitest, Tailwind v4. JSON file store (`src/lib/store.ts`).

**Spec:** `docs/superpowers/specs/2026-08-30-graphe-objectifs-moteur-design.md` (§10 "Branche 1")

## Global Constraints

- **Priority 1 is the HIGHEST** (iCalendar). One scale everywhere.
- **No date math through `Date` local methods** (`setHours`, `getDay`, `getMonth`, `setDate`) — the server runs UTC. Use `src/lib/zoned.ts`. Not relevant to this branch's logic but holds if a date is touched.
- **Every `/api/` route starts with the session guard:** `const denied = await requireSession(); if (denied) return denied;`
- **An unreadable date becomes "no due date", never an approximate one.**
- **Tests run in UTC** — `vitest.config.mts` forces it. Never remove that line to fix a test.
- **Objective node ids are `obj:<objective.id>`** — `objectiveNodeId()` in `src/lib/objectives.ts` already produces this. Never let an `obj:` id collide with an `Item.id`.
- **Commit messages in English**, `type: subject` (`feat:`, `fix:`, `chore:`, `test:`, `docs:`). End every commit body with:
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01Wek1K5TEfnAQckCgM6h2cf
  ```
- **Never commit to `main`.** Branch is `feat/graphe-objectifs-moteur` (already created).
- **`dependsOn` on an item is capped at 20** (`sanitizePatch`). Objective `dependsOn` cap: 40 (tasks + objectives).
- **`npx tsc --noEmit` needs `next dev` to have run once** (regenerates `.next/dev/types` — `LayoutProps`). Run `next dev`, `curl -s localhost:PORT/ >/dev/null`, then `tsc`.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/lib/types.ts` | Shared types | Add `Objective.dependsOn?`, `Objective.achievedManually?` |
| `src/lib/store.ts` | JSON store | `readObjectives()` normalizes `dependsOn: []` in memory (like `normalizeItem`) |
| `src/lib/objectives.ts` | Pure objective logic | Add `effectiveDeps`, `objectiveSatisfied`, `reconcileObjectives` |
| `src/lib/objectives.test.ts` | Tests | New `describe` blocks for the three functions |
| `src/lib/graph.ts` | Pure graph logic | Add `layoutObjectives`; keep `graphTasks` unchanged this branch |
| `src/lib/graph.test.ts` | Tests | New `describe("layoutObjectives")` |
| `src/lib/objective-reconcile.ts` | **New** — server glue: read items+objectives, reconcile, write if changed | Create |
| `src/lib/objective-reconcile.test.ts` | **New** | Create |
| `src/app/api/objectives/route.ts` | Objectives API | `PATCH` accepts `dependsOn`; `GET` runs reconcile guard; `POST`/`PATCH` run reconcile |
| `src/app/api/objectives/route.test.ts` | Tests | Add `dependsOn` + reconcile cases |
| `src/app/api/items/route.ts` | Item done toggle | After `patchItems`/write, call `reconcileObjectivesAfterItemChange()` |
| `src/app/api/items/[id]/route.ts` | Item patch | After `patchItem`, call `reconcileObjectivesAfterItemChange()` when `doneAt`/`dependsOn`/`objectiveId` in patch |
| `src/lib/api.ts` | Client API helpers | `updateObjective` patch type gains `dependsOn`; add `removeObjectiveDep` convenience is NOT needed (reuse `updateObjective`) |
| `src/lib/graphLayout.ts` | **New** — localStorage read/write/prune for node positions | Create |
| `src/lib/graphLayout.test.ts` | **New** | Create |
| `src/components/desktop/DependencyGraph.tsx` | Graph view | Load/save `pinned` via `graphLayout`; render ALL active objectives via `layoutObjectives`; `onRemoveDependency` prop + edge-hover `×` + panel remove button |
| `src/components/desktop/DesktopObjectives.tsx` | Objectives screen | Inline edit (title/horizon/notes), reopen button, remove "Vue Asana" |
| `src/components/desktop/DesktopShell.tsx` | Desktop wiring | `handleRemoveDependency`; pass to graph; refresh objectives after dep/done changes |

---

## Task 1: Model — `Objective.dependsOn` + `achievedManually`

**Files:**
- Modify: `src/lib/types.ts:409-418`
- Modify: `src/lib/store.ts:120-126`
- Test: `src/lib/objectives.test.ts` (fixtures compile against new type)

**Interfaces:**
- Produces: `Objective` type with `dependsOn?: string[]` (item ids and `obj:<id>` strings) and `achievedManually?: boolean`.

- [ ] **Step 1: Extend the type**

In `src/lib/types.ts`, the `Objective` type:

```ts
export type Objective = {
  id: string;
  projectId: string;
  title: string;
  horizon: ObjectiveHorizon;
  createdAt: string;
  /** Posé quand l'objectif est atteint — le nœud quitte le graphe. */
  achievedAt: string | null;
  notes?: string;
  /**
   * Dépendances explicites : ids d'items ET d'objectifs (ces derniers
   * préfixés `obj:`). En plus des tâches qui pointent via `Item.objectiveId`.
   */
  dependsOn?: string[];
  /**
   * `true` = atteint par un geste explicite d'Aramis (collant, jamais rouvert
   * automatiquement). `false`/absent = atteint par convergence des dépendances
   * (réversible : se rouvre si une dépendance redevient non faite).
   */
  achievedManually?: boolean;
};
```

- [ ] **Step 2: Normalize on read**

In `src/lib/store.ts`, `readObjectives()`:

```ts
export async function readObjectives(): Promise<Objective[]> {
  const stored = await readJson<Objective[]>("objectives.json", []);
  return stored.map((o) => ({
    ...o,
    dependsOn: Array.isArray(o.dependsOn) ? o.dependsOn : [],
  }));
}
```

- [ ] **Step 3: Run typecheck**

Run: `npx next dev &` then `curl -s localhost:3000/ >/dev/null` then `npx tsc --noEmit`
Expected: 0 errors. Kill `next dev` after.

- [ ] **Step 4: Run existing objective tests**

Run: `npx vitest run src/lib/objectives.test.ts`
Expected: PASS (existing tests still green — new optional fields don't break fixtures).

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/store.ts
git commit -m "feat: Objective gains dependsOn and achievedManually"
```

---

## Task 2: `effectiveDeps` — the combined dependency set

**Files:**
- Modify: `src/lib/objectives.ts` (add function after `objectiveEdges`)
- Test: `src/lib/objectives.test.ts` (new `describe`)

**Interfaces:**
- Consumes: `Objective` (Task 1), `Item`, `objectiveNodeId`.
- Produces:
  ```ts
  // Resolved dependency nodes of an objective:
  //  - items whose objectiveId === objective.id  (implicit link)
  //  - objective.dependsOn entries (item ids + "obj:<id>")
  // Returns { itemIds: string[]; objectiveIds: string[] } — deduped, order stable.
  export function effectiveDeps(
    objective: Objective,
    items: Item[],
    objectives: Objective[],
  ): { itemIds: string[]; objectiveIds: string[] }
  ```

- [ ] **Step 1: Write the failing test**

```ts
describe("effectiveDeps", () => {
  it("réunit les tâches liées par objectiveId et les dependsOn explicites, dédupliqués", () => {
    const items = [
      makeItem({ id: "t1", objectiveId: "portfolio-pret" }),
      makeItem({ id: "t2", objectiveId: "portfolio-pret" }),
      makeItem({ id: "t3" }),
    ];
    const obj: Objective = { ...objCourt, dependsOn: ["t2", "t3", "obj:rejoindre-webacademie"] };
    const deps = effectiveDeps(obj, items, [obj, objWeb]);
    expect(deps.itemIds.sort()).toEqual(["t1", "t2", "t3"]);
    expect(deps.objectiveIds).toEqual(["rejoindre-webacademie"]);
  });

  it("ignore un dependsOn qui pointe vers un objectif inexistant", () => {
    const obj: Objective = { ...objCourt, dependsOn: ["obj:fantome"] };
    expect(effectiveDeps(obj, [], [obj]).objectiveIds).toEqual([]);
  });

  it("ignore un dependsOn item inexistant", () => {
    const obj: Objective = { ...objCourt, dependsOn: ["ghost"] };
    expect(effectiveDeps(obj, [], [obj]).itemIds).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (`effectiveDeps is not a function`)

Run: `npx vitest run src/lib/objectives.test.ts -t effectiveDeps`

- [ ] **Step 3: Implement**

```ts
export function effectiveDeps(
  objective: Objective,
  items: Item[],
  objectives: Objective[],
): { itemIds: string[]; objectiveIds: string[] } {
  const itemById = new Map(items.map((it) => [it.id, it]));
  const objById = new Map(objectives.map((o) => [o.id, o]));

  const itemIds: string[] = [];
  const objectiveIds: string[] = [];
  const seenItems = new Set<string>();
  const seenObjs = new Set<string>();

  for (const it of items) {
    if (it.objectiveId === objective.id && !seenItems.has(it.id)) {
      seenItems.add(it.id);
      itemIds.push(it.id);
    }
  }
  for (const raw of objective.dependsOn ?? []) {
    if (raw.startsWith("obj:")) {
      const id = raw.slice(4);
      if (id !== objective.id && objById.has(id) && !seenObjs.has(id)) {
        seenObjs.add(id);
        objectiveIds.push(id);
      }
    } else if (itemById.has(raw) && !seenItems.has(raw)) {
      seenItems.add(raw);
      itemIds.push(raw);
    }
  }
  return { itemIds, objectiveIds };
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run src/lib/objectives.test.ts -t effectiveDeps`

- [ ] **Step 5: Commit**

```bash
git add src/lib/objectives.ts src/lib/objectives.test.ts
git commit -m "feat: effectiveDeps resolves an objective's combined dependency set"
```

---

## Task 3: `objectiveSatisfied`

**Files:**
- Modify: `src/lib/objectives.ts`
- Test: `src/lib/objectives.test.ts`

**Interfaces:**
- Consumes: `effectiveDeps` (Task 2).
- Produces:
  ```ts
  // true when the objective has >=1 effective dependency and ALL of them are
  // complete: dependency-items have doneAt; dependency-objectives have achievedAt.
  // A recurring task (rrule != null) never counts as complete (matches
  // completion.ts: it advances, it doesn't finish).
  export function objectiveSatisfied(
    objective: Objective,
    items: Item[],
    objectives: Objective[],
  ): boolean
  ```

- [ ] **Step 1: Write the failing test**

```ts
describe("objectiveSatisfied", () => {
  it("faux si aucune dépendance", () => {
    expect(objectiveSatisfied({ ...objCourt, dependsOn: [] }, [], [objCourt])).toBe(false);
  });

  it("vrai quand toutes les tâches liées sont faites", () => {
    const items = [
      makeItem({ id: "t1", objectiveId: "portfolio-pret", doneAt: "2026-08-29T10:00:00.000Z" }),
      makeItem({ id: "t2", objectiveId: "portfolio-pret", doneAt: "2026-08-29T11:00:00.000Z" }),
    ];
    expect(objectiveSatisfied(objCourt, items, [objCourt])).toBe(true);
  });

  it("faux si une tâche liée reste à faire", () => {
    const items = [
      makeItem({ id: "t1", objectiveId: "portfolio-pret", doneAt: "2026-08-29T10:00:00.000Z" }),
      makeItem({ id: "t2", objectiveId: "portfolio-pret" }),
    ];
    expect(objectiveSatisfied(objCourt, items, [objCourt])).toBe(false);
  });

  it("faux si une tâche liée est récurrente, même 'faite'", () => {
    const items = [
      makeItem({ id: "t1", objectiveId: "portfolio-pret", rrule: "FREQ=WEEKLY;BYDAY=MO", doneAt: "2026-08-29T10:00:00.000Z" }),
    ];
    expect(objectiveSatisfied(objCourt, items, [objCourt])).toBe(false);
  });

  it("suit les objectifs-dépendances : vrai seulement si l'objectif amont est atteint", () => {
    const upstream: Objective = { ...objCourt, id: "amont", achievedAt: null };
    const downstream: Objective = { ...objWeb, dependsOn: ["obj:amont"] };
    expect(objectiveSatisfied(downstream, [], [upstream, downstream])).toBe(false);
    const upstreamDone = { ...upstream, achievedAt: "2026-08-30T00:00:00.000Z" };
    expect(objectiveSatisfied(downstream, [], [upstreamDone, downstream])).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run src/lib/objectives.test.ts -t objectiveSatisfied`

- [ ] **Step 3: Implement**

```ts
export function objectiveSatisfied(
  objective: Objective,
  items: Item[],
  objectives: Objective[],
): boolean {
  const { itemIds, objectiveIds } = effectiveDeps(objective, items, objectives);
  if (itemIds.length === 0 && objectiveIds.length === 0) return false;

  const itemById = new Map(items.map((it) => [it.id, it]));
  const objById = new Map(objectives.map((o) => [o.id, o]));

  for (const id of itemIds) {
    const it = itemById.get(id);
    if (!it) return false;
    if (it.rrule) return false; // récurrente : jamais "finie"
    if (!it.doneAt) return false;
  }
  for (const id of objectiveIds) {
    const o = objById.get(id);
    if (!o || !o.achievedAt) return false;
  }
  return true;
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run src/lib/objectives.test.ts -t objectiveSatisfied`

- [ ] **Step 5: Commit**

```bash
git add src/lib/objectives.ts src/lib/objectives.test.ts
git commit -m "feat: objectiveSatisfied — all effective dependencies complete"
```

---

## Task 4: `reconcileObjectives`

**Files:**
- Modify: `src/lib/objectives.ts`
- Test: `src/lib/objectives.test.ts`

**Interfaces:**
- Consumes: `objectiveSatisfied` (Task 3).
- Produces:
  ```ts
  // Returns a NEW objectives array with achievedAt recomputed for auto objectives.
  //  - active + satisfied + !achievedManually    -> achievedAt = nowIso
  //  - achievedAt set + !achievedManually + !satisfied -> achievedAt = null
  //  - achievedManually true                     -> untouched
  // Order preserved. Referential: unchanged objects kept by identity.
  // Iterates to a fixpoint (an objective→objective chain can cascade).
  export function reconcileObjectives(
    items: Item[],
    objectives: Objective[],
    nowIso: string,
  ): Objective[]
  ```

- [ ] **Step 1: Write the failing test**

```ts
describe("reconcileObjectives", () => {
  const NOW = "2026-08-30T12:00:00.000Z";

  it("auto-atteint un objectif dont toutes les tâches sont faites", () => {
    const items = [makeItem({ id: "t1", objectiveId: "portfolio-pret", doneAt: NOW })];
    const [out] = reconcileObjectives(items, [{ ...objCourt, achievedAt: null }], NOW);
    expect(out.achievedAt).toBe(NOW);
  });

  it("rouvre un objectif auto-atteint quand une tâche redevient à faire", () => {
    const items = [makeItem({ id: "t1", objectiveId: "portfolio-pret" })];
    const prev: Objective = { ...objCourt, achievedAt: "2026-08-29T00:00:00.000Z", achievedManually: false };
    const [out] = reconcileObjectives(items, [prev], NOW);
    expect(out.achievedAt).toBeNull();
  });

  it("ne touche jamais un objectif atteint à la main", () => {
    const prev: Objective = { ...objCourt, achievedAt: "2026-08-29T00:00:00.000Z", achievedManually: true };
    const [out] = reconcileObjectives([], [prev], NOW);
    expect(out.achievedAt).toBe("2026-08-29T00:00:00.000Z");
  });

  it("cascade : un objectif aval s'atteint quand son objectif amont vient de s'atteindre", () => {
    const items = [makeItem({ id: "t1", objectiveId: "amont", doneAt: NOW })];
    const amont: Objective = { ...objCourt, id: "amont", achievedAt: null };
    const aval: Objective = { ...objWeb, id: "aval", dependsOn: ["obj:amont"], achievedAt: null };
    const out = reconcileObjectives(items, [amont, aval], NOW);
    expect(out.find((o) => o.id === "amont")!.achievedAt).toBe(NOW);
    expect(out.find((o) => o.id === "aval")!.achievedAt).toBe(NOW);
  });

  it("préserve l'identité des objets non modifiés", () => {
    const untouched: Objective = { ...objSport, achievedAt: null };
    const [out] = reconcileObjectives([], [untouched], NOW);
    expect(out).toBe(untouched);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

```ts
export function reconcileObjectives(
  items: Item[],
  objectives: Objective[],
  nowIso: string,
): Objective[] {
  let current = objectives;
  // Fixpoint : au plus N passes (chaîne d'objectifs de profondeur N).
  for (let pass = 0; pass < objectives.length + 1; pass++) {
    let changed = false;
    const next = current.map((o) => {
      if (o.achievedManually) return o;
      const sat = objectiveSatisfied(o, items, current);
      if (sat && !o.achievedAt) {
        changed = true;
        return { ...o, achievedAt: nowIso };
      }
      if (!sat && o.achievedAt) {
        changed = true;
        return { ...o, achievedAt: null };
      }
      return o;
    });
    current = next;
    if (!changed) break;
  }
  return current;
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run src/lib/objectives.test.ts -t reconcileObjectives`

- [ ] **Step 5: Commit**

```bash
git add src/lib/objectives.ts src/lib/objectives.test.ts
git commit -m "feat: reconcileObjectives recomputes auto achievedAt to a fixpoint"
```

---

## Task 5: Server glue — `objective-reconcile.ts`

**Files:**
- Create: `src/lib/objective-reconcile.ts`
- Create: `src/lib/objective-reconcile.test.ts`

**Interfaces:**
- Consumes: `reconcileObjectives` (Task 4), `readItems`, `readObjectives`, `writeObjectives` from `src/lib/store.ts`.
- Produces:
  ```ts
  // Reads items + objectives, reconciles, writes objectives.json ONLY if the
  // array changed (referential comparison element-wise). Returns the (possibly
  // unchanged) objectives array. Safe to call from any route after a mutation.
  export async function reconcileObjectivesInStore(nowIso?: string): Promise<Objective[]>
  ```

- [ ] **Step 1: Write the failing test** (`src/lib/objective-reconcile.test.ts`)

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "brief-reconcile-"));
  process.env.BRIEF_DATA_DIR = dir;
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("reconcileObjectivesInStore", () => {
  it("écrit objectives.json quand un objectif devient auto-atteint", async () => {
    await writeFile(join(dir, "items.json"), JSON.stringify([
      { id: "t1", kind: "task", title: "x", projectId: "p", due: null, allDay: false,
        priority: 3, rrule: null, createdAt: "2026-08-01T00:00:00.000Z", remindedAt: null,
        doneAt: "2026-08-30T10:00:00.000Z", status: "active", objectiveId: "o1" },
    ]));
    await writeFile(join(dir, "objectives.json"), JSON.stringify([
      { id: "o1", projectId: "p", title: "But", horizon: "moyen",
        createdAt: "2026-08-01T00:00:00.000Z", achievedAt: null },
    ]));
    const { reconcileObjectivesInStore } = await import("./objective-reconcile");
    const out = await reconcileObjectivesInStore("2026-08-30T12:00:00.000Z");
    expect(out[0].achievedAt).toBe("2026-08-30T12:00:00.000Z");
    const onDisk = JSON.parse(await readFile(join(dir, "objectives.json"), "utf8"));
    expect(onDisk[0].achievedAt).toBe("2026-08-30T12:00:00.000Z");
  });

  it("n'écrit pas quand rien ne change", async () => {
    await writeFile(join(dir, "items.json"), JSON.stringify([]));
    await writeFile(join(dir, "objectives.json"), JSON.stringify([
      { id: "o1", projectId: "p", title: "But", horizon: "moyen",
        createdAt: "2026-08-01T00:00:00.000Z", achievedAt: null },
    ]));
    const mtimeBefore = (await import("node:fs")).statSync(join(dir, "objectives.json")).mtimeMs;
    const { reconcileObjectivesInStore } = await import("./objective-reconcile");
    await reconcileObjectivesInStore();
    const mtimeAfter = (await import("node:fs")).statSync(join(dir, "objectives.json")).mtimeMs;
    expect(mtimeAfter).toBe(mtimeBefore);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (module missing)

Run: `npx vitest run src/lib/objective-reconcile.test.ts`

- [ ] **Step 3: Implement** (`src/lib/objective-reconcile.ts`)

```ts
import "server-only";
import { reconcileObjectives } from "./objectives";
import { readItems, readObjectives, writeObjectives } from "./store";
import type { Objective } from "./types";

/**
 * Recalcule `achievedAt` des objectifs auto d'après l'état courant des items,
 * et n'écrit `objectives.json` que si quelque chose a bougé. À appeler depuis
 * une route API après toute mutation qui peut affecter la complétion :
 * coche/décoche d'une tâche, changement de `dependsOn` ou `objectiveId`, ou
 * édition des dépendances d'un objectif.
 */
export async function reconcileObjectivesInStore(
  nowIso: string = new Date().toISOString(),
): Promise<Objective[]> {
  const [items, objectives] = await Promise.all([readItems(), readObjectives()]);
  const next = reconcileObjectives(items, objectives, nowIso);
  const changed =
    next.length !== objectives.length || next.some((o, i) => o !== objectives[i]);
  if (changed) await writeObjectives(next);
  return next;
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/lib/objective-reconcile.ts src/lib/objective-reconcile.test.ts
git commit -m "feat: reconcileObjectivesInStore — server-side reconcile with write-if-changed"
```

---

## Task 6: Wire reconcile into the objectives + items routes

**Files:**
- Modify: `src/app/api/objectives/route.ts` (PATCH accepts `dependsOn`; GET + POST + PATCH + DELETE call reconcile)
- Modify: `src/app/api/items/route.ts` (after the done-toggle write)
- Modify: `src/app/api/items/[id]/route.ts` (after `patchItem`, when relevant keys present)
- Modify: `src/app/api/objectives/route.test.ts`

**Interfaces:**
- Consumes: `reconcileObjectivesInStore` (Task 5).
- Produces: `PATCH /api/objectives` accepts `{ dependsOn?: string[] }` (strings; `obj:` prefix allowed; cap 40; self-reference `obj:<own id>` dropped). All objective mutations and the item done-toggle leave `objectives.json` reconciled.

- [ ] **Step 1: Write the failing test** (`src/app/api/objectives/route.test.ts`)

```ts
it("PATCH accepte dependsOn et le nettoie (cap 40, pas d'auto-référence)", async () => {
  // ... set up store with objective "o1" ...
  const res = await PATCH(new Request("http://t/api/objectives", {
    method: "PATCH",
    body: JSON.stringify({ id: "o1", dependsOn: ["t1", "obj:o1", "obj:o2", 42, "  "] }),
  }));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.dependsOn).toEqual(["t1", "obj:o2"]); // o1 self-ref + non-strings dropped
});

it("GET réconcilie : un objectif dont la tâche liée est faite ressort atteint", async () => {
  // store: item t1 doneAt set, objectiveId "o1"; objective o1 achievedAt null
  const res = await GET(new Request("http://t/api/objectives"));
  const body = await res.json();
  expect(body.find((o) => o.id === "o1").achievedAt).not.toBeNull();
});
```

(Match the existing test file's store-setup helper — it already uses a temp `BRIEF_DATA_DIR`.)

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run src/app/api/objectives/route.test.ts`

- [ ] **Step 3: Implement**

In `src/app/api/objectives/route.ts`:

```ts
// at top
import { reconcileObjectivesInStore } from "@/lib/objective-reconcile";

const MAX_DEPS = 40;

function cleanDeps(v: unknown, ownId: string): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v
    .filter((d): d is string => typeof d === "string" && d.trim().length > 0)
    .map((d) => d.trim())
    .filter((d) => d !== `obj:${ownId}`)
    .slice(0, MAX_DEPS);
}
```

In `PATCH`, after the existing `notes` branch:

```ts
if (body.dependsOn !== undefined) {
  const deps = cleanDeps(body.dependsOn, id);
  if (deps) patch.dependsOn = deps;
}
```

After a successful `writeObjectives(next)` in POST, PATCH, DELETE — and at the end of GET before `Response.json` — call:

```ts
// GET: replace the return with
return Response.json(await reconcileObjectivesInStore());
```

```ts
// POST / PATCH / DELETE: after writeObjectives(...) succeeds, before Response.json
await reconcileObjectivesInStore();
```

For POST/PATCH the response should still return the created/updated objective; call reconcile, then re-read that one objective from the reconciled list so the client sees its true `achievedAt`:

```ts
const reconciled = await reconcileObjectivesInStore();
return Response.json(reconciled.find((o) => o.id === created.id) ?? created, { status: 201 });
```

In `src/app/api/items/route.ts`, in the `PATCH` handler, after the item write succeeds (after `completionPatch` is applied and persisted), add:

```ts
import { reconcileObjectivesInStore } from "@/lib/objective-reconcile";
// ...after the item(s) are written:
await reconcileObjectivesInStore();
```

In `src/app/api/items/[id]/route.ts`, in `PATCH`, after `const updated = await patchItem(id, patch);` and the `if (!updated)` guard:

```ts
import { reconcileObjectivesInStore } from "@/lib/objective-reconcile";
// ...
if ("doneAt" in patch || "dependsOn" in patch || "objectiveId" in patch) {
  await reconcileObjectivesInStore();
}
```

Note: `sanitizePatch` never sets `doneAt` (done toggle is the collection route), so in practice `[id]` triggers on `dependsOn`/`objectiveId`. Keep the `doneAt` check for safety.

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run src/app/api/objectives/route.test.ts src/app/api/items`

- [ ] **Step 5: Typecheck + full suite**

Run: `npx tsc --noEmit` (after `next dev` + curl) then `npx vitest run`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/objectives/route.ts src/app/api/objectives/route.test.ts src/app/api/items/route.ts "src/app/api/items/[id]/route.ts"
git commit -m "feat: reconcile objectives after item and objective mutations; PATCH accepts dependsOn"
```

---

## Task 7: `layoutObjectives` — fix the overlap, place all objectives

**Files:**
- Modify: `src/lib/graph.ts` (add after `layoutGraph`)
- Test: `src/lib/graph.test.ts`

**Interfaces:**
- Consumes: `Point`, `GraphMetrics`, `effectiveDeps` (Task 2), `objectiveNodeId`.
- Produces:
  ```ts
  export const OBJ_METRICS = { W: 230, H: 58, GAP_X: 130, VGAP: 20 } as const;

  // Places every active objective in its own right-side lane so a node never
  // overlaps a task/event node.
  //  - lane x0 = (max node x in `nodePositions`) + metrics.W + OBJ_METRICS.GAP_X
  //  - an objective depending on another objective -> next lane to the right
  //  - vertical anchor = mean y of placed dependency nodes (task ids resolved
  //    from nodePositions, obj ids from already-placed objectives); no placed
  //    dep -> stacked from the lane top
  //  - within a lane: sort by anchor, stack with OBJ_METRICS.VGAP min gap
  // Returns Map<objNodeId ("obj:<id>"), Point>. Honours `pinned` (obj node ids).
  export function layoutObjectives(
    objectives: Objective[],
    items: Item[],
    nodePositions: Map<string, Point>,
    metrics: GraphMetrics,
    pinned?: Record<string, Point>,
  ): Map<string, Point>
  ```

- [ ] **Step 1: Write the failing test**

```ts
import { layoutObjectives, OBJ_METRICS } from "./graph";

describe("layoutObjectives", () => {
  const M = COMPACT;
  const objCourt = { id: "oc", projectId: "p", title: "Court", horizon: "court" as const, createdAt: "", achievedAt: null };
  const objLong = { id: "ol", projectId: "p", title: "Long", horizon: "long" as const, createdAt: "", achievedAt: null, dependsOn: ["obj:oc"] };

  it("place l'objectif dans un couloir à droite de tous les nœuds tâches", () => {
    const nodes = new Map([["t1", { x: 0, y: 0 }], ["t2", { x: 500, y: 200 }]]);
    const items = [item({ id: "t1", objectiveId: "oc" })];
    const pos = layoutObjectives([objCourt], items, nodes, M);
    const p = pos.get("obj:oc")!;
    expect(p.x).toBe(500 + M.W + OBJ_METRICS.GAP_X);
  });

  it("un objectif qui dépend d'un objectif va une colonne plus à droite", () => {
    const nodes = new Map([["t1", { x: 0, y: 0 }]]);
    const items = [item({ id: "t1", objectiveId: "oc" })];
    const pos = layoutObjectives([objCourt, objLong], items, nodes, M);
    expect(pos.get("obj:ol")!.x).toBeGreaterThan(pos.get("obj:oc")!.x);
  });

  it("deux objectifs ancrés au même y ne se superposent pas", () => {
    const nodes = new Map([["t1", { x: 0, y: 100 }], ["t2", { x: 0, y: 100 }]]);
    const items = [item({ id: "t1", objectiveId: "oc" }), item({ id: "t2", objectiveId: "od" })];
    const objD = { ...objCourt, id: "od" };
    const pos = layoutObjectives([objCourt, objD], items, nodes, M);
    const a = pos.get("obj:oc")!;
    const b = pos.get("obj:od")!;
    expect(Math.abs(a.y - b.y)).toBeGreaterThanOrEqual(OBJ_METRICS.H);
  });

  it("un objectif épinglé garde sa position", () => {
    const pos = layoutObjectives([objCourt], [], new Map(), M, { "obj:oc": { x: 42, y: 99 } });
    expect(pos.get("obj:oc")).toEqual({ x: 42, y: 99 });
  });

  it("objectif sans dépendance placée : empilé depuis le haut du couloir", () => {
    const pos = layoutObjectives([objCourt], [], new Map(), M);
    expect(pos.get("obj:oc")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run src/lib/graph.test.ts -t layoutObjectives`

- [ ] **Step 3: Implement** in `src/lib/graph.ts`

```ts
import { effectiveDeps, objectiveNodeId } from "./objectives";
import type { Objective } from "./types";

export const OBJ_METRICS = { W: 230, H: 58, GAP_X: 130, VGAP: 20 } as const;

export function layoutObjectives(
  objectives: Objective[],
  items: Item[],
  nodePositions: Map<string, Point>,
  metrics: GraphMetrics,
  pinned: Record<string, Point> = {},
): Map<string, Point> {
  const active = objectives.filter((o) => !o.achievedAt);
  const out = new Map<string, Point>();
  if (active.length === 0) return out;

  const baseX = Math.max(
    0,
    ...[...nodePositions.values()].map((p) => p.x),
  ) + metrics.W + OBJ_METRICS.GAP_X;

  // Colonne (0, 1, 2…) : distance en nombre d'objectifs-dépendances.
  const colOf = new Map<string, number>();
  const depth = (o: Objective, guard: Set<string>): number => {
    if (colOf.has(o.id)) return colOf.get(o.id)!;
    if (guard.has(o.id)) return 0;
    guard.add(o.id);
    const { objectiveIds } = effectiveDeps(o, items, active);
    let d = 0;
    for (const upId of objectiveIds) {
      const up = active.find((x) => x.id === upId);
      if (up) d = Math.max(d, depth(up, guard) + 1);
    }
    guard.delete(o.id);
    colOf.set(o.id, d);
    return d;
  };
  active.forEach((o) => depth(o, new Set()));

  const anchorY = (o: Objective): number => {
    const { itemIds, objectiveIds } = effectiveDeps(o, items, active);
    const ys: number[] = [];
    for (const id of itemIds) {
      const p = nodePositions.get(id);
      if (p) ys.push(p.y);
    }
    for (const id of objectiveIds) {
      const p = out.get(objectiveNodeId({ id } as Objective));
      if (p) ys.push(p.y);
    }
    return ys.length ? ys.reduce((s, y) => s + y, 0) / ys.length : Number.POSITIVE_INFINITY;
  };

  const maxCol = Math.max(...[...colOf.values()]);
  for (let col = 0; col <= maxCol; col++) {
    const inCol = active
      .filter((o) => colOf.get(o.id) === col)
      .map((o) => ({ o, y: anchorY(o) }))
      .sort((a, b) => a.y - b.y || a.o.id.localeCompare(b.o.id));

    let cursorY = 0;
    for (const { o, y } of inCol) {
      const wanted = Number.isFinite(y) ? y : cursorY;
      const placedY = Math.max(wanted, cursorY);
      const x = baseX + col * (OBJ_METRICS.W + OBJ_METRICS.GAP_X);
      out.set(objectiveNodeId(o), { x, y: placedY });
      cursorY = placedY + OBJ_METRICS.H + OBJ_METRICS.VGAP;
    }
  }

  for (const [id, p] of Object.entries(pinned)) {
    if (out.has(id)) out.set(id, p);
  }
  return out;
}
```

Note the `describe` block needs a local `item()` helper — reuse the file's existing one (defined at top of `graph.test.ts`).

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run src/lib/graph.test.ts -t layoutObjectives`

- [ ] **Step 5: Check for import cycle**

`graph.ts` now imports from `objectives.ts`. `objectives.ts` must NOT import from `graph.ts`. Verify:

Run: `grep -n "from \"./graph\"" src/lib/objectives.ts`
Expected: no output.

- [ ] **Step 6: Full suite + typecheck**

Run: `npx vitest run` then `npx tsc --noEmit` (after next dev + curl)

- [ ] **Step 7: Commit**

```bash
git add src/lib/graph.ts src/lib/graph.test.ts
git commit -m "feat: layoutObjectives places every objective in a right-side lane, no overlap"
```

---

## Task 8: `graphLayout.ts` — localStorage persistence

**Files:**
- Create: `src/lib/graphLayout.ts`
- Create: `src/lib/graphLayout.test.ts`

**Interfaces:**
- Produces:
  ```ts
  const KEY = "brief:graph-layout";
  export function loadGraphLayout(knownIds: Set<string>): Record<string, Point>
  //   reads localStorage, drops entries whose id is not in knownIds, returns {}
  //   on any error / SSR (typeof window === "undefined")
  export function saveGraphLayout(positions: Record<string, Point>): void
  //   writes; no-op on error / SSR
  export function clearGraphLayout(): void
  ```
  (`Point` imported from `./graph`.)

- [ ] **Step 1: Write the failing test** (`src/lib/graphLayout.test.ts`)

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadGraphLayout, saveGraphLayout, clearGraphLayout } from "./graphLayout";

function fakeStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  } as unknown as Storage;
}

afterEach(() => vi.unstubAllGlobals());

describe("graphLayout", () => {
  it("save puis load rend les positions connues", () => {
    vi.stubGlobal("window", { localStorage: fakeStorage() });
    saveGraphLayout({ a: { x: 1, y: 2 }, b: { x: 3, y: 4 } });
    expect(loadGraphLayout(new Set(["a", "b"]))).toEqual({ a: { x: 1, y: 2 }, b: { x: 3, y: 4 } });
  });

  it("load élague les ids inconnus", () => {
    vi.stubGlobal("window", { localStorage: fakeStorage() });
    saveGraphLayout({ a: { x: 1, y: 2 }, gone: { x: 9, y: 9 } });
    expect(loadGraphLayout(new Set(["a"]))).toEqual({ a: { x: 1, y: 2 } });
  });

  it("load renvoie {} sans window", () => {
    vi.stubGlobal("window", undefined);
    expect(loadGraphLayout(new Set(["a"]))).toEqual({});
  });

  it("load renvoie {} sur JSON corrompu", () => {
    const s = fakeStorage();
    s.setItem("brief:graph-layout", "{not json");
    vi.stubGlobal("window", { localStorage: s });
    expect(loadGraphLayout(new Set(["a"]))).toEqual({});
  });

  it("clear vide la clé", () => {
    vi.stubGlobal("window", { localStorage: fakeStorage() });
    saveGraphLayout({ a: { x: 1, y: 2 } });
    clearGraphLayout();
    expect(loadGraphLayout(new Set(["a"]))).toEqual({});
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement** (`src/lib/graphLayout.ts`)

```ts
import type { Point } from "./graph";

const KEY = "brief:graph-layout";

/**
 * Disposition du graphe mémorisée par appareil — même esprit que
 * `src/lib/queue.ts` : une préférence de vue vit hors de React, dans
 * localStorage. Pas côté serveur : c'est cosmétique, et le graphe est
 * desktop-only. Toute lecture/écriture est défensive (SSR, quota, JSON cassé).
 */
function isPoint(v: unknown): v is Point {
  return !!v && typeof v === "object"
    && typeof (v as Point).x === "number" && typeof (v as Point).y === "number";
}

export function loadGraphLayout(knownIds: Set<string>): Record<string, Point> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, Point> = {};
    for (const [id, p] of Object.entries(parsed)) {
      if (knownIds.has(id) && isPoint(p)) out[id] = { x: p.x, y: p.y };
    }
    return out;
  } catch {
    return {};
  }
}

export function saveGraphLayout(positions: Record<string, Point>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(positions));
  } catch {
    /* quota / mode privé : la disposition ne persiste pas, tant pis */
  }
}

export function clearGraphLayout(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* rien */
  }
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run src/lib/graphLayout.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/graphLayout.ts src/lib/graphLayout.test.ts
git commit -m "feat: graphLayout — per-device localStorage persistence for graph node positions"
```

---

## Task 9: `DependencyGraph` — persist layout, render all objectives, remove dependency

**Files:**
- Modify: `src/components/desktop/DependencyGraph.tsx`
- Modify: `src/components/desktop/DesktopShell.tsx`

**Interfaces:**
- Consumes: `loadGraphLayout`, `saveGraphLayout`, `clearGraphLayout` (Task 8); `layoutObjectives`, `OBJ_METRICS` (Task 7).
- Produces: `DependencyGraph` gains prop `onRemoveDependency?: (targetId: string, depId: string) => void`. `DesktopShell` gains `handleRemoveDependency`.

- [ ] **Step 1: Persist `pinned`**

In `DependencyGraph.tsx`, replace `const [pinned, setPinned] = useState<Record<string, Point>>({});` with a lazy init from localStorage, and persist on change (debounced):

```tsx
import { loadGraphLayout, saveGraphLayout, clearGraphLayout } from "@/lib/graphLayout";

// knownIds: every task id + every objective node id currently in play
const knownNodeIds = useMemo(() => {
  const s = new Set<string>(allTasks.map((t) => t.id));
  objectives.forEach((o) => s.add(objectiveNodeId(o)));
  return s;
}, [allTasks, objectives]);

const [pinned, setPinned] = useState<Record<string, Point>>(() => loadGraphLayout(knownNodeIds));

// Persist, debounced — a drag fires setPinned at ~60 Hz.
const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
useEffect(() => {
  if (saveTimer.current) clearTimeout(saveTimer.current);
  saveTimer.current = setTimeout(() => saveGraphLayout(pinned), 400);
  return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
}, [pinned]);
```

In the "Réinitialiser la disposition" button handler, add `clearGraphLayout();` alongside `setPinned({})`.

- [ ] **Step 2: Render ALL active objectives via `layoutObjectives`**

Replace the `objectiveNodes` `useMemo` (lines ~192-212) with a version driven by `layoutObjectives`:

```tsx
import { layoutObjectives, OBJ_METRICS } from "@/lib/graph";

const objectivePos = useMemo(
  () => layoutObjectives(objectives, items, pos, metrics, pinned),
  [objectives, items, pos, metrics, pinned],
);

const objectiveNodes = useMemo(
  () => objectives
    .filter((o) => !o.achievedAt)
    .map((o) => {
      const p = objectivePos.get(objectiveNodeId(o));
      return p ? { objective: o, x: p.x, y: p.y } : null;
    })
    .filter((n): n is { objective: Objective; x: number; y: number } => !!n),
  [objectives, objectivePos],
);
```

Update the objective-node JSX block (lines ~872-913) to use `OBJ_METRICS.W`/`OBJ_METRICS.H` instead of the local `OBJ_W`/`OBJ_H`, and delete the now-unused `OBJ_W`/`OBJ_H`/`OBJ_GAP_X` consts.

Keep objective nodes non-draggable / non-clickable this branch (branch 2 makes them interactive) — but they now render for every active objective, correctly placed.

- [ ] **Step 3: `onRemoveDependency` — edge hover `×`**

Add the prop to the component signature and its type. For each rendered edge (the `edges.map` around line 611), add an invisible wide hit-path and a hover `×`:

```tsx
const [hoverEdge, setHoverEdge] = useState<string | null>(null);
// inside edges.map, key = `${from.id}->${to.id}`
<path
  d={pathD}
  stroke="transparent"
  strokeWidth={14}
  fill="none"
  style={{ pointerEvents: "stroke", cursor: onRemoveDependency ? "pointer" : "default" }}
  onMouseEnter={() => setHoverEdge(key)}
  onMouseLeave={() => setHoverEdge((k) => (k === key ? null : k))}
  onClick={() => onRemoveDependency?.(to.id, from.id)}
/>
{onRemoveDependency && hoverEdge === key && (
  <g transform={`translate(${(x1 + x2) / 2},${(y1 + y2) / 2})`} style={{ pointerEvents: "none" }}>
    <circle r={9} fill="var(--color-surface)" stroke="var(--color-danger)" strokeWidth={1.5} />
    <path d="M-3.5,-3.5 L3.5,3.5 M3.5,-3.5 L-3.5,3.5" stroke="var(--color-danger)" strokeWidth={1.8} strokeLinecap="round" />
  </g>
)}
```

The parent `<svg>` is `pointer-events-none`; put these hit-paths in their own `<svg>` layer WITHOUT that class, stacked above the decorative one, OR set `pointerEvents: "stroke"` on the individual path (which overrides the parent). Use the per-path override — simpler.

- [ ] **Step 4: `onRemoveDependency` — panel button**

In `DetailPanel`, the `deps.map(link)` for "DÉPEND DE" — wrap each `link(x)` row with a small remove button that calls `onRemoveDependency(item.id, x.id)`. Thread `onRemoveDependency` into `DetailPanel` props.

- [ ] **Step 5: Wire `DesktopShell`**

```tsx
const handleRemoveDependency = useCallback(async (targetId: string, depId: string) => {
  if (targetId.startsWith("obj:")) {
    const objId = targetId.slice(4);
    const obj = objectives.find((o) => o.id === objId);
    if (!obj) return;
    const updated = await updateObjective(objId, {
      dependsOn: (obj.dependsOn ?? []).filter((d) => d !== depId),
    });
    setObjectives((prev) => prev.map((o) => (o.id === objId ? updated : o)));
    return;
  }
  const it = items.find((i) => i.id === targetId);
  if (!it) return;
  await onSaveItem(targetId, { dependsOn: (it.dependsOn ?? []).filter((d) => d !== depId) });
}, [items, objectives, onSaveItem]);
```

Pass `onRemoveDependency={handleRemoveDependency}` to `<DependencyGraph>`.

Also: after `handleAddDependency` / `handleRemoveDependency` resolve, refresh objectives so auto-completion shows:

```tsx
const refreshObjectives = useCallback(async () => {
  setObjectives(await fetchObjectives());
}, []);
// call refreshObjectives() at the end of handleAddDependency and handleRemoveDependency
```

- [ ] **Step 6: Typecheck + lint + suite**

Run: `npx next dev &`, `curl -s localhost:3000/ >/dev/null`, `npx tsc --noEmit`, kill dev.
Run: `npx eslint src/components/desktop/DependencyGraph.tsx src/components/desktop/DesktopShell.tsx`
Run: `npx vitest run`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add src/components/desktop/DependencyGraph.tsx src/components/desktop/DesktopShell.tsx
git commit -m "feat: graph persists layout, shows every objective, and can remove a dependency"
```

---

## Task 10: `DesktopObjectives` — inline edit, reopen, drop "Vue Asana"

**Files:**
- Modify: `src/components/desktop/DesktopObjectives.tsx`
- Modify: `src/components/desktop/DesktopShell.tsx` (pass `onEditObjective`, `onReopenObjective`)

**Interfaces:**
- Consumes: `updateObjective` (already in `api.ts`, patch type extended in Task 6 conceptually — verify it lists `dependsOn`; for this task only `title/horizon/notes/achievedAt/achievedManually` are used).
- Produces: `DesktopObjectives` props gain
  `onEditObjective: (id: string, patch: { title?: string; horizon?: ObjectiveHorizon; notes?: string }) => Promise<void>`
  and `onReopenObjective: (id: string) => Promise<void>`.

- [ ] **Step 1: Extend `updateObjective` patch type + `api.ts`**

In `src/lib/api.ts`, `updateObjective` signature:

```ts
export async function updateObjective(
  id: string,
  patch: { title?: string; horizon?: ObjectiveHorizon; achievedAt?: string | null; notes?: string; achievedManually?: boolean; dependsOn?: string[] },
): Promise<Objective> { /* unchanged body */ }
```

And `src/app/api/objectives/route.ts` PATCH: accept `achievedManually` (boolean) — set `patch.achievedManually` when `typeof body.achievedManually === "boolean"`. When the client sends `achievedAt: <iso>` also default `achievedManually: true` unless explicitly given; when `achievedAt: null` default `achievedManually: false`. (Small branch in the PATCH handler.)

- [ ] **Step 2: Shell handlers**

```tsx
const handleEditObjective = useCallback(async (id: string, patch: { title?: string; horizon?: ObjectiveHorizon; notes?: string }) => {
  const updated = await updateObjective(id, patch);
  setObjectives((prev) => prev.map((o) => (o.id === id ? updated : o)));
}, []);

const handleReopenObjective = useCallback(async (id: string) => {
  const updated = await updateObjective(id, { achievedAt: null, achievedManually: false });
  setObjectives((prev) => prev.map((o) => (o.id === id ? updated : o)));
}, []);
```

`handleAchieveObjective` — add `achievedManually: true`:

```tsx
const updated = await updateObjective(id, { achievedAt: new Date().toISOString(), achievedManually: true });
```

Pass all three to `<DesktopObjectives>`.

- [ ] **Step 3: Inline edit UI**

In `DesktopObjectives.tsx`:
- add `const [editing, setEditing] = useState<string | null>(null);` and a local draft state `{ title, horizon, notes }`
- clicking the objective title (or a pencil button added to the row) sets `editing = objective.id` and seeds the draft
- when `editing === objective.id`, render an expanded editor below the row: a text input (title), the horizon segmented control (extract the 3-button group from the create form into a small `HorizonPicker` component and reuse it here and there), a `<textarea>` for notes, "Enregistrer" → `await onEditObjective(id, draft); setEditing(null)` / "Annuler" → `setEditing(null)`
- for an achieved objective (only shown if the screen ever lists them — currently `objectivesByProject` filters them out, so this mainly matters if a "voir les atteints" toggle is added later; include the button anyway on any row where `objective.achievedAt` is set): a "Rouvrir" button → `onReopenObjective(id)`

- [ ] **Step 4: Remove "Vue Asana"**

Line 118: `Vue Asana · court → moyen → long terme` → `court → moyen → long terme`.
Also update the file's top comment (line 4) `vue « Asana perso »` → `écran Objectifs (spec Aramis 29/08)`.

- [ ] **Step 5: Typecheck + lint + suite + manual**

Run: `npx next dev &`, `curl`, `npx tsc --noEmit`, kill.
Run: `npx eslint src/components/desktop/DesktopObjectives.tsx src/lib/api.ts src/app/api/objectives/route.ts`
Run: `npx vitest run`

- [ ] **Step 6: Commit**

```bash
git add src/components/desktop/DesktopObjectives.tsx src/components/desktop/DesktopShell.tsx src/lib/api.ts src/app/api/objectives/route.ts src/app/api/objectives/route.test.ts
git commit -m "feat: editable objectives — inline title/horizon/notes, reopen, drop Asana label"
```

---

## Task 11: Live QA + branch verification

**Files:** none (verification only)

- [ ] **Step 1: Full check**

Run: `npx next dev` (leave running), `curl -s localhost:3000/ >/dev/null`
Run (new shell): `npx tsc --noEmit` → 0 errors
Run: `npx eslint .` → 0 errors (1 pre-existing `OverdueRow` warning in `DesktopDashboard.tsx` is allowed)
Run: `npx vitest run` → all green, paste the summary line

- [ ] **Step 2: `/browse` QA script**

Invoke the `browse` skill. Log in, then:
1. Objectifs tab → change an objective's horizon moyen→court, reload → it stuck
2. Objectifs tab → edit a title + notes, save, reload → stuck
3. Graphe tab → every objective from the Objectifs list shows as a golden node, none overlapping a task card (compare to `docs/` screenshot 1 bug)
4. Graphe tab → drag 3 nodes apart, reload the page → positions kept
5. Graphe tab → hover an edge → red `×` appears → click → dependency gone, the arrow disappears
6. Link a task to an objective in the Objectifs tab isn't possible yet (branch 2) — instead: open a task detail, set "Contribue à" an objective, check the task done, go to Objectifs → objective shows 1/1 and (if it was the only dep) is now achieved / gone from active list
7. "Réinitialiser la disposition" → nodes snap back to computed layout

- [ ] **Step 3: Record findings**

If any step fails, use `superpowers:systematic-debugging`, fix, re-run Step 1. Do not proceed with failures.

- [ ] **Step 4: Push the branch**

```bash
bash scripts/coord/pre-push.sh   # expect: fails on "prod branch" only if on main — we're not; expect OK
git push -u origin feat/graphe-objectifs-moteur
```

---

## Self-Review

**Spec coverage (§10 Branche 1):**
1. Model `Objective.dependsOn` + `achievedManually` + read normalization → Task 1 ✓
2. `objectives.ts` effective deps / satisfied / reconcile (TDD) → Tasks 2, 3, 4 ✓
3. `graph.ts` `layoutObjectives` + overlap fix + all objectives visible (TDD) → Task 7, rendered in Task 9 ✓
4. API `PATCH dependsOn` + reconcile wired (items + objectives + GET guard) → Tasks 5, 6 ✓
5. `DesktopObjectives` inline edit + reopen + "Vue Asana" removed → Task 10 ✓
6. localStorage layout persistence + pruning → Tasks 8, 9 ✓
7. remove-dependency (`onRemoveDependency`, edge ×, panel button) → Task 9 ✓

**Placeholder scan:** no "TBD"/"handle edge cases"/"similar to". Test code is literal. ✓

**Type consistency:**
- `effectiveDeps` returns `{ itemIds, objectiveIds }` — used identically in Tasks 3, 7 ✓
- `reconcileObjectives(items, objectives, nowIso)` — Task 4 defines, Task 5 calls with same arg order ✓
- `layoutObjectives(objectives, items, nodePositions, metrics, pinned?)` — Task 7 defines, Task 9 calls with `(objectives, items, pos, metrics, pinned)` ✓
- `onRemoveDependency(targetId, depId)` — Task 9 defines the prop, Task 9 Step 5 wires `handleRemoveDependency(targetId, depId)` with matching order ✓
- `OBJ_METRICS` fields `W/H/GAP_X/VGAP` — consistent Tasks 7, 9 ✓

**Import-cycle risk:** `graph.ts` → `objectives.ts` is new (Task 7). `objectives.ts` imports only from `./types` today. Task 7 Step 5 verifies no back-import. ✓ (If a cycle ever appears, move `effectiveDeps` to a third module `objective-deps.ts` imported by both.)

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-30-graphe-objectifs-moteur-branche-1.md`. Executing inline in this session (autonomy granted) via `superpowers:executing-plans` — batch execution with a verification checkpoint after Task 6 (all pure logic + API) and after Task 11 (QA).
