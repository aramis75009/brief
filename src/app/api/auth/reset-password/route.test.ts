import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const updateUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(async () => ({ auth: { updateUser } })),
}));

function req(body: unknown): Request {
  return new Request("http://localhost/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/reset-password", () => {
  it("400 si le mot de passe est absent", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });

  it("400 si le mot de passe fait moins de 8 caractères", async () => {
    const res = await POST(req({ password: "court" }));
    expect(res.status).toBe(400);
  });

  it("401 si updateUser échoue (lien expiré ou invalide)", async () => {
    updateUser.mockResolvedValueOnce({ data: null, error: { message: "expired" } });
    const res = await POST(req({ password: "nouveau-mot-de-passe" }));
    expect(res.status).toBe(401);
  });

  it("200 et met à jour le mot de passe si la session de récupération est valide", async () => {
    updateUser.mockResolvedValueOnce({ data: { user: { id: "u1" } }, error: null });
    const res = await POST(req({ password: "nouveau-mot-de-passe" }));
    expect(res.status).toBe(200);
    expect(updateUser).toHaveBeenCalledWith({ password: "nouveau-mot-de-passe" });
  });
});
