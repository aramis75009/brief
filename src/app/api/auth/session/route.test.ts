import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/guard");

describe("GET /api/auth/session", () => {
  it("200 authenticated quand la session est valide", async () => {
    const guardModule = await import("@/lib/guard");
    vi.mocked(guardModule.requireSession).mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ authenticated: true });
  });

  it("propage le 401 de requireSession", async () => {
    const guardModule = await import("@/lib/guard");
    vi.mocked(guardModule.requireSession).mockResolvedValueOnce(
      Response.json({ error: "x" }, { status: 401 })
    );
    const res = await GET();
    expect(res.status).toBe(401);
  });
});
