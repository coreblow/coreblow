import { describe, it, expect } from "vitest";
import {
  loadValidConfigOrThrow,
  updateConfig,
  resolveModelTarget,
  resolveModelKeysFromEntries,
  buildAllowlistSet,
  normalizeAlias,
  resolveKnownAgentId,
  upsertCanonicalModelConfigEntry,
  mergePrimaryFallbackConfig,
  applyDefaultModelPrimaryUpdate,
  ensureFlagCompatibility,
  formatTokenK,
  formatMs,
  isLocalBaseUrl,
} from "./shared.js";

describe("shared — export contract", () => {
  it("exports expected public API surface", () => {
    expect(typeof loadValidConfigOrThrow).toBe("function");
    expect(typeof updateConfig).toBe("function");
    expect(typeof resolveModelTarget).toBe("function");
    expect(typeof resolveModelKeysFromEntries).toBe("function");
    expect(typeof buildAllowlistSet).toBe("function");
    expect(typeof normalizeAlias).toBe("function");
    expect(typeof resolveKnownAgentId).toBe("function");
    expect(typeof upsertCanonicalModelConfigEntry).toBe("function");
    expect(typeof mergePrimaryFallbackConfig).toBe("function");
    expect(typeof applyDefaultModelPrimaryUpdate).toBe("function");
    expect(ensureFlagCompatibility).toBeDefined();
    expect(formatTokenK).toBeDefined();
    expect(formatMs).toBeDefined();
    expect(isLocalBaseUrl).toBeDefined();
  });
});
