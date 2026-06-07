import { describe, expect, it } from "vitest";
import { resolveGoogleChatConfigAccessorAccount } from "./accounts.js";

describe("googlechat channel config accessor", () => {
  it("resolves the default account accessor", () => {
    expect(resolveGoogleChatConfigAccessorAccount({ cfg: {} }).accountId).toBe("default");
  });
});
