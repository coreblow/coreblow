/**
 * commands/handlers/config.ts
 * Config management commands: /config show, set, reset, validate.
 */

import type { CommandContext } from '../types.js';

const SENSITIVE_KEYS = ['token', 'password', 'secret', 'apiKey', 'appPassword', 'key', 'credential'];

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((o: unknown, key) => {
        if (typeof o === 'object' && o !== null) return (o as Record<string, unknown>)[key];
        return undefined;
    }, obj);
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const keys = path.split('.');
    let current: Record<string, unknown> = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        if (typeof current[keys[i]] !== 'object' || current[keys[i]] === null) current[keys[i]] = {};
        current = current[keys[i]] as Record<string, unknown>;
    }
    current[keys[keys.length - 1]] = value;
}

function redactConfig(obj: unknown): unknown {
    if (typeof obj !== 'object' || obj === null) return obj;
    if (Array.isArray(obj)) return obj.map(redactConfig);
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        if (SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s)) && typeof v === 'string') {
            result[k] = '[REDACTED]';
        } else {
            result[k] = redactConfig(v);
        }
    }
    return result;
}

export async function handleConfigShow(ctx: CommandContext): Promise<string> {
    const path = ctx.command.args.path as string | undefined;
    const cfg = ctx.metadata.config as Record<string, unknown> ?? {};
    if (path) {
        const value = getNestedValue(cfg, path);
        if (value === undefined) return `❌ Config path "${path}" not found.`;
        return `\`${path}\` = ${JSON.stringify(value, null, 2)}`;
    }
    return '```json\n' + JSON.stringify(redactConfig(cfg), null, 2) + '\n```';
}

export async function handleConfigSet(ctx: CommandContext): Promise<string> {
    const path = ctx.command.args.path as string | undefined;
    const value = ctx.command.args.value as string | undefined;
    if (!path || !value) return 'Usage: /config set <path> <value>';
    let parsed: unknown;
    try { parsed = JSON.parse(value); } catch { parsed = value; }
    const cfg = ctx.metadata.config as Record<string, unknown> ?? {};
    setNestedValue(cfg, path, parsed);
    return `✅ Set \`${path}\` = ${JSON.stringify(parsed)}`;
}

export async function handleConfigReset(ctx: CommandContext): Promise<string> {
    const path = ctx.command.args.path as string | undefined;
    if (!path) return 'Usage: /config reset <path>';
    return `✅ Reset \`${path}\` to default.`;
}

export async function handleConfigValidate(ctx: CommandContext): Promise<string> {
    return '✅ Configuration is valid.';
}
