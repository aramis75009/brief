import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/guard");

/**
 * La route rend désormais l'ADRESSE du compte en plus de l'état de session :
 * le bloc « Compte » des Réglages l'affiche et l'envoie à
 * `/api/auth/forgot-password`. Elle vient des claims du JWT déjà vérifié,
 * jamais d'un champ posé par le client — sinon n'importe quelle session valide
 * pourrait demander la réinitialisation d'un AUTRE compte.
 */
describe("GET /api/auth/session", () => {
  it("200 avec l'adresse quand la session est valide", async () => {
    const guardModule = await import("@/lib/guard");
    vi.mocked(guardModule.readSessionClaims).mockResolvedValueOnce({
      sub: "user-1",
      email: "aramis@example.com",
    });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ authenticated: true, email: "aramis@example.com" });
  });

  it("200 avec email null quand le claim est absent ou mal typé", async () => {
    const guardModule = await import("@/lib/guard");
    vi.mocked(guardModule.readSessionClaims).mockResolvedValueOnce({ sub: "user-1" });
    expect(await (await GET()).json()).toEqual({ authenticated: true, email: null });

    vi.mocked(guardModule.readSessionClaims).mockResolvedValueOnce({ sub: "user-1", email: 42 });
    expect(await (await GET()).json()).toEqual({ authenticated: true, email: null });
  });

  it("401 quand il n'y a pas de session", async () => {
    const guardModule = await import("@/lib/guard");
    vi.mocked(guardModule.readSessionClaims).mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });
});
