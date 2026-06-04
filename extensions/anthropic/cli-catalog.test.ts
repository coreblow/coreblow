import { describe, expect, it } from "vitest";
import {
  buildClaudeCliCatalogEntries,
  CLAUDE_CLI_DEFAULT_ALLOWLIST_REFS,
  CLAUDE_CLI_DEFAULT_MODEL_REF,
} from "./api.js";
import { legacyConfigRules } from "./doctor-contract-api.js";
import { createAnthropicProvider } from "./provider-contract-api.js";

describe("anthropic cli catalog facade", () => {
  it("builds Claude CLI catalog entries from the allowlist", () => {
    const entries = buildClaudeCliCatalogEntries();

    expect(CLAUDE_CLI_DEFAULT_MODEL_REF).toBe("claude-cli/claude-opus-4-6");
    expect(entries.map((entry) => `claude-cli/${entry.id}`)).toEqual([
      ...CLAUDE_CLI_DEFAULT_ALLOWLIST_REFS,
    ]);
    expect(entries[0]).toMatchObject({
      provider: "claude-cli",
      reasoning: true,
      input: ["text", "image"],
      contextWindow: 200_000,
    });
  });

  it("builds the Anthropic provider contract facade", () => {
    const provider = createAnthropicProvider();

    expect(provider.id).toBe("anthropic");
    expect(provider.hookAliases).toEqual(["claude-cli"]);
    expect(provider.envVars).toEqual(["ANTHROPIC_OAUTH_TOKEN", "ANTHROPIC_API_KEY"]);
    expect(provider.auth.map((method) => method.id)).toEqual(["cli", "setup-token", "api-key"]);
    expect(legacyConfigRules).toEqual([]);
  });
});
