import { describe, expect, it } from "vitest";
import { CoreBlow, normalizeGatewayEvent } from "./index.js";

describe("CoreBlow SDK package facade", () => {
  it("keeps the package entrypoint importable", () => {
    const event = normalizeGatewayEvent({
      event: "agent",
      payload: { runId: "pack-smoke", stream: "lifecycle", data: { phase: "start" } },
    });

    expect(typeof CoreBlow).toBe("function");
    expect(event.type).toBe("run.started");
  });
});
