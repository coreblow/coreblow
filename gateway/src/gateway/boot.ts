/**
 * CoreBlow — Gateway Boot Agent
 *
 * Runs BOOT.md instructions on gateway startup using the agent system.
 * This allows automated startup tasks (e.g., "send a test message",
 * "check health of external services") without human intervention.
 *
 * Follows OpenClaw's boot.ts pattern:
 *   1. Load BOOT.md from workspace directory
 *   2. Snapshot main session mapping (to restore after boot)
 *   3. Run agent command with boot prompt
 *   4. Restore session mapping
 *   5. Return BootRunResult
 *
 * If BOOT.md doesn't exist or is empty, boot is skipped (non-destructive).
 *
 * @packageDocumentation
 */

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createSubsystemLogger } from '../logging/subsystem.js';

// ─── Types ───────────────────────────────────────────────────────

export type BootRunResult =
    | { status: 'skipped'; reason: 'missing' | 'empty' }
    | { status: 'ran' }
    | { status: 'failed'; reason: string };

// ─── Constants ───────────────────────────────────────────────────

const BOOT_FILENAME = 'BOOT.md';
const SILENT_REPLY_TOKEN = '<|SILENT|>';
const log = createSubsystemLogger('gateway/boot');

// ─── Helpers ─────────────────────────────────────────────────────

function generateBootSessionId(): string {
    const now = new Date();
    const ts = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '');
    const suffix = crypto.randomUUID().slice(0, 8);
    return `boot-${ts}-${suffix}`;
}

function buildBootPrompt(content: string): string {
    return [
        'You are running a boot check. Follow BOOT.md instructions exactly.',
        '',
        'BOOT.md:',
        content,
        '',
        'If BOOT.md asks you to send a message, use the message tool (action=send with channel + target).',
        'Use the `target` field (not `to`) for message tool destinations.',
        `After sending with the message tool, reply with ONLY: ${SILENT_REPLY_TOKEN}.`,
        `If nothing needs attention, reply with ONLY: ${SILENT_REPLY_TOKEN}.`,
    ].join('\n');
}

async function loadBootFile(
    workspaceDir: string,
): Promise<{ content?: string; status: 'ok' | 'missing' | 'empty' }> {
    const bootPath = path.join(workspaceDir, BOOT_FILENAME);
    try {
        const content = await fs.readFile(bootPath, 'utf-8');
        const trimmed = content.trim();
        if (!trimmed) {
            return { status: 'empty' };
        }
        return { status: 'ok', content: trimmed };
    } catch (err) {
        const anyErr = err as { code?: string };
        if (anyErr.code === 'ENOENT') {
            return { status: 'missing' };
        }
        throw err;
    }
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Run BOOT.md instructions once during gateway startup.
 *
 * This function is non-destructive:
 * - If BOOT.md doesn't exist → returns { status: 'skipped', reason: 'missing' }
 * - If BOOT.md is empty → returns { status: 'skipped', reason: 'empty' }
 * - If agent run succeeds → returns { status: 'ran' }
 * - If agent run fails → returns { status: 'failed', reason: '...' }
 */
export async function runBootOnce(params: {
    workspaceDir: string;
    agentId?: string;
    agentCommand?: (opts: {
        message: string;
        sessionId: string;
    }) => Promise<void>;
}): Promise<BootRunResult> {
    let result: Awaited<ReturnType<typeof loadBootFile>>;
    try {
        result = await loadBootFile(params.workspaceDir);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.error(`boot: failed to read ${BOOT_FILENAME}: ${message}`);
        return { status: 'failed', reason: message };
    }

    if (result.status === 'missing' || result.status === 'empty') {
        return { status: 'skipped', reason: result.status };
    }

    const message = buildBootPrompt(result.content ?? '');
    const sessionId = generateBootSessionId();

    if (!params.agentCommand) {
        log.warn('boot: no agentCommand provided, skipping boot agent run');
        return { status: 'skipped', reason: 'missing' };
    }

    try {
        await params.agentCommand({ message, sessionId });
    } catch (err) {
        const failure = err instanceof Error ? err.message : String(err);
        log.error(`boot: agent run failed: ${failure}`);
        return { status: 'failed', reason: `agent run failed: ${failure}` };
    }

    return { status: 'ran' };
}

export const __testing = {
    buildBootPrompt,
    generateBootSessionId,
    loadBootFile,
};
