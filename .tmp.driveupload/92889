/**
 * secrets/resolve.ts
 * 3-source secret resolution engine (env / file / exec).
 * Ported from OpenClaw src/secrets/resolve.ts (959 LOC → ~450 LOC compressed).
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
    ExecSecretProviderConfig,
    FileSecretProviderConfig,
    ProviderResolutionOutput,
    ResolveSecretRefOptions,
    ResolutionLimits,
    SecretProviderConfig,
    SecretRef,
    SecretRefSource,
} from './types.js';
import { SINGLE_VALUE_FILE_REF_ID, resolveDefaultSecretProviderAlias, secretRefKey } from './ref-contract.js';
import { describeUnknownError, isNonEmptyString, isRecord, normalizePositiveInt } from './shared.js';

// ─── Defaults ─────────────────────────────────────────────────────
const DEFAULT_PROVIDER_CONCURRENCY = 4;
const DEFAULT_MAX_REFS_PER_PROVIDER = 512;
const DEFAULT_MAX_BATCH_BYTES = 256 * 1024;
const DEFAULT_FILE_MAX_BYTES = 1024 * 1024;
const DEFAULT_FILE_TIMEOUT_MS = 5_000;
const DEFAULT_EXEC_TIMEOUT_MS = 5_000;
const DEFAULT_EXEC_MAX_OUTPUT_BYTES = 1024 * 1024;

// ─── Error Types ──────────────────────────────────────────────────

export class SecretProviderResolutionError extends Error {
    readonly scope = 'provider' as const;
    readonly source: SecretRefSource;
    readonly provider: string;

    constructor(params: { source: SecretRefSource; provider: string; message: string; cause?: unknown }) {
        super(params.message, params.cause !== undefined ? { cause: params.cause } : undefined);
        this.name = 'SecretProviderResolutionError';
        this.source = params.source;
        this.provider = params.provider;
    }
}

export class SecretRefResolutionError extends Error {
    readonly scope = 'ref' as const;
    readonly source: SecretRefSource;
    readonly provider: string;
    readonly refId: string;

    constructor(params: { source: SecretRefSource; provider: string; refId: string; message: string; cause?: unknown }) {
        super(params.message, params.cause !== undefined ? { cause: params.cause } : undefined);
        this.name = 'SecretRefResolutionError';
        this.source = params.source;
        this.provider = params.provider;
        this.refId = params.refId;
    }
}

function providerError(source: SecretRefSource, provider: string, message: string, cause?: unknown) {
    return new SecretProviderResolutionError({ source, provider, message, cause });
}

function refError(source: SecretRefSource, provider: string, refId: string, message: string, cause?: unknown) {
    return new SecretRefResolutionError({ source, provider, refId, message, cause });
}

function throwUnknown(source: SecretRefSource, provider: string, err: unknown): never {
    if (err instanceof SecretProviderResolutionError || err instanceof SecretRefResolutionError) throw err;
    throw providerError(source, provider, describeUnknownError(err), err);
}

// ─── Path Security ────────────────────────────────────────────────

async function assertSecurePath(params: {
    targetPath: string;
    label: string;
    allowInsecurePath?: boolean;
    allowSymlinkPath?: boolean;
}): Promise<string> {
    if (!path.isAbsolute(params.targetPath)) {
        throw new Error(`${params.label} must be an absolute path.`);
    }

    const stat = await fs.stat(params.targetPath).catch(() => null);
    if (!stat) throw new Error(`${params.label} is not readable: ${params.targetPath}`);
    if (stat.isDirectory()) throw new Error(`${params.label} must be a file: ${params.targetPath}`);

    const lstat = await fs.lstat(params.targetPath);
    if (lstat.isSymbolicLink() && !params.allowSymlinkPath) {
        throw new Error(`${params.label} must not be a symlink: ${params.targetPath}`);
    }

    let effectivePath = params.targetPath;
    if (lstat.isSymbolicLink()) {
        effectivePath = await fs.realpath(params.targetPath);
    }

    if (params.allowInsecurePath) return effectivePath;

    // Check file permissions (POSIX only)
    if (process.platform !== 'win32') {
        const mode = stat.mode & 0o777;
        const worldReadable = (mode & 0o004) !== 0;
        const worldWritable = (mode & 0o002) !== 0;
        const groupWritable = (mode & 0o020) !== 0;
        if (worldWritable || groupWritable) {
            throw new Error(`${params.label} permissions are too open (${mode.toString(8)}): ${effectivePath}`);
        }
        if (worldReadable) {
            throw new Error(`${params.label} is world-readable (${mode.toString(8)}): ${effectivePath}`);
        }

        if (typeof process.getuid === 'function' && stat.uid !== process.getuid()) {
            throw new Error(`${params.label} must be owned by current user: ${effectivePath}`);
        }
    }

    return effectivePath;
}

// ─── ENV Resolution ───────────────────────────────────────────────

async function resolveEnvRefs(params: {
    refs: SecretRef[];
    providerName: string;
    providerConfig: Extract<SecretProviderConfig, { source: 'env' }>;
    env: NodeJS.ProcessEnv;
}): Promise<ProviderResolutionOutput> {
    const resolved = new Map<string, unknown>();
    const allowlist = params.providerConfig.allowlist ? new Set(params.providerConfig.allowlist) : null;

    for (const ref of params.refs) {
        if (allowlist && !allowlist.has(ref.id)) {
            throw refError('env', params.providerName, ref.id,
                `Environment variable "${ref.id}" is not allowlisted in secrets.providers.${params.providerName}.allowlist.`);
        }
        const envValue = params.env[ref.id];
        if (!isNonEmptyString(envValue)) {
            throw refError('env', params.providerName, ref.id,
                `Environment variable "${ref.id}" is missing or empty.`);
        }
        resolved.set(ref.id, envValue);
    }
    return resolved;
}

// ─── FILE Resolution ──────────────────────────────────────────────

async function resolveFileRefs(params: {
    refs: SecretRef[];
    providerName: string;
    providerConfig: FileSecretProviderConfig;
    cache?: import('./types.js').SecretRefResolveCache;
}): Promise<ProviderResolutionOutput> {
    const filePath = params.providerConfig.path;
    const cacheKey = params.providerName;
    let payload: unknown;

    // Check cache
    if (params.cache?.filePayloadByProvider?.has(cacheKey)) {
        payload = await params.cache.filePayloadByProvider.get(cacheKey)!;
    } else {
        const readPromise = (async () => {
            const securePath = await assertSecurePath({
                targetPath: path.resolve(filePath),
                label: `secrets.providers.${params.providerName}.path`,
                allowInsecurePath: params.providerConfig.allowInsecurePath,
                allowSymlinkPath: params.providerConfig.allowSymlinkPath,
            });

            const timeoutMs = normalizePositiveInt(params.providerConfig.timeoutMs, DEFAULT_FILE_TIMEOUT_MS);
            const maxBytes = normalizePositiveInt(params.providerConfig.maxBytes, DEFAULT_FILE_MAX_BYTES);

            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const buf = await fs.readFile(securePath, { signal: controller.signal });
                if (buf.byteLength > maxBytes) {
                    throw new Error(`File provider "${params.providerName}" exceeded maxBytes (${maxBytes}).`);
                }
                const text = buf.toString('utf8');
                if (params.providerConfig.mode === 'singleValue') {
                    return text.replace(/\r?\n$/, '');
                }
                const parsed = JSON.parse(text) as unknown;
                if (!isRecord(parsed)) {
                    throw new Error(`File provider "${params.providerName}" payload is not a JSON object.`);
                }
                return parsed;
            } finally {
                clearTimeout(timer);
            }
        })();

        if (params.cache) {
            params.cache.filePayloadByProvider ??= new Map();
            params.cache.filePayloadByProvider.set(cacheKey, readPromise);
        }
        try {
            payload = await readPromise;
        } catch (err) {
            throwUnknown('file', params.providerName, err);
        }
    }

    const resolved = new Map<string, unknown>();
    const mode = params.providerConfig.mode ?? 'json';

    if (mode === 'singleValue') {
        for (const ref of params.refs) {
            if (ref.id !== SINGLE_VALUE_FILE_REF_ID) {
                throw refError('file', params.providerName, ref.id,
                    `singleValue file provider expects ref id "${SINGLE_VALUE_FILE_REF_ID}".`);
            }
            resolved.set(ref.id, payload);
        }
        return resolved;
    }

    for (const ref of params.refs) {
        if (!isRecord(payload) || !(ref.id in payload)) {
            throw refError('file', params.providerName, ref.id,
                `Key "${ref.id}" not found in file provider "${params.providerName}".`);
        }
        resolved.set(ref.id, (payload as Record<string, unknown>)[ref.id]);
    }
    return resolved;
}

// ─── EXEC Resolution ──────────────────────────────────────────────

interface ExecRunResult {
    stdout: string;
    stderr: string;
    code: number | null;
    signal: NodeJS.Signals | null;
    termination: 'exit' | 'timeout' | 'no-output-timeout';
}

async function runExecResolver(params: {
    command: string;
    args: string[];
    cwd: string;
    env: NodeJS.ProcessEnv;
    input: string;
    timeoutMs: number;
    noOutputTimeoutMs: number;
    maxOutputBytes: number;
}): Promise<ExecRunResult> {
    return new Promise((resolve, reject) => {
        const child = spawn(params.command, params.args, {
            cwd: params.cwd, env: params.env,
            stdio: ['pipe', 'pipe', 'pipe'], shell: false,
        });

        let settled = false;
        let stdout = '', stderr = '';
        let timedOut = false, noOutputTimedOut = false, outputBytes = 0;
        let noOutputTimer: NodeJS.Timeout | null = null;

        const mainTimer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, params.timeoutMs);

        const clearTimers = () => { clearTimeout(mainTimer); if (noOutputTimer) clearTimeout(noOutputTimer); };

        const armNoOutputTimer = () => {
            if (noOutputTimer) clearTimeout(noOutputTimer);
            noOutputTimer = setTimeout(() => { noOutputTimedOut = true; child.kill('SIGKILL'); }, params.noOutputTimeoutMs);
        };

        const append = (chunk: Buffer | string, target: 'stdout' | 'stderr') => {
            const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
            outputBytes += Buffer.byteLength(text, 'utf8');
            if (outputBytes > params.maxOutputBytes) {
                child.kill('SIGKILL');
                if (!settled) { settled = true; clearTimers(); reject(new Error(`Exec output exceeded maxOutputBytes (${params.maxOutputBytes}).`)); }
                return;
            }
            if (target === 'stdout') stdout += text; else stderr += text;
            armNoOutputTimer();
        };

        armNoOutputTimer();
        child.on('error', (err) => { if (!settled) { settled = true; clearTimers(); reject(err); } });
        child.stdout?.on('data', (chunk: Buffer) => append(chunk, 'stdout'));
        child.stderr?.on('data', (chunk: Buffer) => append(chunk, 'stderr'));
        child.on('close', (code, signal) => {
            if (settled) return;
            settled = true; clearTimers();
            resolve({ stdout, stderr, code, signal, termination: noOutputTimedOut ? 'no-output-timeout' : timedOut ? 'timeout' : 'exit' });
        });

        try { child.stdin?.end(params.input); } catch { /* EPIPE OK */ }
    });
}

