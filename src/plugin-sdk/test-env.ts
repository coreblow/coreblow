export function createMockServerResponse() {
  const chunks: string[] = [];
  return {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: chunks,
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
    },
    end(chunk?: string) {
      if (chunk) {
        chunks.push(chunk);
      }
    },
  };
}

export function isLiveTestEnabled(input: NodeJS.ProcessEnv | readonly string[] = process.env): boolean {
  if (Array.isArray(input)) {
    return input.some((key) => process.env[key]?.trim() === "1");
  }
  const env = input as NodeJS.ProcessEnv;
  return env.COREBLOW_LIVE_TESTS === "1" || env.COREBLOW_LIVE_TESTS === "true";
}

export function installPinnedHostnameTestHooks(): void {
  // CoreBlow's provider tests use the default guarded fetch implementation.
}

export { createTempHomeEnv, type TempHomeEnv } from "../test-utils/temp-home.js";
export { createProviderUsageFetch, makeResponse } from "../test-utils/provider-usage-fetch.js";
