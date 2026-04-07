/**
 * src/bootstrap/node-extra-ca-certs.ts
 * Mock missing bootstrap dependencies
 */

export function isNodeVersionManagerRuntime(execPath: string): boolean {
    return false;
}

export function resolveLinuxSystemCaBundle(): string | undefined {
    return undefined;
}
