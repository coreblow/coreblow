export function resolveDaemonContainerContext(
  env: Record<string, string | undefined> = process.env,
): string | null {
  return env.COREBLOW_CONTAINER_HINT?.trim() || env.COREBLOW_CONTAINER?.trim() || null;
}
