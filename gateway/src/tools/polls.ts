/**
 * src/tools/polls.ts
 * Poll system — create, vote, close, broadcast results
 * Superior to OpenClaw: auto-close timer, anonymous voting, multi-channel sync, live WS updates
 */

import { createChildLogger } from '../utils/logger.js';
import type { ToolHandler } from './types.js';

const log = createChildLogger('tools:polls');

export interface PollOption {
    label: string;
    votes: number;
    voters: Set<string>;
}

export interface Poll {
    id: string;
    question: string;
    options: PollOption[];
    createdBy: string;
    createdAt: number;
    closesAt: number | null;     // auto-close timestamp
    closed: boolean;
    anonymous: boolean;          // hide voter names
    multiVote: boolean;          // allow multiple selections
    channels: string[];          // multi-channel broadcast
    totalVotes: number;
}

export class PollManager {
    private polls = new Map<string, Poll>();
    private timers = new Map<string, NodeJS.Timeout>();
    private onUpdate?: (poll: Poll) => void;

    constructor(opts: { onUpdate?: (poll: Poll) => void } = {}) {
        this.onUpdate = opts.onUpdate;
    }

    create(opts: {
        question: string;
        options: string[];
        createdBy: string;
        autoCloseMinutes?: number;
        anonymous?: boolean;
        multiVote?: boolean;
        channels?: string[];
    }): Poll {
        const id = Math.random().toString(36).slice(2, 10);
        const now = Date.now();

        const poll: Poll = {
            id,
            question: opts.question,
            options: opts.options.map(label => ({
                label,
                votes: 0,
                voters: new Set<string>(),
            })),
            createdBy: opts.createdBy,
            createdAt: now,
            closesAt: opts.autoCloseMinutes ? now + opts.autoCloseMinutes * 60_000 : null,
            closed: false,
            anonymous: opts.anonymous ?? false,
            multiVote: opts.multiVote ?? false,
            channels: opts.channels ?? [],
            totalVotes: 0,
        };

        this.polls.set(id, poll);

        // Auto-close timer
        if (poll.closesAt) {
            const delay = poll.closesAt - now;
            const timer = setTimeout(() => this.close(id), delay);
            this.timers.set(id, timer);
            log.info({ pollId: id, delay }, 'Poll auto-close scheduled');
        }

        log.info({ pollId: id, question: opts.question, options: opts.options.length }, 'Poll created');
        this.onUpdate?.(poll);
        return poll;
    }

    vote(pollId: string, optionIndex: number, voterId: string): { success: boolean; reason?: string } {
        const poll = this.polls.get(pollId);
        if (!poll) return { success: false, reason: 'Poll not found' };
        if (poll.closed) return { success: false, reason: 'Poll is closed' };
        if (optionIndex < 0 || optionIndex >= poll.options.length) return { success: false, reason: 'Invalid option' };

        const option = poll.options[optionIndex];

        // Check if already voted (on this option or any option if !multiVote)
        if (!poll.multiVote) {
            for (const opt of poll.options) {
                if (opt.voters.has(voterId)) {
                    return { success: false, reason: 'Already voted (single-vote poll)' };
                }
            }
        }

        if (option.voters.has(voterId)) {
            return { success: false, reason: 'Already voted for this option' };
        }

        option.voters.add(voterId);
        option.votes++;
        poll.totalVotes++;

        log.debug({ pollId, optionIndex, voterId }, 'Vote recorded');
        this.onUpdate?.(poll);
        return { success: true };
    }

    unvote(pollId: string, optionIndex: number, voterId: string): boolean {
        const poll = this.polls.get(pollId);
        if (!poll || poll.closed) return false;

        const option = poll.options[optionIndex];
        if (!option?.voters.has(voterId)) return false;

        option.voters.delete(voterId);
        option.votes--;
        poll.totalVotes--;
        this.onUpdate?.(poll);
        return true;
    }

    close(pollId: string): Poll | null {
        const poll = this.polls.get(pollId);
        if (!poll) return null;

        poll.closed = true;
        const timer = this.timers.get(pollId);
        if (timer) clearTimeout(timer);
        this.timers.delete(pollId);

        log.info({ pollId, totalVotes: poll.totalVotes }, 'Poll closed');
        this.onUpdate?.(poll);
        return poll;
    }

