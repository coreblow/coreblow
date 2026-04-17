/**
 * tui/chat-view.ts
 * Full-screen chat TUI.
 */

import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('tui:chat-view');

export interface ChatMessage { role: 'user' | 'assistant' | 'system'; content: string; timestamp: number; id?: string }

export interface ChatViewState { messages: ChatMessage[]; inputBuffer: string; scrollOffset: number; width: number; height: number }

export function createChatViewState(width = 80, height = 24): ChatViewState {
    return { messages: [], inputBuffer: '', scrollOffset: 0, width, height };
}

export function renderChatView(state: ChatViewState): string {
    const lines: string[] = [];
    const headerHeight = 2, inputHeight = 3;
    const contentHeight = state.height - headerHeight - inputHeight;

    // Header
    lines.push(`\x1b[1;36m CoreBlow Chat \x1b[0m${'─'.repeat(Math.max(0, state.width - 16))}`);
    lines.push('');

    // Messages
    const messageLines: string[] = [];
    for (const msg of state.messages) {
        const prefix = msg.role === 'user' ? '\x1b[1;32mYou\x1b[0m' : '\x1b[1;35mAI\x1b[0m';
        const time = new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        messageLines.push(`${prefix} \x1b[90m${time}\x1b[0m`);
        // Word-wrap content
        const words = msg.content.split(' ');
        let line = '  ';
        for (const word of words) {
            if (line.length + word.length > state.width - 4) { messageLines.push(line); line = '  '; }
            line += (line.length > 2 ? ' ' : '') + word;
        }
        if (line.trim()) messageLines.push(line);
        messageLines.push('');
    }

    // Apply scroll
    const visible = messageLines.slice(Math.max(0, messageLines.length - contentHeight - state.scrollOffset), messageLines.length - state.scrollOffset);
    for (let i = 0; i < contentHeight; i++) lines.push(visible[i] ?? '');

    // Input area
    lines.push('─'.repeat(state.width));
    lines.push(`\x1b[1m>\x1b[0m ${state.inputBuffer}\x1b[5m▋\x1b[0m`);
    lines.push(`\x1b[90m ESC:quit  ↑↓:scroll  Enter:send \x1b[0m`);

    return lines.join('\n');
}

export function addMessage(state: ChatViewState, msg: ChatMessage): void { state.messages.push(msg); state.scrollOffset = 0; }
export function scrollUp(state: ChatViewState, lines = 3): void { state.scrollOffset = Math.min(state.scrollOffset + lines, Math.max(0, state.messages.length * 3 - state.height)); }
export function scrollDown(state: ChatViewState, lines = 3): void { state.scrollOffset = Math.max(0, state.scrollOffset - lines); }
