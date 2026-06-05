import type { ProviderPlugin } from "coreblow/plugin-sdk/provider-model-shared";
import { CLAUDE_CLI_BACKEND_ID } from "./cli-constants.js";
import { readClaudeCliCredentialsForRuntime } from "./cli-auth-seam.js";

function resolveClaudeCliSyntheticAuth() {
  const credential = readClaudeCliCredentialsForRuntime();
  if (!credential) {
    return undefined;
  }
  if (credential.type === "oauth") {
    return {
      apiKey: credential.access,
      source: "Claude CLI native auth",
      mode: "oauth" as const,
    };
  }
  return {
    apiKey: credential.token,
    source: "Claude CLI native auth",
    mode: "token" as const,
  };
}

const anthropicProviderDiscovery: ProviderPlugin = {
  id: CLAUDE_CLI_BACKEND_ID,
  label: "Claude CLI",
  docsPath: "/providers/models",
  auth: [],
  resolveSyntheticAuth: ({ provider }) =>
    provider === CLAUDE_CLI_BACKEND_ID ? resolveClaudeCliSyntheticAuth() : undefined,
};

export default anthropicProviderDiscovery;
