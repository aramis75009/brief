import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/cron-auth");
vi.mock("@/lib/caldav");
vi.mock("@/lib/store");

/**
 * La bascule « Calendrier Apple » des Réglages doit vraiment **cesser de
 * parler à iCloud**, pas seulement jeter le résultat : c'est la seule façon
 * qu'une pause serve à quelque chose (identifiants révoqués, quota, débogage).
 * D'où le test sur `runCalDavSync` : il ne doit pas être appelé du tout.
 */
describe("GET /api/cron/caldav-sync", () => {
  beforeEach(async () => {
    const auth = await import("@/lib/cron-auth");
    vi.mocked(auth.requireMachineToken).mockReturnValue(null);
    vi.clearAllMocks();
    vi.mocked(auth.requireMachineToken).mockReturnValue(null);
  });

  const req = () => new Request("https://brief.example/api/cron/caldav-sync");

  it("ne touche PAS au réseau quand la synchro est désactivée", async () => {
    const store = await import("@/lib/store");
    const caldav = await import("@/lib/caldav");
    vi.mocked(store.readSettings).mockResolvedValue({ caldavSync: false, digest: true });

    const res = await GET(req());
    expect(await res.json()).toEqual({ skipped: true, reason: "disabled" });
    expect(caldav.runCalDavSync).not.toHaveBeenCalled();
  });

  it("lance le passage quand la synchro est active", async () => {
    const store = await import("@/lib/store");
    const caldav = await import("@/lib/caldav");
    vi.mocked(store.readSettings).mockResolvedValue({ caldavSync: true, digest: true });
    vi.mocked(caldav.runCalDavSync).mockResolvedValue({
      skipped: true,
      nextSyncInSec: 42,
    } as Awaited<ReturnType<typeof caldav.runCalDavSync>>);

    await GET(req());
    expect(caldav.runCalDavSync).toHaveBeenCalledOnce();
  });

  it("s'arrête au jeton avant même de lire les réglages", async () => {
    const auth = await import("@/lib/cron-auth");
    const store = await import("@/lib/store");
    vi.mocked(auth.requireMachineToken).mockReturnValueOnce(
      Response.json({ error: "Jeton invalide." }, { status: 401 }),
    );

    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(store.readSettings).not.toHaveBeenCalled();
  });
});
