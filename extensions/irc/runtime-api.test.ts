import { describe, expect, it } from "vitest";

describe("irc runtime api", () => {
  it("loads directly", async () => {
    await expect(import("./runtime-api.js")).resolves.toBeTruthy();
  });
});
