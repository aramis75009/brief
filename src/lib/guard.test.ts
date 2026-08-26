import { describe, expect, it, vi } from "vitest";
import { requireSession } from "./guard";

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
