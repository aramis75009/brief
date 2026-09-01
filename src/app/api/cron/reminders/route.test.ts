import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { fakeStore, TEST_USER_ID } from "@/lib/testing/fake-store";

vi.mock("@/lib/cron-auth");
vi.mock("@/lib/reminders");
vi.mock("@/lib/store");
vi.mock("@/lib/supabase/admin");

/**
 * Le passage des rappels.
 *
 * Ce qui vaut un test, et rien d'autre : les modes de panne SILENCIEUX. Un
 * rappel qui ne part pas ne se voit pas — ni dans une réponse HTTP, ni à
 * l'écran. Le cron du VPS n'imprime qu'un `curl` en échec.
 */
describe("GET /api/cron/reminders", () => {
  const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";

  const emptyRun = {
    checked: 0,
    due: 0,
    sent: 0,
    skippedStale: 0,
    advanced: 0,
    correctedToAnchor: 0,
    failures: [],
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const auth = await import("@/lib/cron-auth");
    const admin = await import("@/lib/supabase/admin");
    const store = await import("@/lib/store");
    const reminders = await import("@/lib/reminders");

    vi.mocked(auth.requireMachineToken).mockReturnValue(null);
    vi.mocked(admin.listAuthorizedUserIds).mockResolvedValue([TEST_USER_ID, OTHER_USER_ID]);
    vi.mocked(store.storeForUser).mockImplementation(() => fakeStore());
    vi.mocked(reminders.runReminders).mockResolvedValue(emptyRun);
    process.env.BRIEF_OWNER_USER_ID = TEST_USER_ID;
  });

  const req = () => new Request("https://brief.example/api/cron/reminders");

  it("traite tous les comptes autorisés", async () => {
    const reminders = await import("@/lib/reminders");
    const res = await GET(req());
    const body = (await res.json()) as { users: number; runs: unknown[] };

    expect(body.users).toBe(2);
    expect(body.runs).toHaveLength(2);
    expect(reminders.runReminders).toHaveBeenCalledTimes(2);
  });

  it("un compte en échec n'empêche pas les rappels des autres", async () => {
    // Sans l'isolation de `sweepUsers`, un `items.json` corrompu chez UN
    // utilisateur éteindrait les rappels de TOUS — et la route répondrait 200.
    const reminders = await import("@/lib/reminders");
    vi.mocked(reminders.runReminders)
      .mockRejectedValueOnce(new Error("items.json corrompu"))
      .mockResolvedValueOnce(emptyRun);

    const res = await GET(req());
    const body = (await res.json()) as { runs: unknown[]; failures: { error: string }[] };

    expect(body.failures).toHaveLength(1);
    expect(body.failures[0].error).toBe("items.json corrompu");
    expect(body.runs).toHaveLength(1);
  });

  it("se replie sur le propriétaire quand Supabase est injoignable", async () => {
    // Le chemin des rappels ne touchait que le disque avant le pivot. Sans ce
    // repli, une panne Supabase de trois minutes n'atténue pas le service :
    // elle l'éteint pour tout le monde, en silence.
    const admin = await import("@/lib/supabase/admin");
    const reminders = await import("@/lib/reminders");
    vi.mocked(admin.listAuthorizedUserIds).mockRejectedValue(new Error("fetch failed"));

    const res = await GET(req());
    const body = (await res.json()) as { users: number; runs: { userId: string }[] };

    expect(res.status).toBe(200);
    expect(body.users).toBe(1);
    expect(body.runs[0].userId).toBe(TEST_USER_ID);
    expect(reminders.runReminders).toHaveBeenCalledOnce();
  });

  it("se replie aussi quand Supabase rend une liste VIDE sans lever", async () => {
    // Le mode de panne le plus traître des deux : il ne lève pas. Clé
    // service-role pointée sur le mauvais projet, table renommée, RLS modifiée
    // — l'appel réussit en rendant `[]`, la route répond 200, `curl -fsS` reste
    // vert, et plus aucun rappel ne part pour personne.
    const admin = await import("@/lib/supabase/admin");
    const reminders = await import("@/lib/reminders");
    vi.mocked(admin.listAuthorizedUserIds).mockResolvedValue([]);

    const res = await GET(req());
    const body = (await res.json()) as { users: number; runs: { userId: string }[] };

    expect(body.users).toBe(1);
    expect(body.runs[0].userId).toBe(TEST_USER_ID);
    expect(reminders.runReminders).toHaveBeenCalledOnce();
  });

  it("ne devine aucun compte si Supabase tombe ET que le propriétaire est absent", async () => {
    const admin = await import("@/lib/supabase/admin");
    const reminders = await import("@/lib/reminders");
    vi.mocked(admin.listAuthorizedUserIds).mockRejectedValue(new Error("fetch failed"));
    delete process.env.BRIEF_OWNER_USER_ID;

    const res = await GET(req());
    const body = (await res.json()) as { users: number };

    expect(body.users).toBe(0);
    expect(reminders.runReminders).not.toHaveBeenCalled();
  });

  it("s'arrête au jeton avant de lister les comptes", async () => {
    const auth = await import("@/lib/cron-auth");
    const admin = await import("@/lib/supabase/admin");
    vi.mocked(auth.requireMachineToken).mockReturnValueOnce(
      Response.json({ error: "Jeton invalide." }, { status: 401 }),
    );

    expect((await GET(req())).status).toBe(401);
    expect(admin.listAuthorizedUserIds).not.toHaveBeenCalled();
  });
});
