import { describe, expect, it } from "vitest";
import type { CoreBlowConfig } from "../config/config.js";
import { resolveConfiguredAcpBindingRecord as resolveReadOnlyBinding } from "./acp-binding-resolve-runtime.js";
import {
  ensureConfiguredAcpBindingReady,
  resolveConfiguredAcpBindingRecord,
} from "./acp-binding-runtime.js";

describe("ACP binding SDK runtimes", () => {
  const cfg = {} satisfies CoreBlowConfig;

  it("exposes the same read-only configured binding resolver", () => {
    const params = {
      cfg,
      channel: "matrix",
      accountId: "default",
      conversationId: "room-1",
    };

    expect(resolveReadOnlyBinding(params)).toBeNull();
    expect(resolveConfiguredAcpBindingRecord(params)).toBeNull();
  });

  it("treats a missing configured binding as ready", async () => {
    await expect(
      ensureConfiguredAcpBindingReady({
        cfg,
        configuredBinding: null,
      }),
    ).resolves.toEqual({ ok: true });
  });
});
