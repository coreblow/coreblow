/**
 * utils/logger.ts
 * Structured logging pipeline with module-scoped loggers, redaction, and correlation.
 * Upgraded from 26 LOC to full CoreBlow-pattern pipeline.
 */

import { pino } from 'pino';
import type { Logger as PinoLogger, TransportSingleOptions } from 'pino';

// ─── Configuration ────────────────────────────────────────────────

const isDev = process.env.NODE_ENV !== 'production';
const isVitest = process.env.VITEST === 'true';
const explicitLogLevel = process.env.LOG_LEVEL?.trim();
const LOG_LEVEL = explicitLogLevel || (isVitest ? 'silent' : isDev ? 'debug' : 'info');
const LOG_FILE = process.env.LOG_FILE;
const LOG_FORMAT = process.env.LOG_FORMAT || (isDev ? 'pretty' : 'json');

// ─── Redaction Paths ──────────────────────────────────────────────
// Fields at these paths will be replaced with [REDACTED] in log output.
// Follows CoreBlow's redactPatterns convention.

const REDACTION_PATHS = [
    'token', 'password', 'secret', 'apiKey', 'appPassword',
    'authorization', 'cookie', 'privateKey', 'signingKey',
    'clientSecret', 'accessKey', 'secretAccessKey',
    'config.gateway.auth.token',
    'config.gateway.auth.password',
    'config.channels.discord.token',
    'config.channels.telegram.token',
    'config.channels.slack.token',
    'config.channels.signal.password',
    'config.channels.gmail.appPassword',
    '*.token', '*.password', '*.secret', '*.apiKey',
];

// ─── Transport Configuration ──────────────────────────────────────

function buildTransports(): Record<string, unknown> | undefined {
    if (LOG_LEVEL === 'silent' && !LOG_FILE) {
        return undefined;
    }

    const targets: Array<Record<string, unknown>> = [];

    if (LOG_FORMAT === 'pretty' || isDev) {
        targets.push({
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'HH:MM:ss',
                ignore: 'pid,hostname',
                singleLine: false,
            },
            level: LOG_LEVEL,
        });
    } else {
        // JSON stdout for production (12-factor compatible)
        targets.push({
            target: 'pino/file',
            options: { destination: 1 }, // stdout
            level: LOG_LEVEL,
        });
    }

    // Optional file transport
    if (LOG_FILE) {
        targets.push({
            target: 'pino/file',
            options: {
                destination: LOG_FILE,
                mkdir: true,
            },
            level: LOG_LEVEL,
        });
    }

    if (targets.length === 1) {
        return targets[0];
    }

    return { targets };
}

// ─── Root Logger ──────────────────────────────────────────────────

const transportConfig = buildTransports();

export const logger: PinoLogger = pino({
    level: LOG_LEVEL,
    redact: {
        paths: REDACTION_PATHS,
        censor: '[REDACTED]',
    },
    serializers: {
        err: (err: unknown) => err instanceof Error ? { type: err.name, message: err.message, stack: err.stack } : err,
    },
    base: {
        service: 'coreblow-gateway',
        ...(process.env.COREBLOW_INSTANCE_ID ? { instance: process.env.COREBLOW_INSTANCE_ID } : {}),
    },
    timestamp: () => `,"time":"${new Date().toISOString()}"`,
    transport: transportConfig as unknown as TransportSingleOptions | undefined,
});

// ─── Module Logger Factory ────────────────────────────────────────

const childLoggerCache = new Map<string, PinoLogger>();

/**
 * Create a child logger scoped to a module.
 * Uses caching to avoid creating duplicate loggers.
 */
export function createChildLogger(module: string): PinoLogger {
    if (childLoggerCache.has(module)) {
        return childLoggerCache.get(module)!;
    }
    const child = logger.child({ module });
    childLoggerCache.set(module, child);
    return child;
}

/**
 * Create a request-scoped logger with correlation ID.
 */
export function createRequestLogger(opts: {
    module: string;
    requestId?: string;
    sessionId?: string;
    channel?: string;
}): PinoLogger {
    const bindings: Record<string, string> = { module: opts.module };
    if (opts.requestId) bindings.requestId = opts.requestId;
    if (opts.sessionId) bindings.sessionId = opts.sessionId;
    if (opts.channel) bindings.channel = opts.channel;
    return logger.child(bindings);
}

/**
 * Create a turn-scoped logger for agent interactions.
 */
export function createTurnLogger(opts: {
    sessionId: string;
    turnId: string;
    agentId?: string;
}): PinoLogger {
    return logger.child({
        module: 'turn',
        sessionId: opts.sessionId,
        turnId: opts.turnId,
        ...(opts.agentId ? { agentId: opts.agentId } : {}),
    });
}

// ─── Utility Functions ────────────────────────────────────────────

/**
 * Set the log level at runtime.
 */
export function setLogLevel(level: string): void {
    logger.level = level;
}

/**
 * Get the current log level.
 */
export function getLogLevel(): string {
    return logger.level;
}

/**
 * Flush all pending log writes (for graceful shutdown).
 */
export function flushLogs(): Promise<void> {
    return new Promise((resolve) => {
        logger.flush();
        // pino flush is synchronous for most transports
        setTimeout(resolve, 100);
    });
}
