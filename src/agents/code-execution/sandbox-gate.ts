export const ALLOWED_CODE_EXECUTION_BACKENDS = [
  "docker",
  "corebox",
  "daytona",
  "e2b",
] as const;

export type CodeExecutionSandboxBackend = (typeof ALLOWED_CODE_EXECUTION_BACKENDS)[number];

export const DEFAULT_EXECUTE_CODE_RPC_ALLOWLIST = [
  "read",
  "write",
  "edit",
  "web_search",
  "web_fetch",
  "memory_search",
  "exec",
] as const;

export const DISALLOWED_EXECUTE_CODE_TOOLS = [
  "gateway",
  "nodes",
  "sessions_spawn",
  "sessions_send",
  "execute_code",
] as const;

export type SandboxEligibilityInput = {
  sandboxEnabled: boolean;
  backend?: string;
  dockerReadOnly?: boolean;
  explicitlyAuthorizedViaApprovals?: boolean;
};

export function assertExecuteCodeSandboxEligible(input: SandboxEligibilityInput): void {
  if (input.explicitlyAuthorizedViaApprovals) {
    return;
  }
  const normalizedBackend = input.backend?.trim().toLowerCase() ?? "";
  if (
    !input.sandboxEnabled ||
    !(ALLOWED_CODE_EXECUTION_BACKENDS as readonly string[]).includes(normalizedBackend)
  ) {
    throw new Error(
      `execute_code is fail-closed: an isolated sandbox backend (${ALLOWED_CODE_EXECUTION_BACKENDS.join(", ")}) or explicit approval authorization is required.`,
    );
  }
  if (normalizedBackend === "docker" && input.dockerReadOnly === false) {
    throw new Error(
      "execute_code requires docker --read-only rootfs when using the docker sandbox backend.",
    );
  }
}

export function isRpcToolAllowedForExecuteCode(
  toolName: string,
  allowlist: ReadonlyArray<string> = DEFAULT_EXECUTE_CODE_RPC_ALLOWLIST,
): boolean {
  const normalized = toolName.trim();
  if (!normalized) {
    return false;
  }
  if ((DISALLOWED_EXECUTE_CODE_TOOLS as readonly string[]).includes(normalized)) {
    return false;
  }
  return allowlist.includes(normalized);
}
