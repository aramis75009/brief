# Vue Graphe — masquer les tâches terminées (barrées) · Plan

> **Pour Hermes :** implémenter ce plan tâche par tâche, TDD, validations
> `npx eslint .` + `npx tsc --noEmit` + `TZ=UTC npx vitest run` après chaque
> commit. Commit + push uniquement après validation d'Aramis.

**Goal :** dans la vue Graphe (nouvelle fonctionnalité), les tâches terminées
(barrées) ne doivent plus apparaître du tout — le graphe ne montre que les
tâches actives, pour qu'on ne s'y perde plus entre « à faire » et « faites ».

**Architecture :** une seule porte d'entrée du graphe (`graphTasks()`) filtre
les `doneAt` — les tests s'adaptent, l'UI n'a presque rien à changer.

**Tech stack :** TypeScript / React (Next.js 16), Vitest, eslint.

---

## Contexte vérifié (lecture du code, 24/08)

- `src/lib/graph.ts` — la logique pure de la vue. `graphTasks(items)` =
  `items.filter(it => it.kind === "task")` : **n'exclut PAS les terminées** →
  c'est la porte d'entrée unique du graphe (utilisée par `visibleTasks`, et
  côté UI par `DependencyGraph.tsx` et `DesktopShell.tsx`).
- `src/components/desktop/DependencyGraph.tsx` :
  - rend les nœuds barrés (ligne 575 : `textDecoration: "line-through"` quand
    `t.doneAt`) → à retirer avec la suppression.
  - panneau de détail : `link()` (lignes ~810-815) affiche « terminée / à
    faire » sur les items liés → plus aucun `doneAt` visible dans la liste.
  - `STATUS.done` (ligne 69) et la légende « terminée » (lignes 657-662)
    deviennent inutiles → à retirer.
  - badge « Bloquées » (lignes ~402-406) : compte déjà les `blocked` via
    `graphStatus` — inchangé (une tâche cochée n'est plus bloquante).
- `src/components/desktop/DesktopShell.tsx` lignes 175-186 : badge « Graphe »
  (compteur de bloquées) calcule sur `graphTasks(activeItems)` —
  **`activeItems` exclut déjà les `doneAt`** → comportement inchangé.
- `src/lib/graph.test.ts` : 24 tests ; **2 doivent être adaptés** (graphTasks,
  visibleTasks bloquées) + nouveaux tests de non-régression.
- `DESIGN.md` : le graphe reste cohérent avec le design system (3 statuts
  restants : prête / bloquée ; la légende n'en montre que 2).

## Décisions de conception (à valider avec Aramis)

1. **`doneAt` = critère unique** : une tâche cochée (`doneAt` posé) est
   invisible dans la vue Graphe. Les tâches récurrentes cochées ont
   `lastCompletedOccurrenceAt` posé MAIS `doneAt` reste null et `due` avance —
   elles restent donc affichées (c'est leur prochaine occurrence, à faire).
2. **Effet en cascade naturel** : en filtrant à la racine, une tâche bloquée
   par une dépendance terminée devient « prête » — le graphe reflète l'état
   réel. Une dépendance vers une tâche terminée disparaît du rendu (arête
   coupée), car sa cible n'existe plus — **non réintroduite** : ce serait
   refaire apparaître une tâche faite dans le graphe.
3. **Statut "done" supprimé du rendu** (couleur/label/légende/panneau) — plus
   aucune tâche terminée visible dans la vue. `graphStatus` garde son
   comportement interne pour le badge « Bloquées » (une termais ne bloque
   plus).
4. **Aucun changement sur les autres vues** (Dashboard, Kanban, Tâches,
   Aujourd'hui, calendrier) : la demande est limitée à la vue Graphe.

## Étapes

### Tâche 1 — `graphTasks()` exclut les tâches terminées + tests

**Fichiers :** `src/lib/graph.ts` (lignes 72-74), `src/lib/graph.test.ts` (s. graphTasks, l.81-86)

**Étape 1 — test rouge :**

```ts
describe("graphTasks — le graphe ne parle que de tâches ACTIVES", () => {
  it("écarte les rendez-vous", () => {
    const list = [item({ id: "a" }), item({ id: "e", kind: "event" })];
    expect(graphTasks(list).map((t) => t.id)).toEqual(["a"]);
  });

  it("écarte les tâches terminées", () => {
    const list = [
      item({ id: "a" }),
      item({ id: "b", doneAt: "2026-08-23T10:00:00+02:00" }),
    ];
    expect(graphTasks(list).map((t) => t.id)).toEqual(["a"]);
  });
});
```

**Étape 2 — run** : `TZ=UTC npx vitest run src/lib/graph.test.ts` → échec attendu (b visible).

**Étape 3 — implémentation minimale :**

```ts
export function graphTasks(items: Item[]): Item[] {
  return items.filter((it) => it.kind === "task" && !it.doneAt);
}
```

**Étape 4 — run** : `TZ=UTC npx vitest run` — les tests restants de
`visibleTasks`/`graphEdges`/`depths`/`layoutGraph`/`unlocks` qui utilisent des
chaînes SANS `doneAt` restent verts.

### Tâche 2 — tests de non-réintroduction (chaîne partiellement terminée)

**Fichier :** `src/lib/graph.test.ts` (suite `visibleTasks`)

**Étape 1 — tests rouges :**

```ts
it("une chaîne avec un maillon terminé : le maillon disparaît, le reste est prêt", () => {
  const list = [
    item({ id: "a", doneAt: "2026-08-23T10:00:00+02:00" }),
    item({ id: "b", dependsOn: ["a"] }),
  ];
  expect(visibleTasks(list, { projectFilter: [], blockedOnly: false }).map((t) => t.id)).toEqual(["b"]);
  expect(graphStatus(list[1], indexById(list))).toBe("ready");
});
```

**Étape 2 — run** : passe avec la Tâche 1 (le filtre racine fait tout). Ne pas
réimplémenter ; le test documente le contrat.

### Tâche 3 — la vue Graphe : retirer le rendu « terminée »

**Fichiers :** `src/components/desktop/DependencyGraph.tsx`

1. Ligne ~575 : retirer le ternaire
   `color: t.doneAt ? C.inkFaint : C.ink` → `color: C.ink` et
   `textDecoration: t.doneAt ? "line-through" : "none"` → `"none"` (le nœud
   n'est plus jamais `doneAt`).
2. Lignes ~66-70 : retirer `done` de `STATUS` (plus de « Terminée » ni de
   couleur grise). Le type `GraphStatus` garde `"done"` (logique interne).
3. Légende lignes ~657-661 : ne plus mapper que `["ready", "blocked"]`
   (« prête », « bloquée ») — supprimer la pastille grise « terminée ».
4. Panneau de détail : `link()` (lignes ~810-815) — retirer le ternaire
   `x.doneAt ? ...` → `C.ink` / « à faire » constant.
5. Vérifier qu'aucun autre usage de `STATUS.done` / `doneAt` ne subsiste dans
   le fichier (`grep`).

### Tâche 4 — validation triple + commit

```bash
npx eslint .
npx tsc --noEmit
TZ=UTC npx vitest run
```
Attendu : 0 erreur eslint, tsc propre, ~287-289 tests verts.

Commit (anglais, `Agent: Claude Code`) :
`feat: hide completed tasks from the dependency graph view`

## Fichiers modifiés

| Fichier | Nature |
|---|---|
| `src/lib/graph.ts` | `graphTasks()` exclut `doneAt` |
| `src/lib/graph.test.ts` | +tests : terminées exclues, chaîne à maillon fait |
| `src/components/desktop/DependencyGraph.tsx` | retrait styles/légende/panneau « terminé » |

## Validations finales

- `npx eslint .` → 0 erreur (les ~30 warnings d'imports morts préexistants restent).
- `npx tsc --noEmit` → propre.
- `TZ=UTC npx vitest run` → 286 + nouveaux tests, 0 échec.
- Vérification navigateur (gstack / `vision_analyze`) : une chaîne avec une
  tâche cochée n'affiche plus la tâche barrée, la suivante devient « prête »,
  la légende n'a plus « terminée ».

## Risques / trade-offs

- **Dépendances vers des tâches faites** : l'arête disparaît avec le nœud.
  C'est la conséquence voulue (« on ne s'y perd plus ») ; signaler à Aramis si
  un doute sur ce point.
- **Récurrentes** : restent visibles (occurrence à faire). Cohérent avec les
  autres vues.
- **Badge « Graphe »** : inchangé (comptait déjà sur les items actifs).
- **Portée limitée à la vue Graphe** — aucune autre vue ne change.

## Questions ouvertes

1. Une tâche terminée dont une tâche active dépend : Aramis veut-il voir la
   dépendance grisée (non supprimée) ? → défaut choisi : supprimée (sinon la
   tâche terminée réapparaît, contre la demande).
2. Le message d'état vide « Aucune chaîne à afficher » reste pertinent dans
   tous les cas de figure.
