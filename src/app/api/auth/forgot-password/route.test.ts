import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const resetPasswordForEmail = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(async () => ({ auth: { resetPasswordForEmail } })),
}));

function req(body: unknown): Request {
  return new Request("http://localhost/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/forgot-password", () => {
  it("400 si l'email est absent", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });

  it("réponse générique quand resetPasswordForEmail réussit", async () => {
    resetPasswordForEmail.mockResolvedValueOnce({ data: {}, error: null });
    const res = await POST(req({ email: "a@b.com" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/Si ce compte existe/);
  });

  it("même réponse générique quand resetPasswordForEmail échoue", async () => {
    resetPasswordForEmail.mockRejectedValueOnce(new Error("network down"));
    const res = await POST(req({ email: "unknown@b.com" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/Si ce compte existe/);
  });
});
