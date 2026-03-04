/**
 * src/tools/cron.ts
 * Cron scheduler tool — schedule recurring messages/tasks
 */

import type { ToolHandler } from './types.js';
import { getStore } from '../utils/store.js';
import { getHomeDir } from '../gateway/config.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('tool:cron');

export const cronTool: ToolHandler = {
    name: 'cron',
    description: 'Schedule a recurring task or message. Supports create, list, delete, and toggle operations.',
    parameters: {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['create', 'list', 'delete', 'toggle'],
                description: 'Action to perform',
            },
            name: { type: 'string', description: 'Job name (for create)' },
            schedule: { type: 'string', description: 'Cron expression (for create), e.g. "0 9 * * *" for 9am daily' },
            message: { type: 'string', description: 'Message or task to run (for create)' },
            id: { type: 'number', description: 'Job ID (for delete/toggle)' },
        },
        required: ['action'],
    },

    async execute(args: Record<string, any>): Promise<string> {
        const db = getStore(getHomeDir());
        const { action, name, schedule, message, id } = args;

        switch (action) {
            case 'create': {
                if (!name || !schedule || !message) {
                    return 'Error: name, schedule, and message are required for create';
                }
                const stmt = db.prepare(
                    'INSERT INTO cron_jobs (name, schedule, agent_id, session_id, message) VALUES (?, ?, ?, ?, ?)'
                );
                const result = stmt.run(name, schedule, 'default', 'cron', message);
                return `Created cron job #${result.lastInsertRowid}: "${name}" (${schedule})`;
            }

            case 'list': {
                const rows = db.prepare('SELECT * FROM cron_jobs ORDER BY id').all() as any[];
                if (rows.length === 0) return 'No cron jobs configured';
                return rows
                    .map((r) => `#${r.id} ${r.enabled ? '✅' : '⏸️'} "${r.name}" — ${r.schedule} — ${r.message.slice(0, 50)}`)
                    .join('\n');
            }

            case 'delete': {
                if (!id) return 'Error: id is required for delete';
                db.prepare('DELETE FROM cron_jobs WHERE id = ?').run(id);
                return `Deleted cron job #${id}`;
            }

            case 'toggle': {
                if (!id) return 'Error: id is required for toggle';
                db.prepare('UPDATE cron_jobs SET enabled = CASE WHEN enabled = 1 THEN 0 ELSE 1 END WHERE id = ?').run(id);
                const job = db.prepare('SELECT * FROM cron_jobs WHERE id = ?').get(id) as any;
                return job
                    ? `Cron job #${id} is now ${job.enabled ? 'enabled' : 'disabled'}`
                    : `Job #${id} not found`;
            }

            default:
                return `Unknown action: ${action}. Use create, list, delete, or toggle.`;
        }
    },
};