async function resolveExecRefs(params: {
    refs: SecretRef[];
    providerName: string;
    providerConfig: ExecSecretProviderConfig;
    env: NodeJS.ProcessEnv;
    limits: ResolutionLimits;
}): Promise<ProviderResolutionOutput> {
    const ids = [...new Set(params.refs.map((r) => r.id))];
    if (ids.length > params.limits.maxRefsPerProvider) {
        throw providerError('exec', params.providerName, `Exceeded maxRefsPerProvider (${params.limits.maxRefsPerProvider}).`);
    }

    const commandPath = path.resolve(params.providerConfig.command);
    const securePath = await assertSecurePath({
        targetPath: commandPath,
        label: `secrets.providers.${params.providerName}.command`,
        allowInsecurePath: params.providerConfig.allowInsecurePath,
        allowSymlinkPath: params.providerConfig.allowSymlinkCommand,
    });

    const input = JSON.stringify({ protocolVersion: 1, provider: params.providerName, ids });
    if (Buffer.byteLength(input, 'utf8') > params.limits.maxBatchBytes) {
        throw providerError('exec', params.providerName, `Request exceeded maxBatchBytes (${params.limits.maxBatchBytes}).`);
    }

    const childEnv: NodeJS.ProcessEnv = {};
    for (const key of params.providerConfig.passEnv ?? []) {
        if (params.env[key] !== undefined) childEnv[key] = params.env[key];
    }
    for (const [key, value] of Object.entries(params.providerConfig.env ?? {})) {
        childEnv[key] = value;
    }

    const timeoutMs = normalizePositiveInt(params.providerConfig.timeoutMs, DEFAULT_EXEC_TIMEOUT_MS);
    const noOutputTimeoutMs = normalizePositiveInt(params.providerConfig.noOutputTimeoutMs, timeoutMs);
    const maxOutputBytes = normalizePositiveInt(params.providerConfig.maxOutputBytes, DEFAULT_EXEC_MAX_OUTPUT_BYTES);

    let result: ExecRunResult;
    try {
        result = await runExecResolver({ command: securePath, args: params.providerConfig.args ?? [], cwd: path.dirname(securePath), env: childEnv, input, timeoutMs, noOutputTimeoutMs, maxOutputBytes });
    } catch (err) { throwUnknown('exec', params.providerName, err); }

    if (result.termination === 'timeout') throw providerError('exec', params.providerName, `Timed out after ${timeoutMs}ms.`);
    if (result.termination === 'no-output-timeout') throw providerError('exec', params.providerName, `No output for ${noOutputTimeoutMs}ms.`);
    if (result.code !== 0) throw providerError('exec', params.providerName, `Exited with code ${result.code}.`);

    const trimmed = result.stdout.trim();
    if (!trimmed) throw providerError('exec', params.providerName, 'Empty stdout.');

    let parsed: unknown;
    const jsonOnly = params.providerConfig.jsonOnly ?? true;
    if (!jsonOnly && ids.length === 1) {
        try { parsed = JSON.parse(trimmed); } catch { return new Map([[ids[0], trimmed]]); }
    } else {
        try { parsed = JSON.parse(trimmed); } catch { throw providerError('exec', params.providerName, 'Invalid JSON output.'); }
    }

    if (!isRecord(parsed)) {
        if (!jsonOnly && ids.length === 1 && typeof parsed === 'string') return new Map([[ids[0], parsed]]);
        throw providerError('exec', params.providerName, 'Response must be an object.');
    }

    const values = parsed.values;
    if (!isRecord(values)) throw providerError('exec', params.providerName, 'Response missing "values".');

    const errors = isRecord(parsed.errors) ? parsed.errors : null;
    const resolved = new Map<string, unknown>();
    for (const id of ids) {
        if (errors && id in errors) {
            const entry = errors[id];
            const msg = isRecord(entry) && typeof entry.message === 'string' ? entry.message.trim() : '';
            throw refError('exec', params.providerName, id, msg || `Failed for id "${id}".`);
        }
        if (!(id in values)) throw refError('exec', params.providerName, id, `Response missing id "${id}".`);
        resolved.set(id, values[id]);
    }
    return resolved;
}

