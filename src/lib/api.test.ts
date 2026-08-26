import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch, UnauthorizedError } from "./api";

describe("apiFetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lève UnauthorizedError sur 401", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 401 })));
    await expect(apiFetch("/api/items")).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("renvoie la réponse telle quelle si ce n'est pas 401", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("ok", { status: 200 })));
    const res = await apiFetch("/api/items");
    expect(res.status).toBe(200);
  });
});
