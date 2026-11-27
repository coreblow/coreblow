import {
  capSandboxOutput,
  DEFAULT_SANDBOX_MAX_OUTPUT_BYTES,
  type PersistentSandboxCreateOptions,
  type PersistentSandboxProvider,
  type PersistentSandboxSession,
  type PersistentSandboxSessionHandle,
  redactSandboxSecrets,
  type SandboxExecOptions,
  type SandboxExecResult,
  type SandboxFileEntry,
  sanitizeSandboxPath,
} from "../persistent-session.js";

export interface DaytonaProviderConfig {
  readonly apiKey?: string;
  readonly apiUrl?: string;
  readonly fetchImpl?: typeof fetch;
  readonly defaultTimeoutMs?: number;
}

interface DaytonaSandboxResponse {
  id?: string;
  state?: string;
  createdAt?: string;
  endpoint?: string;
  template?: string;
}

interface DaytonaExecResponse {
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  output?: string;
}

interface DaytonaFilesReadResponse {
  files?: Array<{ path?: string; content?: string }>;
}

export class DaytonaSandboxProvider implements PersistentSandboxProvider {
  readonly id = "daytona" as const;
  private readonly apiKey?: string;
  private readonly apiUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly defaultTimeoutMs: number;

  constructor(config: DaytonaProviderConfig = {}) {
    this.apiKey = (config.apiKey ?? process.env.DAYTONA_API_KEY)?.trim() || undefined;
    this.apiUrl = (config.apiUrl ?? process.env.DAYTONA_API_URL ?? "https://app.daytona.io/api").replace(/\/+$/, "");
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch;
    this.defaultTimeoutMs = config.defaultTimeoutMs ?? 30_000;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  private requireApiKey(): string {
    if (!this.apiKey) {
      throw new Error("DAYTONA_API_KEY_MISSING: Set DAYTONA_API_KEY to use the Daytona sandbox backend.");
    }
    return this.apiKey;
  }

  private async requestJson<T>(
    method: string,
    pathname: string,
    body?: unknown,
    timeoutMs: number = this.defaultTimeoutMs,
  ): Promise<T> {
    const apiKey = this.requireApiKey();
    const url = `${this.apiUrl}${pathname}`;
    const res = await this.fetchImpl(url, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(Math.max(100, timeoutMs)),
    });

    const rawText = await res.text();
    if (!res.ok) {
      const safeBody = redactSandboxSecrets(rawText, [apiKey]);
      throw new Error(`Daytona API ${method} ${pathname} failed (${res.status}): ${safeBody || res.statusText}`);
    }
    if (!rawText.trim()) {
      return {} as T;
    }
    return JSON.parse(rawText) as T;
  }

  private wrapSession(handle: PersistentSandboxSessionHandle): PersistentSandboxSession {
    let currentHandle = handle;
    const apiKey = this.apiKey;

    return {
      get handle() {
        return currentHandle;
      },

      exec: async (command: string, opts: SandboxExecOptions = {}): Promise<SandboxExecResult> => {
        const start = Date.now();
        const timeoutMs = opts.timeoutMs ?? this.defaultTimeoutMs;
        try {
          const data = await this.requestJson<DaytonaExecResponse>(
            "POST",
            `/sandboxes/${encodeURIComponent(currentHandle.id)}/exec`,
            {
              command,
              cwd: opts.cwd,
              env: opts.env,
              timeoutMs,
            },
            timeoutMs,
          );
          const exitCode = typeof data.exitCode === "number" ? data.exitCode : 0;
          const rawOut = data.output ?? ([data.stdout, data.stderr].filter(Boolean).join("\n") || "");
          const output = capSandboxOutput(
            redactSandboxSecrets(rawOut, [apiKey]),
            opts.maxOutputBytes ?? DEFAULT_SANDBOX_MAX_OUTPUT_BYTES,
          );
          return {
            success: exitCode === 0,
            output,
            exitCode,
            durationMs: Date.now() - start,
            error: exitCode !== 0 ? output || `Exited with code ${exitCode}` : undefined,
          };
        } catch (err) {
          const msg = redactSandboxSecrets(err instanceof Error ? err.message : String(err), [apiKey]);
          return {
            success: false,
            output: msg,
            exitCode: 1,
            durationMs: Date.now() - start,
            error: msg,
          };
        }
      },

      syncFilesToSandbox: async (files: readonly SandboxFileEntry[]): Promise<void> => {
        const sanitized = files.map((f) => ({
          path: sanitizeSandboxPath(f.path),
          content: f.content,
        }));
        await this.requestJson("POST", `/sandboxes/${encodeURIComponent(currentHandle.id)}/files`, {
          files: sanitized,
        });
      },

      syncFilesFromSandbox: async (paths: readonly string[]): Promise<SandboxFileEntry[]> => {
        const sanitized = paths.map((p) => sanitizeSandboxPath(p));
        const res = await this.requestJson<DaytonaFilesReadResponse>(
          "POST",
          `/sandboxes/${encodeURIComponent(currentHandle.id)}/files/read`,
          { paths: sanitized },
        );
        return (res.files ?? []).map((f) => ({
          path: sanitizeSandboxPath(f.path ?? ""),
          content: String(f.content ?? ""),
        }));
      },

      pause: async (): Promise<PersistentSandboxSessionHandle> => {
        await this.requestJson("POST", `/sandboxes/${encodeURIComponent(currentHandle.id)}/pause`);
        currentHandle = { ...currentHandle, state: "paused" };
        return currentHandle;
      },

      resume: async (): Promise<PersistentSandboxSessionHandle> => {
        await this.requestJson("POST", `/sandboxes/${encodeURIComponent(currentHandle.id)}/resume`);
        currentHandle = { ...currentHandle, state: "running" };
        return currentHandle;
      },

      destroy: async (): Promise<void> => {
        await this.requestJson("DELETE", `/sandboxes/${encodeURIComponent(currentHandle.id)}`);
        currentHandle = { ...currentHandle, state: "destroyed" };
      },
    };
  }

  async create(opts: PersistentSandboxCreateOptions = {}): Promise<PersistentSandboxSession> {
    const res = await this.requestJson<DaytonaSandboxResponse>(
      "POST",
      "/sandboxes",
      {
        template: opts.template,
        env: opts.env,
        metadata: opts.metadata,
      },
      opts.timeoutMs ?? this.defaultTimeoutMs,
    );
    if (!res.id) {
      throw new Error("Daytona API /sandboxes response missing sandbox id");
    }
    return this.wrapSession({
      id: res.id,
      provider: "daytona",
      state: (res.state as PersistentSandboxSessionHandle["state"]) ?? "running",
      createdAt: res.createdAt ?? new Date().toISOString(),
      endpoint: res.endpoint ?? this.apiUrl,
      template: res.template ?? opts.template,
    });
  }

  async connect(sessionId: string): Promise<PersistentSandboxSession> {
    this.requireApiKey();
    const id = String(sessionId ?? "").trim();
    if (!id) {
      throw new Error("Daytona session id is required");
    }
    return this.wrapSession({
      id,
      provider: "daytona",
      state: "running",
      createdAt: new Date().toISOString(),
      endpoint: this.apiUrl,
    });
  }
}
