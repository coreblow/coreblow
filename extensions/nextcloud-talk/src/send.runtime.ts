export { resolveMarkdownTableMode } from "coreblow/plugin-sdk/config-runtime";
export { ssrfPolicyFromAllowPrivateNetwork } from "coreblow/plugin-sdk/ssrf-runtime";
export { convertMarkdownTables } from "coreblow/plugin-sdk/text-runtime";
export { fetchWithSsrFGuard } from "../runtime-api.js";
export { resolveNextcloudTalkAccount } from "./accounts.js";
export { getNextcloudTalkRuntime } from "./runtime.js";
export { generateNextcloudTalkSignature } from "./signature.js";

export function requireRuntimeConfig<T>(cfg: T | undefined, context: string): T {
  if (cfg) return cfg;
  throw new Error(`${context} requires a resolved runtime config`);
}
