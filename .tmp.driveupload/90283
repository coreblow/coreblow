import { describe, it, expect } from 'vitest';
import { TerminalRenderer, colors, box, symbols } from './renderer.js';
import {
    createChatViewState, renderChatView, addMessage,
    scrollUp, scrollDown, type ChatMessage,
} from './chat-view.js';

describe('TUI Module', () => {
    describe('renderer.ts: colors, box, symbols', () => {
        it('colors has ANSI escape codes', () => {
            expect(colors.reset).toContain('\x1b[');
            expect(colors.bold).toBe('\x1b[1m');
            expect(colors.red).toBe('\x1b[31m');
            expect(colors.green).toBe('\x1b[32m');
        });

        it('colors.fg256 generates 256-color codes', () => {
            expect(colors.fg256(196)).toBe('\x1b[38;5;196m');
        });

        it('colors.fgRgb generates RGB codes', () => {
            expect(colors.fgRgb(255, 0, 128)).toBe('\x1b[38;2;255;0;128m');
        });

        it('box has proper Unicode characters', () => {
            expect(box.topLeft).toBe('╔');
            expect(box.thinTopLeft).toBe('┌');
            expect(box.roundTopLeft).toBe('╭');
            expect(box.horizontal).toBe('═');
        });

        it('symbols has emoji/Unicode glyphs', () => {
            expect(symbols.check).toBe('✓');
            expect(symbols.cross).toBe('✗');
            expect(symbols.arrow).toBe('→');
        });
    });

    describe('renderer.ts: TerminalRenderer', () => {
        it('pad: left-aligns by default', () => {
            const renderer = new TerminalRenderer();
            expect(renderer.pad('hi', 6)).toBe('hi    ');
        });

        it('pad: right-aligns', () => {
            const renderer = new TerminalRenderer();
            expect(renderer.pad('hi', 6, 'right')).toBe('    hi');
        });

        it('pad: center-aligns', () => {
            const renderer = new TerminalRenderer();
            const result = renderer.pad('hi', 6, 'center');
            expect(result.length).toBe(6); // includes padding
            expect(result.trim()).toBe('hi');
        });

        it('pad: truncates long strings', () => {
            const renderer = new TerminalRenderer();
            const result = renderer.pad('very long string', 5);
            expect(result.length).toBe(5);
        });

        it('statusIndicator produces colored dot', () => {
            const renderer = new TerminalRenderer();
            expect(renderer.statusIndicator(true)).toContain('●');
            expect(renderer.statusIndicator(true)).toContain(colors.brightGreen);
            expect(renderer.statusIndicator(false)).toContain(colors.red);
        });
    });

    describe('chat-view.ts', () => {
        it('creates default chat view state', () => {
            const state = createChatViewState();
            expect(state.messages).toEqual([]);
            expect(state.inputBuffer).toBe('');
            expect(state.scrollOffset).toBe(0);
            expect(state.width).toBe(80);
            expect(state.height).toBe(24);
        });

        it('creates chat view state with custom dimensions', () => {
            const state = createChatViewState(120, 48);
            expect(state.width).toBe(120);
            expect(state.height).toBe(48);
        });

        it('addMessage pushes message and resets scroll', () => {
            const state = createChatViewState();
            state.scrollOffset = 5;

            const msg: ChatMessage = { role: 'user', content: 'Hello', timestamp: Date.now() };
            addMessage(state, msg);

            expect(state.messages.length).toBe(1);
            expect(state.messages[0].content).toBe('Hello');
            expect(state.scrollOffset).toBe(0); // reset on new message
        });

        it('scrollUp increases scrollOffset', () => {
            const state = createChatViewState(80, 10); // small height
            // Add enough messages to allow scrolling
            for (let i = 0; i < 20; i++) {
                addMessage(state, { role: 'user', content: `msg ${i}`, timestamp: Date.now() });
            }
            scrollUp(state, 3);
            expect(state.scrollOffset).toBeGreaterThan(0);
        });

        it('scrollDown decreases scrollOffset (cannot go below 0)', () => {
            const state = createChatViewState();
            state.scrollOffset = 5;
            scrollDown(state, 3);
            expect(state.scrollOffset).toBe(2);

            scrollDown(state, 10);
            expect(state.scrollOffset).toBe(0); // clamped to 0
        });

        it('renderChatView produces output with header and input', () => {
            const state = createChatViewState(60, 10);
            addMessage(state, { role: 'user', content: 'Test', timestamp: Date.now() });
            addMessage(state, { role: 'assistant', content: 'Reply', timestamp: Date.now() });

            const output = renderChatView(state);
            expect(output).toContain('CoreBlow Chat');
            expect(output).toContain('ESC:quit');
            expect(output).toContain('Enter:send');
        });
    });
});
