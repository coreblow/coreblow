/**
 * CoreBlow — Remote Environment Detection
 *
 * Detects whether the process is running in a remote/cloud context
 * (SSH, container, CI, WSL, VM) vs. a local desktop environment.
 * Used by the CLI and TUI to adjust behavior accordingly.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type RemoteContextType =
  | 'ssh'
  | 'container'
  | 'ci'
  | 'wsl'
  | 'cloud-shell'
  | 'local'
  | 'unknown';

export interface RemoteEnvInfo {
  type: RemoteContextType;
  isRemote: boolean;
  isContainer: boolean;
  isCi: boolean;
  isWsl: boolean;
  isSsh: boolean;
}

// ─── Detection ──────────────────────────────────────────────────────────────

function detectSsh(env: NodeJS.ProcessEnv): boolean {
  return Boolean(
    env.SSH_CLIENT?.trim() ||
    env.SSH_TTY?.trim() ||
    env.SSH_CONNECTION?.trim(),
  );
}

function detectContainer(env: NodeJS.ProcessEnv): boolean {
  return Boolean(
    env.KUBERNETES_SERVICE_HOST?.trim() ||
    env.DOCKER_CONTAINER?.trim() ||
    env.container?.trim(),
  );
}

function detectCi(env: NodeJS.ProcessEnv): boolean {
  return Boolean(
    env.CI?.trim() ||
    env.GITHUB_ACTIONS?.trim() ||
    env.GITLAB_CI?.trim() ||
    env.CIRCLECI?.trim() ||
    env.JENKINS_URL?.trim() ||
    env.BUILDKITE?.trim() ||
    env.TRAVIS?.trim() ||
    env.CODEBUILD_BUILD_ID?.trim(),
  );
}

function detectWsl(env: NodeJS.ProcessEnv): boolean {
  return Boolean(
    env.WSL_DISTRO_NAME?.trim() ||
    env.WSLENV?.trim(),
  );
}

function detectCloudShell(env: NodeJS.ProcessEnv): boolean {
  return Boolean(
    env.CLOUD_SHELL?.trim() ||
    env.GOOGLE_CLOUD_SHELL?.trim() ||
    env.AWS_CLOUD9_USER?.trim() ||
    env.CODESPACE_NAME?.trim(),
  );
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Detect the remote execution context.
 * Priority: container > CI > cloud-shell > SSH > WSL > local
 */
export function detectRemoteEnv(env: NodeJS.ProcessEnv = process.env): RemoteEnvInfo {
  const isSsh = detectSsh(env);
  const isContainer = detectContainer(env);
  const isCi = detectCi(env);
  const isWsl = detectWsl(env);
  const isCloudShell = detectCloudShell(env);

  let type: RemoteContextType = 'local';
  if (isContainer) type = 'container';
  else if (isCi) type = 'ci';
  else if (isCloudShell) type = 'cloud-shell';
  else if (isSsh) type = 'ssh';
  else if (isWsl) type = 'wsl';

  const isRemote = type !== 'local';

  return { type, isRemote, isContainer, isCi, isWsl, isSsh };
}

/** Quick check: are we in a remote context? */
export function isRemoteEnvironment(env: NodeJS.ProcessEnv = process.env): boolean {
  return detectRemoteEnv(env).isRemote;
}

/** Quick check: are we in a CI environment? */
export function isCiEnvironment(env: NodeJS.ProcessEnv = process.env): boolean {
  return detectCi(env);
}
