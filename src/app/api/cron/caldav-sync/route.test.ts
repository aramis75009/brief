import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { fakeStore, TEST_USER_ID } from "@/lib/testing/fake-store";
import type { Settings } from "@/lib/settings";

vi.mock("@/lib/cron-auth");
vi.mock("@/lib/caldav");
vi.mock("@/lib/store");
vi.mock("@/lib/supabase/admin");

/**
 * La bascule « Calendrier Apple » des Réglages doit vraiment **cesser de
 * parler à iCloud**, pas seulement jeter le résultat : c'est la seule façon
 * qu'une pause serve à quelque chose (identifiants révoqués, quota, débogage).
 * D'où le test sur `runCalDavSync` : il ne doit pas être appelé du tout.
 *
 * Depuis le pivot multi-utilisateur, la bascule est PAR COMPTE : le passage
 * doit pouvoir sauter un compte et traiter le suivant. Un test le vérifie —
 * sans lui, une bascule éteinte chez l'un couperait la synchro de tous.
 */
describe("GET /api/cron/caldav-sync", () => {
  const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";

  let settingsByUser: Record<string, Settings>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const auth = await import("@/lib/cron-auth");
    const admin = await import("@/lib/supabase/admin");
    const store = await import("@/lib/store");

    vi.mocked(auth.requireMachineToken).mockReturnValue(null);
    vi.mocked(admin.listAuthorizedUserIds).mockResolvedValue([TEST_USER_ID]);

    settingsByUser = { [TEST_USER_ID]: { caldavSync: true, digest: true } };
    vi.mocked(store.storeForUser).mockImplementation((userId: string) =>
      fakeStore({
        readSettings: vi.fn(async () => settingsByUser[userId]),
      }),
    );
  });

  const req = () => new Request("https://brief.example/api/cron/caldav-sync");

  it("ne touche PAS au réseau quand la synchro est désactivée", async () => {
    const caldav = await import("@/lib/caldav");
    settingsByUser[TEST_USER_ID] = { caldavSync: false, digest: true };

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

  it("une bascule éteinte chez un compte n'empêche pas la synchro de l'autre", async () => {
    const admin = await import("@/lib/supabase/admin");
    const caldav = await import("@/lib/caldav");
    vi.mocked(admin.listAuthorizedUserIds).mockResolvedValue([TEST_USER_ID, OTHER_USER_ID]);
    settingsByUser = {
      [TEST_USER_ID]: { caldavSync: false, digest: true },
      [OTHER_USER_ID]: { caldavSync: true, digest: true },
    };
    vi.mocked(caldav.runCalDavSync).mockResolvedValue({
      skipped: true,
      nextSyncInSec: 42,
    } as Awaited<ReturnType<typeof caldav.runCalDavSync>>);

    const res = await GET(req());
    const body = (await res.json()) as { runs: { userId: string }[]; users: number };

    expect(body.users).toBe(2);
    expect(body.runs).toHaveLength(2);
    expect(caldav.runCalDavSync).toHaveBeenCalledOnce();
  });

  it("un compte en échec n'empêche pas le suivant", async () => {
    // Sans l'isolation de `sweepUsers`, un compte cassé éteindrait la synchro
    // de tous les autres — et la route répondrait quand même 200.
    const admin = await import("@/lib/supabase/admin");
    const caldav = await import("@/lib/caldav");
    vi.mocked(admin.listAuthorizedUserIds).mockResolvedValue([TEST_USER_ID, OTHER_USER_ID]);
    settingsByUser = {
      [TEST_USER_ID]: { caldavSync: true, digest: true },
      [OTHER_USER_ID]: { caldavSync: true, digest: true },
    };
    vi.mocked(caldav.runCalDavSync)
      .mockRejectedValueOnce(new Error("iCloud injoignable"))
      .mockResolvedValueOnce({ skipped: true, nextSyncInSec: 42 } as Awaited<
        ReturnType<typeof caldav.runCalDavSync>
      >);

    const res = await GET(req());
    const body = (await res.json()) as {
      runs: unknown[];
      failures: { error: string }[];
    };

    expect(body.failures).toHaveLength(1);
    expect(body.failures[0].error).toBe("iCloud injoignable");
    expect(body.runs).toHaveLength(1);
  });

  it("s'arrête au jeton avant même de lister les comptes", async () => {
    const auth = await import("@/lib/cron-auth");
    const admin = await import("@/lib/supabase/admin");
    vi.mocked(auth.requireMachineToken).mockReturnValueOnce(
      Response.json({ error: "Jeton invalide." }, { status: 401 }),
    );

    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(admin.listAuthorizedUserIds).not.toHaveBeenCalled();
  });
});
