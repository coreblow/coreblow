/**
 * src/bootstrap/node-startup-env.ts
 * Mock missing bootstrap dependencies
 */

export function resolveNodeStartupTlsEnvironment(params: {
    env: Record<string, string | undefined>;
    platform: NodeJS.Platform;
    execPath?: string;
}): { NODE_EXTRA_CA_CERTS?: string; NODE_USE_SYSTEM_CA?: string } | undefined {
    return undefined;
}
