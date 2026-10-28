import { describe, expect, it } from "vitest";
import type { CoreBlowConfig } from "../config/types.coreblow.js";
import { ensureStaticModelAllowlistEntry } from "./model-allowlist-entry.js";

describe("ensureStaticModelAllowlistEntry", () => {
  it("returns unchanged config when modelRef is blank", () => {
    const cfg: CoreBlowConfig = { agents: { defaults: { model: "anthropic/claude-3-5-sonnet" } } };
    expect(ensureStaticModelAllowlistEntry({ cfg, modelRef: "   " })).toBe(cfg);
  });

  it("adds raw and canonical allowlist keys to configured models", () => {
    const cfg: CoreBlowConfig = {
      agents: {
        defaults: {
          models: {
            "openai/gpt-4o": {},
          },
        },
      },
    };
    const updated = ensureStaticModelAllowlistEntry({ cfg, modelRef: "claude-3-5-sonnet" });
    expect(updated.agents?.defaults?.models).toHaveProperty("claude-3-5-sonnet");
    expect(updated.agents?.defaults?.models).toHaveProperty("anthropic/claude-3-5-sonnet");
  });
});
