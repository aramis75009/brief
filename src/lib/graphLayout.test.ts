import { afterEach, describe, expect, it, vi } from "vitest";
import { clearGraphLayout, loadGraphLayout, saveGraphLayout } from "./graphLayout";

function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => void m.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;
}

afterEach(() => vi.unstubAllGlobals());

describe("graphLayout", () => {
  it("save puis load rend toutes les positions", () => {
    vi.stubGlobal("window", { localStorage: fakeStorage() });
    saveGraphLayout({ a: { x: 1, y: 2 }, b: { x: 3, y: 4 } });
    expect(loadGraphLayout()).toEqual({ a: { x: 1, y: 2 }, b: { x: 3, y: 4 } });
  });

  it("load renvoie {} sans window (SSR)", () => {
    vi.stubGlobal("window", undefined);
    expect(loadGraphLayout()).toEqual({});
  });

  it("load renvoie {} sur JSON corrompu", () => {
    const s = fakeStorage();
    s.setItem("brief:graph-layout", "{not json");
    vi.stubGlobal("window", { localStorage: s });
    expect(loadGraphLayout()).toEqual({});
  });

  it("load ignore une entrée qui n'est pas un point", () => {
    const s = fakeStorage();
    s.setItem("brief:graph-layout", JSON.stringify({ a: { x: 1 }, b: "nope", c: { x: 2, y: 3 } }));
    vi.stubGlobal("window", { localStorage: s });
    expect(loadGraphLayout()).toEqual({ c: { x: 2, y: 3 } });
  });

  it("clear vide la clé", () => {
    vi.stubGlobal("window", { localStorage: fakeStorage() });
    saveGraphLayout({ a: { x: 1, y: 2 } });
    clearGraphLayout();
    expect(loadGraphLayout()).toEqual({});
  });

  it("save n'explose pas si localStorage jette (quota)", () => {
    vi.stubGlobal("window", {
      localStorage: { setItem: () => { throw new Error("quota"); }, getItem: () => null, removeItem: () => {} },
    });
    expect(() => saveGraphLayout({ a: { x: 1, y: 2 } })).not.toThrow();
  });
});
