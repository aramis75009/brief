import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PATCH } from "./route";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/settings";
import { fakeStore, TEST_USER_ID } from "@/lib/testing/fake-store";

vi.mock("@/lib/guard");

/**
 * La route des réglages. Deux points valent un test :
 *   - `PATCH` ne peut pas introduire une clé inconnue ni convertir une valeur
 *     (c'est `applySettingsPatch` qui décide, la route ne fait que passer) ;
 *   - un corps illisible répond 400 sans rien écrire — un `PATCH` malformé ne
 *     doit pas remettre les réglages à leur défaut.
 */
describe("/api/settings", () => {
  let stored: Settings;

  beforeEach(async () => {
    stored = { ...DEFAULT_SETTINGS };
    const guard = await import("@/lib/guard");
    const store = fakeStore({
      readSettings: vi.fn(async () => stored),
      updateSettingsAtomically: vi.fn(async (fn) => {
        stored = fn(stored);
        return stored;
      }),
    });
    vi.mocked(guard.requireStore).mockResolvedValue({ userId: TEST_USER_ID, store });
  });

  const patch = (body: string) =>
    PATCH(new Request("https://brief.example/api/settings", { method: "PATCH", body }));

  it("GET rend l'état complet", async () => {
    const res = await GET();
    expect(await res.json()).toEqual({ caldavSync: true, digest: true });
  });

  it("PATCH applique un réglage et rend l'état complet", async () => {
    const res = await patch(JSON.stringify({ digest: false }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ caldavSync: true, digest: false });
    expect(stored).toEqual({ caldavSync: true, digest: false });
  });

  it("PATCH ignore une clé inconnue plutôt que de l'enregistrer", async () => {
    const res = await patch(JSON.stringify({ pin: true, verrou: "on" }));
    expect(await res.json()).toEqual(DEFAULT_SETTINGS);
    expect(stored).toEqual(DEFAULT_SETTINGS);
  });

  it("PATCH ignore une valeur non booléenne — `\"false\"` ne vaut pas false", async () => {
    await patch(JSON.stringify({ caldavSync: "false" }));
    expect(stored.caldavSync).toBe(true);
  });

  it("PATCH répond 400 sur un corps illisible, sans rien écrire", async () => {
    const res = await patch("{ pas du json");
    expect(res.status).toBe(400);
    expect(stored).toEqual(DEFAULT_SETTINGS);
  });

  it("propage le 401 de la garde de session", async () => {
    const guard = await import("@/lib/guard");
    vi.mocked(guard.requireStore).mockResolvedValueOnce(
      Response.json({ error: "x" }, { status: 401 }),
    );
    expect((await GET()).status).toBe(401);
  });
});