// ─── Main Orchestrator ────────────────────────────────────────────

function resolveConfiguredProvider(ref: SecretRef, config: Record<string, unknown>): SecretProviderConfig {
    const secrets = config.secrets as Record<string, unknown> | undefined;
    const providers = secrets?.providers as Record<string, SecretProviderConfig> | undefined;
    const providerConfig = providers?.[ref.provider];

    if (!providerConfig) {
        if (ref.source === 'env' && ref.provider === resolveDefaultSecretProviderAlias(config, 'env')) {
            return { source: 'env' };
        }
        throw providerError(ref.source, ref.provider, `Secret provider "${ref.provider}" is not configured.`);
    }
    if (providerConfig.source !== ref.source) {
        throw providerError(ref.source, ref.provider, `Provider "${ref.provider}" has source "${providerConfig.source}" but ref requests "${ref.source}".`);
    }
    return providerConfig;
}

function resolveResolutionLimits(config: Record<string, unknown>): ResolutionLimits {
    const secrets = config.secrets as Record<string, unknown> | undefined;
    const resolution = secrets?.resolution as Record<string, unknown> | undefined;
    return {
        maxProviderConcurrency: normalizePositiveInt(resolution?.maxProviderConcurrency, DEFAULT_PROVIDER_CONCURRENCY),
        maxRefsPerProvider: normalizePositiveInt(resolution?.maxRefsPerProvider, DEFAULT_MAX_REFS_PER_PROVIDER),
        maxBatchBytes: normalizePositiveInt(resolution?.maxBatchBytes, DEFAULT_MAX_BATCH_BYTES),
    };
}