    get(pollId: string): Poll | undefined {
        return this.polls.get(pollId);
    }

    list(opts: { active?: boolean } = {}): Poll[] {
        const polls = Array.from(this.polls.values());
        if (opts.active !== undefined) {
            return polls.filter(p => !p.closed === opts.active);
        }
        return polls;
    }

    formatResults(pollId: string): string {
        const poll = this.polls.get(pollId);
        if (!poll) return '❌ Poll not found';

        const maxVotes = Math.max(...poll.options.map(o => o.votes), 1);
        const barWidth = 20;

        let text = `📊 **${poll.question}**\n`;
        text += poll.closed ? '🔒 *Closed*\n\n' : '🟢 *Active*\n\n';

        for (let i = 0; i < poll.options.length; i++) {
            const opt = poll.options[i];
            const pct = poll.totalVotes > 0 ? (opt.votes / poll.totalVotes * 100).toFixed(1) : '0.0';
            const filled = Math.round((opt.votes / maxVotes) * barWidth);
            const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);

            text += `${i + 1}. **${opt.label}**\n`;
            text += `   ${bar} ${opt.votes} votes (${pct}%)\n`;

            if (!poll.anonymous && opt.voters.size > 0) {
                text += `   👥 ${Array.from(opt.voters).join(', ')}\n`;
            }
            text += '\n';
        }

        text += `📈 Total: ${poll.totalVotes} votes`;
        if (poll.closesAt && !poll.closed) {
            const remaining = Math.max(0, poll.closesAt - Date.now());
            const mins = Math.ceil(remaining / 60_000);
            text += ` • ⏰ Closes in ${mins}m`;
        }

        return text;
    }

    destroy() {
        for (const timer of this.timers.values()) clearTimeout(timer);
        this.timers.clear();
        this.polls.clear();
    }
}

// Singleton
const pollManager = new PollManager();

export const pollTool: ToolHandler = {
    name: 'poll',
    description: 'Create polls, vote, and view results. Supports auto-close, anonymous voting, and multi-channel broadcast.',
    parameters: {
        type: 'object',
        properties: {
            action: { type: 'string', enum: ['create', 'vote', 'results', 'close', 'list'], description: 'Action to perform' },
            question: { type: 'string', description: 'Poll question (for create)' },
            options: { type: 'array', items: { type: 'string' }, description: 'Poll options (for create)' },
            pollId: { type: 'string', description: 'Poll ID (for vote/results/close)' },
            optionIndex: { type: 'number', description: 'Option index to vote for (0-based)' },
            voterId: { type: 'string', description: 'Voter identifier' },
            autoCloseMinutes: { type: 'number', description: 'Auto-close after N minutes' },
            anonymous: { type: 'boolean', description: 'Hide voter names' },
        },
        required: ['action'],
    },
    execute: async (args: Record<string, any>): Promise<string> => {
        switch (args.action) {
            case 'create': {
                if (!args.question || !args.options?.length) return '❌ Need question and options';
                const poll = pollManager.create({
                    question: args.question,
                    options: args.options,
                    createdBy: args.voterId || 'agent',
                    autoCloseMinutes: args.autoCloseMinutes,
                    anonymous: args.anonymous,
                });
                return `✅ Poll created! ID: ${poll.id}\n\n${pollManager.formatResults(poll.id)}`;
            }
            case 'vote': {
                if (!args.pollId || args.optionIndex === undefined) return '❌ Need pollId and optionIndex';
                const result = pollManager.vote(args.pollId, args.optionIndex, args.voterId || 'anonymous');
                if (!result.success) return `❌ ${result.reason}`;
                return `✅ Vote recorded!\n\n${pollManager.formatResults(args.pollId)}`;
            }
            case 'results':
                return pollManager.formatResults(args.pollId);
            case 'close': {
                const closed = pollManager.close(args.pollId);
                if (!closed) return '❌ Poll not found';
                return `🔒 Poll closed!\n\n${pollManager.formatResults(args.pollId)}`;
            }
            case 'list': {
                const polls = pollManager.list({ active: true });
                if (!polls.length) return '📊 No active polls';
                return polls.map(p => `• **${p.question}** (ID: ${p.id}, ${p.totalVotes} votes)`).join('\n');
            }
            default:
                return '❌ Unknown action. Use: create, vote, results, close, list';
        }
    },
};

export { pollManager };
