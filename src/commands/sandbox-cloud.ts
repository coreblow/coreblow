import { type RuntimeEnv, writeRuntimeJson } from "../runtime.js";
import type { PersistentSandboxProvider, PersistentSandboxProviderId } from "../sandbox/persistent-session.js";
import { DaytonaSandboxProvider } from "../sandbox/providers/daytona.js";
import { E2BSandboxProvider } from "../sandbox/providers/e2b.js";

export type CloudSandboxAction = "create" | "exec" | "pause" | "resume" | "destroy";

export interface SandboxCloudOptions {
  readonly backend?: string;
  readonly session?: string;
  readonly template?: string;
  readonly command?: string;
  readonly json?: boolean;
  readonly timeoutMs?: number;
  readonly fetchImpl?: typeof fetch;
}

function resolveCloudProvider(
  backend: string | undefined,
  opts: SandboxCloudOptions,
): PersistentSandboxProvider {
  const normalized = String(backend ?? "").trim().toLowerCase() as PersistentSandboxProviderId;
  if (normalized === "daytona") {
    return new DaytonaSandboxProvider({
      fetchImpl: opts.fetchImpl,
      defaultTimeoutMs: opts.timeoutMs,
    });
  }
  if (normalized === "e2b") {
    return new E2BSandboxProvider({
      fetchImpl: opts.fetchImpl,
      defaultTimeoutMs: opts.timeoutMs,
    });
  }
  throw new Error(`Unsupported cloud sandbox backend '${backend ?? ""}'. Expected 'daytona' or 'e2b'.`);
}

function failMissingKey(backend: PersistentSandboxProviderId, json: boolean, runtime: RuntimeEnv): void {
  const keyName = backend === "daytona" ? "DAYTONA_API_KEY" : "E2B_API_KEY";
  const payload = {
    ok: false,
    backend,
    error: `${keyName}_MISSING`,
    message: `Set ${keyName} to use the ${backend} sandbox backend.`,
  };
  if (json) {
    writeRuntimeJson(runtime, payload);
  } else {
    runtime.error(payload.message);
  }
  runtime.exit(1);
}

export async function sandboxCloudCommand(
  action: CloudSandboxAction,
  opts: SandboxCloudOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  const json = Boolean(opts.json);
  const provider = resolveCloudProvider(opts.backend, opts);
  if (!provider.isConfigured()) {
    failMissingKey(provider.id, json, runtime);
    return;
  }

  if (action === "create") {
    const session = await provider.create({
      template: opts.template,
      timeoutMs: opts.timeoutMs,
    });
    if (json) {
      writeRuntimeJson(runtime, { ok: true, action, session: session.handle });
    } else {
      runtime.log(`Created ${provider.id} sandbox ${session.handle.id} (${session.handle.state})`);
    }
    return;
  }

  const sessionId = String(opts.session ?? "").trim();
  if (!sessionId) {
    throw new Error(`--session <id> is required for 'coreblow sandbox ${action}'`);
  }

  const session = await provider.connect(sessionId);

  if (action === "exec") {
    const command = String(opts.command ?? "").trim();
    if (!command) {
      throw new Error("A command is required for 'coreblow sandbox exec' (e.g. -- <cmd>)");
    }
    const result = await session.exec(command, { timeoutMs: opts.timeoutMs });
    if (json) {
      writeRuntimeJson(runtime, { ok: result.success, action, backend: provider.id, sessionId, ...result });
    } else {
      if (result.output) runtime.log(result.output);
      if (!result.success && result.error) runtime.error(result.error);
    }
    if (!result.success) {
      runtime.exit(result.exitCode || 1);
    }
    return;
  }

  if (action === "pause") {
    const handle = await session.pause();
    if (json) {
      writeRuntimeJson(runtime, { ok: true, action, session: handle });
    } else {
      runtime.log(`Paused ${provider.id} sandbox ${handle.id}`);
    }
    return;
  }

  if (action === "resume") {
    const handle = await session.resume();
    if (json) {
      writeRuntimeJson(runtime, { ok: true, action, session: handle });
    } else {
      runtime.log(`Resumed ${provider.id} sandbox ${handle.id}`);
    }
    return;
  }

  await session.destroy();
  if (json) {
    writeRuntimeJson(runtime, { ok: true, action: "destroy", backend: provider.id, sessionId });
  } else {
    runtime.log(`Destroyed ${provider.id} sandbox ${sessionId}`);
  }
}
