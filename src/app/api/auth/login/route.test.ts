import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const signInWithPassword = vi.fn();
const signOut = vi.fn();
const maybeSingle = vi.fn();
const update = vi.fn();

function makeQueryBuilder() {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle,
    update: vi.fn((patch: unknown) => {
      update(patch);
      return builder;
    }),
  };
  return builder;
}

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(async () => ({
    auth: { signInWithPassword, signOut },
    from: vi.fn(() => makeQueryBuilder()),
  })),
}));

function req(body: unknown): Request {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/login", () => {
  it("401 générique si email ou mot de passe manquant", async () => {
    const res = await POST(req({ email: "" }));
    expect(res.status).toBe(401);
  });

  it("401 générique si signInWithPassword échoue", async () => {
    signInWithPassword.mockResolvedValueOnce({ data: { user: null }, error: { message: "bad" } });
    const res = await POST(req({ email: "a@b.com", password: "x" }));
    expect(res.status).toBe(401);
  });

  it("403 et déconnexion si l'email n'est pas dans authorized_users", async () => {
    signInWithPassword.mockResolvedValueOnce({ data: { user: { id: "u1" } }, error: null });
    maybeSingle.mockResolvedValueOnce({ data: null });
    const res = await POST(req({ email: "a@b.com", password: "x" }));
    expect(res.status).toBe(403);
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("200 et met à jour last_login_at si autorisé", async () => {
    signInWithPassword.mockResolvedValueOnce({ data: { user: { id: "u1" } }, error: null });
    maybeSingle.mockResolvedValueOnce({ data: { user_id: "u1" } });
    const res = await POST(req({ email: "a@b.com", password: "x" }));
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ last_login_at: expect.any(String) }),
    );
  });
});
