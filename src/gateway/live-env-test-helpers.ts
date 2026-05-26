const COMMON_LIVE_ENV_NAMES = [
  "COREBLOW_AGENT_RUNTIME",
  "COREBLOW_CONFIG_PATH",
  "COREBLOW_GATEWAY_TOKEN",
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "COREBLOW_SKIP_BROWSER_CONTROL_SERVER",
  "COREBLOW_SKIP_CANVAS_HOST",
  "COREBLOW_SKIP_CHANNELS",
  "COREBLOW_SKIP_CRON",
  "COREBLOW_SKIP_GMAIL_WATCHER",
  "COREBLOW_STATE_DIR",
] as const;

export type LiveEnvSnapshot = Record<string, string | undefined>;

export function snapshotLiveEnv(extraNames: readonly string[] = []): LiveEnvSnapshot {
  const snapshot: LiveEnvSnapshot = {};
  for (const name of [...COMMON_LIVE_ENV_NAMES, ...extraNames]) {
    snapshot[name] = process.env[name];
  }
  return snapshot;
}

export function restoreLiveEnv(snapshot: LiveEnvSnapshot): void {
  for (const [name, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
}
