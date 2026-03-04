/**
 * src/gateway/health.ts
 * Health check endpoint
 */

import type { Request, Response } from 'express';
import { getConfig } from './config.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('health');
const startedAt = Date.now();

export interface HealthStatus {
    status: 'ok' | 'degraded';
    version: string;
    uptime: number;
    uptimeHuman: string;
    host: string;
    port: number;
    agent: {
        model: string;
        provider: string;
    };
    channels: Record<string, boolean>;
    features: Record<string, boolean>;
}

export function healthHandler(_req: Request, res: Response) {
    const config = getConfig();
    const uptimeMs = Date.now() - startedAt;

    const status: HealthStatus = {
        status: 'ok',
        version: '1.0.0',
        uptime: uptimeMs,
        uptimeHuman: formatUptime(uptimeMs),
        host: config.host,
        port: config.port,
        agent: {
            model: config.agent.model,
            provider: config.agent.provider,
        },
        channels: {
            telegram: !!config.channels.telegram?.token,
            discord: !!config.channels.discord?.token,
            webchat: config.channels.webchat?.enabled ?? false,
        },
        features: config.features,
    };

    res.json(status);
}

function formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (mins > 0) parts.push(`${mins}m`);
    parts.push(`${secs}s`);
    return parts.join(' ');
}
