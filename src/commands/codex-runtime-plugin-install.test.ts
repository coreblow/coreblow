import { describe, expect, it } from "vitest";
import type { CoreBlowConfig } from "../config/config.js";
import {
  CODEX_RUNTIME_PLUGIN_ID,
  selectedModelShouldEnsureCodexRuntimePlugin,
} from "./codex-runtime-plugin-install.js";

describe("codex-runtime-plugin-install", () => {
  it("exports CODEX_RUNTIME_PLUGIN_ID as codex", () => {
    expect(CODEX_RUNTIME_PLUGIN_ID).toBe("codex");
  });

  it("checks whether selected model should ensure codex runtime plugin", () => {
    const cfg: CoreBlowConfig = {};
    const notCodex = selectedModelShouldEnsureCodexRuntimePlugin({
      cfg,
      model: "anthropic/claude-3-5-sonnet",
    });
    expect(notCodex).toBe(false);
  });
});
