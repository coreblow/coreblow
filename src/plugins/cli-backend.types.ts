// CliBackendPlugin is in types.ts
export type { CliBackendPlugin } from "./types.js";

// PluginTextReplacement/PluginTextTransforms not in CoreBlow types.ts — define here
export type PluginTextReplacement = {
  from: string | RegExp;
  to: string;
};

export type PluginTextTransforms = {
  /** Rewrites applied to outbound prompt text before provider/CLI transport. */
  input?: PluginTextReplacement[];
  /** Rewrites applied to inbound assistant text before CoreBlow consumes it. */
  output?: PluginTextReplacement[];
};
