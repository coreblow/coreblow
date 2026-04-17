/**
 * src/sandbox/sandbox-security.ts
 *
 * Layer 2 Extension: Sandbox Security Policy
 *
 * Pre-execution security checks for sandbox code — scans for dangerous
 * patterns before code reaches the SandboxExecutor or DockerSandbox.
 */

import { findDangerousPattern, isValidMathExpression } from '../security/input-sanitizer.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('sandbox:security');

// ─── Types ──────────────────────────────────────────────────────

export interface SandboxSecurityConfig {
    /** Max code length (bytes) */
    maxCodeLength: number;
    /** Max execution timeout (ms) */
    maxTimeoutMs: number;
    /** Max memory limit (MB) */
    maxMemoryMb: number;
    /** Block network access in sandbox */
    blockNetwork: boolean;
    /** Additional blocked patterns */
    blockedPatterns: string[];
}

export interface SecurityCheckResult {
    allowed: boolean;
    reason?: string;
    blockedPattern?: string;
}

// ─── Defaults ───────────────────────────────────────────────────

const DEFAULT_CONFIG: SandboxSecurityConfig = {
    maxCodeLength: 100_000,  // 100KB
    maxTimeoutMs: 60_000,    // 60s
    maxMemoryMb: 512,
    blockNetwork: true,
    blockedPatterns: [
        'process.exit',
        'process.kill',
        'process.env',
        'require("child_process")',
        "require('child_process')",
        'require("fs")',
        "require('fs')",
        'require("net")',
        "require('net')",
        'require("http")',
        "require('http')",
        'import(',
        '__proto__',
        'constructor.constructor',
        'Reflect.construct',
    ],
};

// ─── SandboxSecurityPolicy ──────────────────────────────────────

/**
 * Pre-execution security policy for sandbox environments.
 * Scans code for dangerous patterns and validates resource limits.
 */
export class SandboxSecurityPolicy {
    private readonly config: SandboxSecurityConfig;

    constructor(config?: Partial<SandboxSecurityConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Check if code is safe to execute in sandbox.
     */
    checkCode(code: string): SecurityCheckResult {
        // Length check
        if (code.length > this.config.maxCodeLength) {
            return { allowed: false, reason: `Code exceeds max length (${this.config.maxCodeLength} bytes)` };
        }

        // Check for dangerous patterns from input-sanitizer
        const dangerousPattern = findDangerousPattern(code);
        if (dangerousPattern) {
            log.warn({ pattern: dangerousPattern }, 'Blocked dangerous pattern in sandbox code');
            return { allowed: false, reason: 'Dangerous pattern detected', blockedPattern: dangerousPattern };
        }

        // Check custom blocked patterns
        for (const pattern of this.config.blockedPatterns) {
            if (code.includes(pattern)) {
                log.warn({ pattern }, 'Blocked custom pattern in sandbox code');
                return { allowed: false, reason: 'Blocked pattern detected', blockedPattern: pattern };
            }
        }

        return { allowed: true };
    }

    /**
     * Validate resource limit configuration.
     */
    validateLimits(timeoutMs?: number, memoryMb?: number): SecurityCheckResult {
        if (timeoutMs !== undefined && timeoutMs > this.config.maxTimeoutMs) {
            return { allowed: false, reason: `Timeout ${timeoutMs}ms exceeds max ${this.config.maxTimeoutMs}ms` };
        }

        if (memoryMb !== undefined && memoryMb > this.config.maxMemoryMb) {
            return { allowed: false, reason: `Memory ${memoryMb}MB exceeds max ${this.config.maxMemoryMb}MB` };
        }

        if (timeoutMs !== undefined && timeoutMs < 100) {
            return { allowed: false, reason: 'Timeout too low (min 100ms)' };
        }

        return { allowed: true };
    }

    /**
     * Validate a shell command for sandbox execution.
     */
    checkCommand(command: string): SecurityCheckResult {
        if (!command.trim()) {
            return { allowed: false, reason: 'Empty command' };
        }

        if (command.length > 10_000) {
            return { allowed: false, reason: 'Command too long' };
        }

        // Check for shell escape attempts
        const shellEscapes = ['$(', '`', '&&', '||', ';', '|', '>', '>>', '<'];
        for (const escape of shellEscapes) {
            // Only block chained commands, not simple pipes/redirects with known commands
            if (command.includes(escape) && (command.includes('rm ') || command.includes('sudo') || command.includes('chmod'))) {
                return { allowed: false, reason: 'Dangerous shell pattern detected', blockedPattern: escape };
            }
        }

        return { allowed: true };
    }

    /**
     * Get the current security config.
     */
    getConfig(): Readonly<SandboxSecurityConfig> {
        return this.config;
    }
}
