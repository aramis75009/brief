import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { fakeStore, TEST_USER_ID } from "@/lib/testing/fake-store";
import type { Settings } from "@/lib/settings";

vi.mock("@/lib/cron-auth");
vi.mock("@/lib/caldav");
vi.mock("@/lib/store");

/**
 * Le passage CalDAV. Deux choses valent un test, et elles sont indépendantes :
 *
 *   1. **La bascule « Calendrier Apple » doit vraiment cesser de parler à
 *      iCloud**, pas seulement jeter le résultat — c'est la seule façon qu'une
 *      pause serve à quelque chose (identifiants révoqués, quota, débogage).
 *      D'où le test sur `runCalDavSync` : il ne doit pas être appelé du tout.
 *
 *   2. **Le passage ne doit traiter QUE le compte propriétaire.** Les
 *      identifiants iCloud sont globaux jusqu'au lot 3, et `runCalDavSync`
 *      adopte tout événement distant sans item correspondant : le lancer sur un
 *      second compte lui écrirait l'agenda entier du propriétaire. Trouvé en
 *      revue le 2026-08-31, avant tout déploiement.
 */
describe("GET /api/cron/caldav-sync", () => {
  let settings: Settings;
  let storesBuilt: string[];

  beforeEach(async () => {
    vi.clearAllMocks();
    const auth = await import("@/lib/cron-auth");
    const store = await import("@/lib/store");

    vi.mocked(auth.requireMachineToken).mockReturnValue(null);
    process.env.BRIEF_OWNER_USER_ID = TEST_USER_ID;

    settings = { caldavSync: true, digest: true };
    storesBuilt = [];
    vi.mocked(store.storeForUser).mockImplementation((userId: string) => {
      storesBuilt.push(userId);
      return fakeStore({ readSettings: vi.fn(async () => settings) });
    });
  });

  const req = () => new Request("https://brief.example/api/cron/caldav-sync");

  it("ne touche PAS au réseau quand la synchro est désactivée", async () => {
    const caldav = await import("@/lib/caldav");
    settings = { caldavSync: false, digest: true };

    const res = await GET(req());
    const body = (await res.json()) as { runs: { userId: string; result: unknown }[] };

    expect(body.runs).toEqual([
      { userId: TEST_USER_ID, result: { skipped: true, reason: "disabled" } },
    ]);
    expect(caldav.runCalDavSync).not.toHaveBeenCalled();
  });

  it("lance le passage quand la synchro est active", async () => {
    const caldav = await import("@/lib/caldav");
    vi.mocked(caldav.runCalDavSync).mockResolvedValue({
      skipped: true,
      nextSyncInSec: 42,
    } as Awaited<ReturnType<typeof caldav.runCalDavSync>>);

    await GET(req());
    expect(caldav.runCalDavSync).toHaveBeenCalledOnce();
  });

  it("ne traite QUE le propriétaire, jamais les autres comptes", async () => {
    // Le correctif du 2026-08-31. Un second compte synchronisé contre l'unique
    // compte iCloud configuré se verrait attribuer TOUS les rendez-vous du
    // propriétaire, par la phase d'adoption de `runCalDavSync` — sans erreur, et
    // sans que `settings.caldavSync` puisse l'empêcher (un compte neuf n'a pas
    // de `settings.json`, et le défaut est ON).
    const caldav = await import("@/lib/caldav");
    vi.mocked(caldav.runCalDavSync).mockResolvedValue({
      skipped: true,
      nextSyncInSec: 42,
    } as Awaited<ReturnType<typeof caldav.runCalDavSync>>);

    const res = await GET(req());
    const body = (await res.json()) as { users: number; runs: { userId: string }[] };

    expect(body.users).toBe(1);
    expect(body.runs.map((r) => r.userId)).toEqual([TEST_USER_ID]);
    // Aucun store d'un autre compte n'a même été construit.
    expect(storesBuilt).toEqual([TEST_USER_ID]);
  });

  it("répond 503 sans propriétaire désigné, plutôt que de synchroniser au hasard", async () => {
    const caldav = await import("@/lib/caldav");
    delete process.env.BRIEF_OWNER_USER_ID;

    const res = await GET(req());

    expect(res.status).toBe(503);
    expect(caldav.runCalDavSync).not.toHaveBeenCalled();
  });

  it("refuse un BRIEF_OWNER_USER_ID qui n'est pas un UUID", async () => {
    process.env.BRIEF_OWNER_USER_ID = "../../etc";
    expect((await GET(req())).status).toBe(503);
  });

  it("s'arrête au jeton avant même de lire les réglages", async () => {
    const auth = await import("@/lib/cron-auth");
    const store = await import("@/lib/store");
    vi.mocked(auth.requireMachineToken).mockReturnValueOnce(
      Response.json({ error: "Jeton invalide." }, { status: 401 }),
    );

    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(store.storeForUser).not.toHaveBeenCalled();
  });
});
