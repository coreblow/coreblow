export function resolveLivePluginConfigObject(
  loadConfig: (() => unknown) | undefined,
  pluginId: string,
  fallback: Record<string, unknown> = {},
): Record<string, unknown> {
  const cfg = loadConfig?.() as { plugins?: { entries?: Record<string, unknown> } } | undefined;
  const live = cfg?.plugins?.entries?.[pluginId];
  return live && typeof live === "object" && !Array.isArray(live)
    ? (live as Record<string, unknown>)
    : fallback;
}

export function requireRuntimeConfig<T>(config: T, context: string): NonNullable<T> {
  if (config) {
    return config as NonNullable<T>;
  }
  throw new Error(
    `${context} requires a resolved runtime config. Load and resolve config at the command or gateway boundary, then pass cfg through the runtime path.`,
  );
}
