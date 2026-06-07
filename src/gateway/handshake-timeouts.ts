export const DEFAULT_PREAUTH_HANDSHAKE_TIMEOUT_MS = 10_000;
export const MIN_CONNECT_CHALLENGE_TIMEOUT_MS = 250;
export const MAX_CONNECT_CHALLENGE_TIMEOUT_MS = DEFAULT_PREAUTH_HANDSHAKE_TIMEOUT_MS;

export function clampConnectChallengeTimeoutMs(
  timeoutMs: number,
  maxTimeoutMs = MAX_CONNECT_CHALLENGE_TIMEOUT_MS,
): number {
  return Math.max(
    MIN_CONNECT_CHALLENGE_TIMEOUT_MS,
    Math.min(Math.max(MIN_CONNECT_CHALLENGE_TIMEOUT_MS, maxTimeoutMs), timeoutMs),
  );
}

function normalizePositiveTimeoutMs(timeoutMs: unknown): number | undefined {
  return typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs > 0
    ? timeoutMs
    : undefined;
}

export function resolveConnectChallengeTimeoutMs(
  timeoutMs?: number | null,
  params?: {
    env?: NodeJS.ProcessEnv;
    configuredTimeoutMs?: number | null;
  },
): number {
  const configuredPreauthTimeoutMs = resolvePreauthHandshakeTimeoutMs({
    env: params?.env,
    configuredTimeoutMs: params?.configuredTimeoutMs,
  });
  const maxTimeoutMs = Math.max(DEFAULT_PREAUTH_HANDSHAKE_TIMEOUT_MS, configuredPreauthTimeoutMs);
  return typeof timeoutMs === "number" && Number.isFinite(timeoutMs)
    ? clampConnectChallengeTimeoutMs(timeoutMs, maxTimeoutMs)
    : configuredPreauthTimeoutMs;
}

export function getPreauthHandshakeTimeoutMsFromEnv(env: NodeJS.ProcessEnv = process.env): number {
  const configuredTimeout =
    env.COREBLOW_HANDSHAKE_TIMEOUT_MS || (env.VITEST && env.COREBLOW_TEST_HANDSHAKE_TIMEOUT_MS);
  if (configuredTimeout) {
    const parsed = Number(configuredTimeout);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_PREAUTH_HANDSHAKE_TIMEOUT_MS;
}

export function resolvePreauthHandshakeTimeoutMs(params?: {
  env?: NodeJS.ProcessEnv;
  configuredTimeoutMs?: number | null;
}): number {
  const envTimeout = getPreauthHandshakeTimeoutMsFromEnv(params?.env);
  if (envTimeout !== DEFAULT_PREAUTH_HANDSHAKE_TIMEOUT_MS) {
    return envTimeout;
  }
  return normalizePositiveTimeoutMs(params?.configuredTimeoutMs) ?? DEFAULT_PREAUTH_HANDSHAKE_TIMEOUT_MS;
}