/**
 * Resolve a batch of secret references.
 * Groups refs by provider, resolves with concurrency limits.
 */
export async function resolveSecretRefs(
    refs: SecretRef[],
    options: ResolveSecretRefOptions,
): Promise<Map<string, unknown>> {
    if (refs.length === 0) return new Map();

    const limits = resolveResolutionLimits(options.config);
    const env = options.env ?? process.env;

    // Group refs by provider
    const grouped = new Map<string, { source: SecretRefSource; providerName: string; config: SecretProviderConfig; refs: SecretRef[] }>();
    for (const ref of refs) {
        const key = `${ref.source}:${ref.provider}`;
        if (!grouped.has(key)) {
            const providerConfig = resolveConfiguredProvider(ref, options.config);
            grouped.set(key, { source: ref.source, providerName: ref.provider, config: providerConfig, refs: [] });
        }
        grouped.get(key)!.refs.push(ref);
    }

    // Resolve providers with concurrency
    const allResolved = new Map<string, unknown>();
    const tasks = [...grouped.values()].map((group) => async () => {
        let output: ProviderResolutionOutput;
        if (group.config.source === 'env') {
            output = await resolveEnvRefs({ refs: group.refs, providerName: group.providerName, providerConfig: group.config, env });
        } else if (group.config.source === 'file') {
            output = await resolveFileRefs({ refs: group.refs, providerName: group.providerName, providerConfig: group.config as FileSecretProviderConfig, cache: options.cache });
        } else {
            output = await resolveExecRefs({ refs: group.refs, providerName: group.providerName, providerConfig: group.config as ExecSecretProviderConfig, env, limits });
        }
        for (const [id, value] of output) {
            allResolved.set(secretRefKey({ source: group.source, provider: group.providerName, id }), value);
        }
    });

    // Simple concurrency limiter
    const concurrency = limits.maxProviderConcurrency;
    for (let i = 0; i < tasks.length; i += concurrency) {
        await Promise.all(tasks.slice(i, i + concurrency).map((t) => t()));
    }

    return allResolved;
}
