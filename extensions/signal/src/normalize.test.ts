import { describe, expect, it } from "vitest";
import { looksLikeSignalTargetId, normalizeSignalMessagingTarget } from "./normalize.js";

describe("Signal target normalization", () => {
  it("normalizes provider, UUID, group, and username forms", () => {
    expect(normalizeSignalMessagingTarget("signal:group:ABC")).toBe("group:ABC");
    expect(normalizeSignalMessagingTarget("u:Alice")).toBe("username:alice");
    expect(looksLikeSignalTargetId("uuid:123e4567-e89b-12d3-a456-426614174000")).toBe(true);
  });
});
