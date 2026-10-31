import { describe, expect, it } from "vitest";
import { readEnv } from "@/lib/env";

describe("env", () => {
  it("defaults to demo mode with no provider credentials", () => {
    const env = readEnv();
    expect(env.demoMode).toBe(true);
    expect(env.maxImageBytes).toBeGreaterThan(0);
    expect(env.provider === "gemini" || env.provider === "anthropic").toBe(true);
  });
});
