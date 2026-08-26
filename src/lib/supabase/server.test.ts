import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [],
    set: () => {},
  })),
}));

describe("getSupabaseServerClient", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("throws a clear error when Supabase env vars are missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    const { getSupabaseServerClient } = await import("./server");
    await expect(getSupabaseServerClient()).rejects.toThrow(/SUPABASE/);
  });

  it("builds a client when env vars are present", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_xxx");
    const { getSupabaseServerClient } = await import("./server");
    const client = await getSupabaseServerClient();
    expect(client.auth).toBeDefined();
  });
});
