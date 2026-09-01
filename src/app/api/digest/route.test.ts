import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { fakeStore } from "@/lib/testing/fake-store";
import type { Settings } from "@/lib/settings";

vi.mock("@/lib/cron-auth");
vi.mock("@/lib/guard");

/**
 * La bascule « Digest Telegram ».
 *
 * ⚠️ Brief ne peut pas empêcher n8n d'envoyer — il peut seulement dire
 * « désactivé ». Ce que le test verrouille, c'est le CONTRAT que n8n doit
 * pouvoir tester : `enabled: false` et des listes vides, en 200 (un choix de
 * l'utilisateur n'est pas une erreur, et un 4xx ferait sonner l'automate).
 */
describe("GET /api/digest", () => {
  let settings: Settings;
  let store: ReturnType<typeof fakeStore>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const auth = await import("@/lib/cron-auth");
    const guard = await import("@/lib/guard");
    vi.mocked(auth.requireMachineToken).mockReturnValue(null);
    settings = { caldavSync: true, digest: true };
    store = fakeStore({
      readItems: vi.fn(async () => []),
      readProjects: vi.fn(async () => []),
      readSettings: vi.fn(async () => settings),
    });
    // Le jeton `digest` ne porte pas encore d'identité (lot 1) : la route lit
    // le Brief du propriétaire via `ownerStore()`.
    vi.mocked(guard.ownerStore).mockReturnValue(store);
  });

  const req = () => new Request("https://brief.example/api/digest");

  it("rend enabled:false et des listes vides quand le récap est coupé", async () => {
    settings = { caldavSync: true, digest: false };

    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enabled).toBe(false);
    expect(body.counts).toEqual({ overdue: 0, today: 0 });
    expect(body.overdue).toEqual([]);
    expect(body.today).toEqual([]);
    // Récap coupé : inutile d'aller lire les items.
    expect(store.readItems).not.toHaveBeenCalled();
  });

  it("rend enabled:true et le vrai récap quand il est actif", async () => {
    settings = { caldavSync: true, digest: true };

    const body = await (await GET(req())).json();
    expect(body.enabled).toBe(true);
    expect(body).toHaveProperty("generatedAt");
    expect(store.readItems).toHaveBeenCalledOnce();
  });
});
