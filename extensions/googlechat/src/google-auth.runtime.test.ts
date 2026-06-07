import { describe, expect, it } from "vitest";
import { GOOGLE_CHAT_SCOPE, testing } from "./google-auth.runtime.js";

describe("googlechat auth runtime", () => {
  it("exposes scope and testing reset", () => {
    testing.clearAuthCache();
    expect(GOOGLE_CHAT_SCOPE).toContain("chat.bot");
  });
});
