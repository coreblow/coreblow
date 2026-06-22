import { describe, expect, it } from "vitest";
import { resolveSignalQuoteContext } from "./inbound-context.js";

describe("Signal silent supplemental-context ingestion", () => {
  it("hides quotes from non-allowlisted group senders", () => {
    const context = resolveSignalQuoteContext({
      cfg: { channels: { signal: { contextVisibility: "allowlist" } } },
      accountId: "default",
      isGroup: true,
      effectiveGroupAllow: ["+15550001111"],
      dataMessage: {
        quote: { text: "private quote", author: "+15550002222" },
      },
    });
    expect(context.decision).toEqual({ include: false, reason: "blocked" });
    expect(context.visibleQuoteText).toBe("");
  });
});
