import { describe, expect, it } from "vitest";
import { createInMemoryAcpEventLedger } from "./event-ledger.js";

describe("ACP translator event replay contract", () => {
  it("keeps incomplete sessions from being replayed", async () => {
    const ledger = createInMemoryAcpEventLedger();
    await ledger.startSession({ sessionId: "s1", sessionKey: "key", cwd: "/tmp", complete: true });
    await ledger.markIncomplete({ sessionId: "s1", sessionKey: "key" });
    await expect(ledger.readReplayBySessionKey({ sessionKey: "key" })).resolves.toEqual({
      complete: false,
      events: [],
    });
  });
});
