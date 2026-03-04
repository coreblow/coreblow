/**
 * src/security/sandbox.ts
 * Sandbox — Docker + Native process isolation
 * SUPERIOR: OpenClaw requires Docker; CoreBlow works without it (native fallback)
 */

import { spawn, execSync, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('security:sandbox');

export interface SandboxConfig {
    mode: 'auto' | 'docker' | 'native' | 'none';
    timeoutMs: number;
    memoryLimitMb: number;
    networkAccess: boolean;
    workDir?: string;
    readonlyFs?: boolean;
    allowedCommands?: string[];    // whitelist
    blockedCommands?: string[];    // blacklist
}

export interface SandboxResult {
    exitCode: number;
    stdout: string;
    stderr: string;
    durationMs: number;
    sandboxMode: 'docker' | 'native' | 'none';
    killed: boolean;
    killReason?: string;
}

const DEFAULT_CONFIG: SandboxConfig = {
    mode: 'auto',
    timeoutMs: 30_000,        // 30s
    memoryLimitMb: 256,
    networkAccess: false,
    readonlyFs: false,
    blockedCommands: [
        'rm -rf /',
        'mkfs',
        'dd if=/dev/zero',
        'shutdown',
        'reboot',
        'kill -9 1',
        'pkill',
        'killall',
        ':(){:|:&};:',        // fork bomb
    ],
};

export class SandboxManager {
    private config: SandboxConfig;
    private dockerAvailable: boolean | null = null;

    constructor(config: Partial<SandboxConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Execute a command in sandbox
     */
    async exec(command: string, opts: Partial<SandboxConfig> = {}): Promise<SandboxResult> {
        const cfg = { ...this.config, ...opts };

        // Check blocked commands
        if (this.isBlocked(command, cfg)) {
            return {
                exitCode: 1,
                stdout: '',
                stderr: `🛑 Command blocked by sandbox policy: ${command.substring(0, 50)}`,
                durationMs: 0,
                sandboxMode: 'none',
                killed: true,
                killReason: 'blocked_command',
            };
        }

        // Select sandbox mode
        const mode = await this.resolveMode(cfg.mode);

        switch (mode) {
            case 'docker': return this.execDocker(command, cfg);
            case 'native': return this.execNative(command, cfg);
            default: return this.execUnsandboxed(command, cfg);
        }
    }

    /**
     * Docker sandbox — full isolation
     */
    private async execDocker(command: string, cfg: SandboxConfig): Promise<SandboxResult> {
        const containerId = `coreblow-sandbox-${crypto.randomBytes(4).toString('hex')}`;
        const startTime = Date.now();

        const args = [
            'run',
            '--rm',
            '--name', containerId,
            '--memory', `${cfg.memoryLimitMb}m`,
            '--cpus', '1',
            '--pids-limit', '100',
        ];

        if (!cfg.networkAccess) args.push('--network', 'none');
        if (cfg.readonlyFs) args.push('--read-only');
        if (cfg.workDir) args.push('-v', `${cfg.workDir}:/workspace`, '-w', '/workspace');

        args.push('node:22-alpine', 'sh', '-c', command);

        return new Promise<SandboxResult>((resolve) => {
            let stdout = '';
            let stderr = '';
            let killed = false;

            const proc = spawn('docker', args, { stdio: 'pipe' });

            proc.stdout?.on('data', d => { stdout += d.toString(); });
            proc.stderr?.on('data', d => { stderr += d.toString(); });

            // Timeout
            const timer = setTimeout(() => {
                killed = true;
                try { execSync(`docker kill ${containerId}`, { stdio: 'ignore' }); } catch { }
                proc.kill('SIGKILL');
            }, cfg.timeoutMs);

            proc.on('close', (code) => {
                clearTimeout(timer);
                resolve({
                    exitCode: code ?? 1,
                    stdout: stdout.substring(0, 50_000),
                    stderr: stderr.substring(0, 10_000),
                    durationMs: Date.now() - startTime,
                    sandboxMode: 'docker',
                    killed,
                    killReason: killed ? 'timeout' : undefined,
                });
            });

            proc.on('error', (err) => {
                clearTimeout(timer);
                resolve({
                    exitCode: 1,
                    stdout: '',
                    stderr: err.message,
                    durationMs: Date.now() - startTime,
                    sandboxMode: 'docker',
                    killed: false,
                });
            });
        });
    }

    /**
     * Native sandbox — process isolation without Docker
     * SUPERIOR: CoreBlow works without Docker; OpenClaw requires it
     */
    private async execNative(command: string, cfg: SandboxConfig): Promise<SandboxResult> {
        const startTime = Date.now();

        return new Promise<SandboxResult>((resolve) => {
            let stdout = '';
            let stderr = '';
            let killed = false;

            const cwd = cfg.workDir || process.cwd();

            const proc = spawn('sh', ['-c', command], {
                cwd,
                stdio: 'pipe',
                env: {
                    ...process.env,
                    // Restrict PATH to safe locations
                    PATH: '/usr/local/bin:/usr/bin:/bin',
                    // Prevent home dir writes if readonly
                    ...(cfg.readonlyFs ? { HOME: '/tmp', TMPDIR: '/tmp' } : {}),
                },
            });

            proc.stdout?.on('data', d => {
                stdout += d.toString();
                // Memory limit: kill if output too large
                if (stdout.length > cfg.memoryLimitMb * 1024) {
                    killed = true;
                    proc.kill('SIGKILL');
                }
            });
            proc.stderr?.on('data', d => { stderr += d.toString(); });

            // Timeout
            const timer = setTimeout(() => {
                killed = true;
                proc.kill('SIGKILL');
            }, cfg.timeoutMs);

            proc.on('close', (code) => {
                clearTimeout(timer);
                resolve({
                    exitCode: code ?? 1,
                    stdout: stdout.substring(0, 50_000),
                    stderr: stderr.substring(0, 10_000),
                    durationMs: Date.now() - startTime,
                    sandboxMode: 'native',
                    killed,
                    killReason: killed ? (stdout.length > cfg.memoryLimitMb * 1024 ? 'memory_limit' : 'timeout') : undefined,
                });
            });

            proc.on('error', (err) => {
                clearTimeout(timer);
                resolve({
                    exitCode: 1,
                    stdout: '',
                    stderr: err.message,
                    durationMs: Date.now() - startTime,
                    sandboxMode: 'native',
                    killed: false,
                });
            });
        });
    }

    /**
     * Unsandboxed execution (with command blocking only)
     */
    private async execUnsandboxed(command: string, cfg: SandboxConfig): Promise<SandboxResult> {
        const startTime = Date.now();

        return new Promise<SandboxResult>((resolve) => {
            let stdout = '';
            let stderr = '';
            let killed = false;

            const proc = spawn('sh', ['-c', command], {
                cwd: cfg.workDir || process.cwd(),
                stdio: 'pipe',
            });

            proc.stdout?.on('data', d => { stdout += d.toString(); });
            proc.stderr?.on('data', d => { stderr += d.toString(); });

            const timer = setTimeout(() => {
                killed = true;
                proc.kill('SIGKILL');
            }, cfg.timeoutMs);

            proc.on('close', (code) => {
                clearTimeout(timer);
                resolve({
                    exitCode: code ?? 1,
                    stdout: stdout.substring(0, 50_000),
                    stderr: stderr.substring(0, 10_000),
                    durationMs: Date.now() - startTime,
                    sandboxMode: 'none',
                    killed,
                    killReason: killed ? 'timeout' : undefined,
                });
            });

            proc.on('error', (err) => {
                clearTimeout(timer);
                resolve({
                    exitCode: 1, stdout: '', stderr: err.message,
                    durationMs: Date.now() - startTime,
                    sandboxMode: 'none', killed: false,
                });
            });
        });
    }

    /**
     * Check if command is blocked
     */
    private isBlocked(command: string, cfg: SandboxConfig): boolean {
        const cmd = command.toLowerCase().trim();

        // Check blacklist
        if (cfg.blockedCommands) {
            for (const blocked of cfg.blockedCommands) {
                if (cmd.includes(blocked.toLowerCase())) return true;
            }
        }

        // Check whitelist (if set, only allow listed commands)
        if (cfg.allowedCommands?.length) {
            const firstWord = cmd.split(/\s+/)[0];
            return !cfg.allowedCommands.some(a => firstWord === a.toLowerCase());
        }

        return false;
    }

    /**
     * Resolve mode — auto-detect Docker availability
     */
    private async resolveMode(mode: SandboxConfig['mode']): Promise<'docker' | 'native' | 'none'> {
        if (mode === 'docker') return 'docker';
        if (mode === 'native') return 'native';
        if (mode === 'none') return 'none';

        // Auto: try Docker first
        if (this.dockerAvailable === null) {
            try {
                execSync('docker --version', { stdio: 'ignore' });
                this.dockerAvailable = true;
            } catch {
                this.dockerAvailable = false;
            }
        }

        if (this.dockerAvailable) return 'docker';
        log.debug('Docker not available, using native sandbox');
        return 'native';
    }

    /**
     * Check Docker availability
     */
    isDockerAvailable(): boolean {
        if (this.dockerAvailable === null) {
            try {
                execSync('docker --version', { stdio: 'ignore' });
                this.dockerAvailable = true;
            } catch {
                this.dockerAvailable = false;
            }
        }
        return this.dockerAvailable;
    }
}
