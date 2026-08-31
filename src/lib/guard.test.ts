import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ownerStore,
  requireSession,
  requireSessionOrMachineToken,
  requireStore,
  requireStoreOrMachineToken,
  sessionUserId,
} from "./guard";

const getClaims = vi.fn();

vi.mock("./supabase/server", () => ({
  getSupabaseServerClient: vi.fn(async () => ({ auth: { getClaims } })),
}));

const UUID = "11111111-1111-4111-8111-111111111111";

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

/**
 * `requireStore` — la porte unique du cloisonnement.
 *
 * Elle fait la garde de session ET la résolution du compte en un appel : ce qui
 * rend impossible d'avoir l'un sans l'autre. Un oubli ici ne lèverait aucune
 * erreur — la route répondrait 200 avec les données de quelqu'un d'autre.
 */
describe("requireStore", () => {
  afterEach(() => getClaims.mockReset());

  it("rend 401 sans session", async () => {
    getClaims.mockResolvedValueOnce({ data: null, error: { message: "no session" } });
    const r = await requireStore();
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).status).toBe(401);
  });

  it("rend le store du compte de la session", async () => {
    getClaims.mockResolvedValueOnce({ data: { claims: { sub: UUID } }, error: null });
    const r = await requireStore();
    expect(r).not.toBeInstanceOf(Response);
    expect((r as { userId: string }).userId).toBe(UUID);
    expect(typeof (r as { store: { readItems: unknown } }).store.readItems).toBe("function");
  });

  it("rend 401 quand le JWT n'a pas de `sub`", async () => {
    getClaims.mockResolvedValueOnce({ data: { claims: { email: "x@y.z" } }, error: null });
    expect(((await requireStore()) as Response).status).toBe(401);
  });

  it("rend 401 quand le `sub` n'est pas un UUID — jamais une exception au fond du store", async () => {
    getClaims.mockResolvedValueOnce({ data: { claims: { sub: "../../etc" } }, error: null });
    expect(((await requireStore()) as Response).status).toBe(401);
  });
});

describe("sessionUserId", () => {
  afterEach(() => getClaims.mockReset());

  it("rend le `sub` quand il est exploitable", async () => {
    getClaims.mockResolvedValueOnce({ data: { claims: { sub: UUID } }, error: null });
    expect(await sessionUserId()).toBe(UUID);
  });

  it("rend null sur un `sub` non conforme", async () => {
    getClaims.mockResolvedValueOnce({ data: { claims: { sub: "user-1" } }, error: null });
    expect(await sessionUserId()).toBeNull();
  });
});

/**
 * `ownerStore` — transitoire (lot 1). Les jetons machine `capture` et `digest`
 * ne portent pas encore d'identité : ils écrivent chez le propriétaire.
 */
describe("ownerStore", () => {
  afterEach(() => delete process.env.BRIEF_OWNER_USER_ID);

  it("rend le store du propriétaire", () => {
    process.env.BRIEF_OWNER_USER_ID = UUID;
    expect(ownerStore()).not.toBeInstanceOf(Response);
  });

  it("rend 503 plutôt qu'un store au hasard quand la variable manque", async () => {
    delete process.env.BRIEF_OWNER_USER_ID;
    const r = ownerStore();
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).status).toBe(503);
  });

  it("rend 503 sur un identifiant non conforme", () => {
    process.env.BRIEF_OWNER_USER_ID = "pas-un-uuid";
    expect((ownerStore() as Response).status).toBe(503);
  });
});

describe("requireStoreOrMachineToken", () => {
  const TOKEN = "digest-token-pour-les-agents";
  const req = (headers: Record<string, string> = {}) =>
    new Request("https://brief.example/api/agenda?date=2026-08-30", { headers });

  beforeEach(() => {
    process.env.BRIEF_DIGEST_TOKEN = TOKEN;
    process.env.BRIEF_OWNER_USER_ID = UUID;
  });
  afterEach(() => {
    delete process.env.BRIEF_DIGEST_TOKEN;
    delete process.env.BRIEF_OWNER_USER_ID;
    getClaims.mockReset();
  });

  it("rend le store de la session pour un navigateur", async () => {
    getClaims.mockResolvedValueOnce({ data: { claims: { sub: UUID } }, error: null });
    const r = await requireStoreOrMachineToken(req(), "BRIEF_DIGEST_TOKEN");
    expect((r as { userId: string }).userId).toBe(UUID);
  });

  it("rend le store du propriétaire pour un agent, SANS consulter la session", async () => {
    const r = await requireStoreOrMachineToken(
      req({ authorization: `Bearer ${TOKEN}` }),
      "BRIEF_DIGEST_TOKEN",
    );
    expect(r).not.toBeInstanceOf(Response);
    expect(getClaims).not.toHaveBeenCalled();
  });

  it("répond « Jeton invalide » sur un Bearer erroné", async () => {
    const r = await requireStoreOrMachineToken(
      req({ authorization: "Bearer mauvais-jeton" }),
      "BRIEF_DIGEST_TOKEN",
    );
    expect((r as Response).status).toBe(401);
    await expect((r as Response).json()).resolves.toEqual({ error: "Jeton invalide." });
  });
});
