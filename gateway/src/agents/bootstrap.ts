/**
 * src/agents/bootstrap.ts
 * Bootstrap file loader — builds system prompt from workspace markdown files
 */

import fs from 'node:fs';
import path from 'node:path';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('bootstrap');

const BOOTSTRAP_FILES = [
    { file: 'AGENTS.md', label: 'Operating Instructions & Memory' },
    { file: 'SOUL.md', label: 'Persona & Boundaries' },
    { file: 'TOOLS.md', label: 'Tool Usage Notes' },
    { file: 'IDENTITY.md', label: 'Agent Identity' },
    { file: 'USER.md', label: 'User Profile' },
];

export class AgentBootstrap {
    /**
     * Load system prompt from workspace bootstrap files
     */
    async loadSystemPrompt(workspace: string, agentName = 'CoreBlow'): Promise<string> {
        const parts: string[] = [];

        // Core identity
        parts.push(
            `You are ${agentName}, an AI assistant powered by the CoreBlow Gateway.`,
            `Current date and time: ${new Date().toISOString()}`,
            ''
        );

        // Load bootstrap files
        for (const { file, label } of BOOTSTRAP_FILES) {
            const filePath = path.join(workspace, file);
            try {
                if (fs.existsSync(filePath)) {
                    const content = fs.readFileSync(filePath, 'utf-8').trim();
                    if (content) {
                        parts.push(`--- ${label} (${file}) ---`);
                        parts.push(content);
                        parts.push('');
                        log.debug({ file }, 'Loaded bootstrap file');
                    }
                }
            } catch (err) {
                log.warn({ file, err }, 'Failed to read bootstrap file');
            }
        }

        // One-time BOOTSTRAP.md — deleted after first load
        const bootstrapPath = path.join(workspace, 'BOOTSTRAP.md');
        try {
            if (fs.existsSync(bootstrapPath)) {
                const content = fs.readFileSync(bootstrapPath, 'utf-8').trim();
                if (content) {
                    parts.push('--- One-Time Bootstrap Instructions ---');
                    parts.push(content);
                    parts.push('');
                    // Delete after first run
                    fs.unlinkSync(bootstrapPath);
                    log.info('BOOTSTRAP.md processed and removed');
                }
            }
        } catch (err) {
            log.warn({ err }, 'Failed to process BOOTSTRAP.md');
        }

        return parts.join('\n');
    }

    /**
     * Ensure workspace directory exists with starter files
     */
    async initWorkspace(workspace: string) {
        fs.mkdirSync(workspace, { recursive: true });

        const agentsMd = path.join(workspace, 'AGENTS.md');
        if (!fs.existsSync(agentsMd)) {
            fs.writeFileSync(
                agentsMd,
                [
                    '# Agent Instructions',
                    '',
                    'You are a helpful AI assistant. Be concise, accurate, and friendly.',
                    '',
                    '## Memory',
                    '',
                    '<!-- The agent will update this section with important things to remember -->',
                    '',
                ].join('\n')
            );
            log.info({ workspace }, 'Created starter AGENTS.md');
        }

        const identityMd = path.join(workspace, 'IDENTITY.md');
        if (!fs.existsSync(identityMd)) {
            fs.writeFileSync(
                identityMd,
                ['# Identity', '', 'name: CoreBlow', 'emoji: 🤖', ''].join('\n')
            );
        }
    }
}
