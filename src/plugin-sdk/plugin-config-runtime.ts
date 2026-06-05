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
