import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireSession, requireSessionOrMachineToken } from "./guard";

const getClaims = vi.fn();

vi.mock("./supabase/server", () => ({
  getSupabaseServerClient: vi.fn(async () => ({ auth: { getClaims } })),
}));

describe("requireSession", () => {
  it("renvoie null quand la session est valide", async () => {
    getClaims.mockResolvedValueOnce({ data: { claims: { sub: "user-1" } }, error: null });
    expect(await requireSession()).toBeNull();
  });

  it("renvoie 401 quand il n'y a pas de session", async () => {
    getClaims.mockResolvedValueOnce({ data: null, error: { message: "no session" } });
    const res = await requireSession();
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });
});

/**
 * Garde mixte de `/api/agenda` : l'app appelle avec la session (accueil,
 * onglet Agenda, calendrier desktop), un agent appelle avec le jeton machine.
 * Les deux chemins doivent rester ouverts en même temps — c'est le point de
 * la garde, et le casser n'émet aucune erreur côté serveur.
 */
describe("requireSessionOrMachineToken", () => {
  const TOKEN = "digest-token-pour-les-agents";
  const URL_AGENDA = "https://brief.example/api/agenda?date=2026-08-30";

  const req = (headers: Record<string, string> = {}, url = URL_AGENDA) =>
    new Request(url, { headers });

  beforeEach(() => {
    process.env.BRIEF_DIGEST_TOKEN = TOKEN;
  });
  afterEach(() => {
    delete process.env.BRIEF_DIGEST_TOKEN;
    getClaims.mockReset();
  });

  it("laisse passer un navigateur avec session, sans jeton machine", async () => {
    getClaims.mockResolvedValueOnce({ data: { claims: { sub: "user-1" } }, error: null });
    expect(await requireSessionOrMachineToken(req(), "BRIEF_DIGEST_TOKEN")).toBeNull();
  });

  it("laisse passer un agent avec un Bearer valide, SANS consulter la session", async () => {
    const denied = await requireSessionOrMachineToken(
      req({ authorization: `Bearer ${TOKEN}` }),
      "BRIEF_DIGEST_TOKEN",
    );
    expect(denied).toBeNull();
    expect(getClaims).not.toHaveBeenCalled();
  });

  it("répond « Jeton invalide » (pas « session expirée ») sur un Bearer erroné", async () => {
    const res = await requireSessionOrMachineToken(
      req({ authorization: "Bearer mauvais-jeton" }),
      "BRIEF_DIGEST_TOKEN",
    );
    expect(res!.status).toBe(401);
    await expect(res!.json()).resolves.toEqual({ error: "Jeton invalide." });
    expect(getClaims).not.toHaveBeenCalled();
  });

  it("accepte `?token=` seulement quand la route l'autorise", async () => {
    const url = `${URL_AGENDA}&token=${encodeURIComponent(TOKEN)}`;
    expect(
      await requireSessionOrMachineToken(req({}, url), "BRIEF_DIGEST_TOKEN", {
        allowQueryToken: true,
      }),
    ).toBeNull();

    // Sans l'opt-in, le `?token=` n'est pas une pièce d'identité : on retombe
    // sur la session, qui est absente ici.
    getClaims.mockResolvedValueOnce({ data: null, error: { message: "no session" } });
    const res = await requireSessionOrMachineToken(req({}, url), "BRIEF_DIGEST_TOKEN");
    expect(res!.status).toBe(401);
    await expect(res!.json()).resolves.toEqual({ error: "Session invalide ou expirée." });
  });

  it("renvoie 401 session quand ni session ni jeton", async () => {
    getClaims.mockResolvedValueOnce({ data: null, error: { message: "no session" } });
    const res = await requireSessionOrMachineToken(req(), "BRIEF_DIGEST_TOKEN");
    expect(res!.status).toBe(401);
    await expect(res!.json()).resolves.toEqual({ error: "Session invalide ou expirée." });
  });
});
