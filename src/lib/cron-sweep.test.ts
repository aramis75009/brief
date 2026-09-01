import { describe, expect, it } from "vitest";
import { sweepUsers } from "./cron-sweep";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

describe("sweepUsers", () => {
  it("traite tous les comptes et rend un résultat par compte", async () => {
    const r = await sweepUsers({
      userIds: [A, B],
      budgetMs: 10_000,
      run: async (id) => id.slice(0, 8),
    });
    expect(r.runs).toEqual([
      { userId: A, result: "11111111" },
      { userId: B, result: "22222222" },
    ]);
    expect(r.failures).toEqual([]);
    expect(r.deferred).toEqual([]);
  });

  it("un compte en échec n'empêche pas les suivants", async () => {
    // Sans cette isolation, un `items.json` corrompu chez UN utilisateur
    // éteindrait les rappels de TOUS les autres — et le cron répondrait 200.
    const r = await sweepUsers({
      userIds: [A, B, C],
      budgetMs: 10_000,
      run: async (id) => {
        if (id === B) throw new Error("items.json corrompu");
        return id;
      },
    });
    expect(r.runs.map((x) => x.userId)).toEqual([A, C]);
    expect(r.failures).toEqual([{ userId: B, error: "items.json corrompu" }]);
  });

  it("reporte les comptes restants quand le budget est dépassé", async () => {
    const r = await sweepUsers({
      userIds: [A, B, C],
      budgetMs: 0,
      run: async (id) => id,
    });
    // Le premier passe TOUJOURS : un budget mal réglé doit dégrader le débit,
    // jamais tout arrêter.
    expect(r.runs).toHaveLength(1);
    expect(r.deferred).toEqual([B, C]);
  });

  it("fait tourner l'ordre d'un passage à l'autre", async () => {
    // Si le budget coupe toujours au même endroit, les derniers comptes ne
    // seraient jamais traités et leurs rappels deviendraient `stale` — donc
    // abandonnés en silence par `pendingReminders`.
    const orders: string[][] = [];
    for (let pass = 0; pass < 4; pass++) {
      const seen: string[] = [];
      await sweepUsers({
        userIds: [A, B, C],
        budgetMs: 10_000,
        offset: pass,
        run: async (id) => {
          seen.push(id);
          return id;
        },
      });
      orders.push(seen);
    }
    expect(orders).toEqual([
      [A, B, C],
      [B, C, A],
      [C, A, B],
      [A, B, C],
    ]);
  });

  it("ne fait rien, sans lever, quand aucun compte n'existe", async () => {
    const r = await sweepUsers({ userIds: [], budgetMs: 10_000, run: async (id) => id });
    expect(r).toEqual({ runs: [], failures: [], deferred: [] });
  });

  it("rend un message lisible quand l'échec n'est pas une Error", async () => {
    const r = await sweepUsers({
      userIds: [A],
      budgetMs: 10_000,
      run: async () => {
        throw "panne sans objet Error";
      },
    });
    expect(r.failures[0].error).toContain("panne sans objet Error");
  });
});
