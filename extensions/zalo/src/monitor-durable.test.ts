import { describe, expect, it } from "vitest";
import { resolveZaloDurableReplyOptions } from "./monitor-durable.js";

describe("zalo durable reply", () => {
  it("resolves final text delivery options", () => {
    expect(
      resolveZaloDurableReplyOptions({
        payload: { text: "hello" },
        infoKind: "final",
        chatId: "42",
      }),
    ).toEqual({ to: "42" });
  });
});
