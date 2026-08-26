import { describe, expect, it } from "vitest";
import { config } from "./proxy";

describe("proxy config", () => {
  it("exclut les assets statiques et le favicon du matcher", () => {
    const [pattern] = config.matcher;
    expect(pattern).toContain("_next/static");
    expect(pattern).toContain("_next/image");
    expect(pattern).toContain("favicon.ico");
  });
});
