import { describe, expect, it } from "vitest";
import { monitorGoogleChatProvider } from "./monitor-reply-delivery.js";

describe("googlechat monitor reply delivery", () => {
  it("re-exports monitor provider", () => {
    expect(monitorGoogleChatProvider).toBeTypeOf("function");
  });
});
