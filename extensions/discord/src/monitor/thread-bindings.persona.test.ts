/**
 * extensions/discord/src/monitor/thread-bindings.persona.test.ts
 *
 * CoreBlow — Discord Extension: Thread-bindings Persona Tests
 * Verifies Thread persona binding and resolution.
 */
import { describe, expect, it } from "vitest";
import {
  resolveThreadBindingPersona,
  resolveThreadBindingPersonaFromRecord,
} from "./thread-bindings.persona.js";

describe("thread binding persona", () => {
  it("prefers explicit label and prefixes with gear emoji", () => {
    expect(
      resolveThreadBindingPersona({ label: "codex thread", agentId: "codex" }),
    ).toBe("⚙️ codex thread");
  });

  it("falls back to agentId when label is missing", () => {
    expect(resolveThreadBindingPersona({ agentId: "codex" })).toBe("⚙️ codex");
  });

  it("falls back to agentId when label is empty string", () => {
    expect(resolveThreadBindingPersona({ label: "", agentId: "main" })).toBe("⚙️ main");
  });

  it("uses label over agentId", () => {
    expect(
      resolveThreadBindingPersona({ label: "my-label", agentId: "other-agent" }),
    ).toBe("⚙️ my-label");
  });

  it("builds persona from binding record using label", () => {
    const record = {
      accountId: "default",
      channelId: "parent-1",
      threadId: "thread-1",
      targetKind: "acp",
      targetSessionKey: "agent:codex:acp:session-1",
      agentId: "codex",
      boundBy: "system",
      boundAt: Date.now(),
      lastActivityAt: Date.now(),
      label: "codex-thread",
    } as any;

    expect(resolveThreadBindingPersonaFromRecord(record)).toBe("⚙️ codex-thread");
  });

  it("builds persona from binding record using agentId as fallback", () => {
    const record = {
      accountId: "default",
      channelId: "parent-1",
      threadId: "thread-1",
      targetKind: "acp",
      targetSessionKey: "agent:main:acp:session-1",
      agentId: "main",
      boundBy: "system",
      boundAt: Date.now(),
      lastActivityAt: Date.now(),
    } as any;

    expect(resolveThreadBindingPersonaFromRecord(record)).toBe("⚙️ main");
  });
});
