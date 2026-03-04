/**
 * src/tools/nodes.ts
 * Nodes tool — device capabilities (screenshot, camera, location, clipboard, notifications)
 * Designed for paired devices to expose their native capabilities
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { ToolHandler } from './types.js';
import { getHomeDir } from '../gateway/config.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('tool:nodes');

export const nodesTool: ToolHandler = {
    name: 'nodes',
    description: 'Access device capabilities: take screenshots, capture camera, get location, read clipboard, send notifications. Works on macOS natively, other platforms via paired devices.',
    parameters: {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['screenshot', 'clipboard_read', 'clipboard_write', 'notify', 'system_info', 'open_url'],
                description: 'Device action to perform',
            },
            text: {
                type: 'string',
                description: 'Text content (for clipboard_write, notify)',
            },
            title: {
                type: 'string',
                description: 'Notification title (for notify)',
            },
            url: {
                type: 'string',
                description: 'URL to open (for open_url)',
            },
        },
        required: ['action'],
    },

    async execute(args: Record<string, any>): Promise<string> {
        const { action, text, title, url } = args;
        const platform = process.platform;

        switch (action) {
            case 'screenshot': {
                if (platform !== 'darwin') return 'Screenshot only supported on macOS currently';
                const mediaDir = path.join(getHomeDir(), 'media');
                fs.mkdirSync(mediaDir, { recursive: true });
                const filename = `screenshot-${Date.now()}.png`;
                const filepath = path.join(mediaDir, filename);
                try {
                    execSync(`screencapture -x -C ${filepath}`, { timeout: 5000 });
                    const stat = fs.statSync(filepath);
                    log.info({ filepath, size: stat.size }, 'Screenshot captured');
                    return `Screenshot saved: ${filepath} (${Math.round(stat.size / 1024)}KB)`;
                } catch (err: any) {
                    return `Screenshot failed: ${err.message}`;
                }
            }

            case 'clipboard_read': {
                try {
                    if (platform === 'darwin') {
                        const content = execSync('pbpaste', { timeout: 3000, encoding: 'utf-8' });
                        return content || '(clipboard is empty)';
                    }
                    return 'Clipboard read not supported on this platform';
                } catch (err: any) {
                    return `Clipboard read failed: ${err.message}`;
                }
            }

            case 'clipboard_write': {
                if (!text) return 'Error: text is required';
                try {
                    if (platform === 'darwin') {
                        execSync(`echo ${JSON.stringify(text)} | pbcopy`, { timeout: 3000 });
                        return `Copied to clipboard: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`;
                    }
                    return 'Clipboard write not supported on this platform';
                } catch (err: any) {
                    return `Clipboard write failed: ${err.message}`;
                }
            }

            case 'notify': {
                const msg = text || 'CoreBlow notification';
                const ttl = title || 'CoreBlow';
                try {
                    if (platform === 'darwin') {
                        execSync(`osascript -e 'display notification "${msg}" with title "${ttl}"'`, { timeout: 3000 });
                        return `Notification sent: "${ttl}: ${msg}"`;
                    }
                    return 'Notifications not supported on this platform';
                } catch (err: any) {
                    return `Notification failed: ${err.message}`;
                }
            }

            case 'system_info': {
                const info: Record<string, string> = {
                    platform,
                    arch: process.arch,
                    nodeVersion: process.version,
                    hostname: require('node:os').hostname(),
                    uptime: `${Math.round(require('node:os').uptime() / 3600)}h`,
                    cpus: `${require('node:os').cpus().length} cores`,
                    memory: `${Math.round(require('node:os').totalmem() / 1024 / 1024 / 1024)}GB total, ${Math.round(require('node:os').freemem() / 1024 / 1024 / 1024)}GB free`,
                };
                return Object.entries(info).map(([k, v]) => `${k}: ${v}`).join('\n');
            }

            case 'open_url': {
                if (!url) return 'Error: url is required';
                try {
                    if (platform === 'darwin') {
                        execSync(`open "${url}"`, { timeout: 3000 });
                    } else if (platform === 'linux') {
                        execSync(`xdg-open "${url}"`, { timeout: 3000 });
                    }
                    return `Opened: ${url}`;
                } catch (err: any) {
                    return `Failed to open URL: ${err.message}`;
                }
            }

            default:
                return 'Unknown action. Use: screenshot, clipboard_read, clipboard_write, notify, system_info, open_url';
        }
    },
};
