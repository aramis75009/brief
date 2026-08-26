// src/app/api/auth/logout/route.test.ts
import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const signOut = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(async () => ({ auth: { signOut } })),
}));

describe("POST /api/auth/logout", () => {
  it("appelle signOut et renvoie ok", async () => {
    const res = await POST();
    expect(signOut).toHaveBeenCalledOnce();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
