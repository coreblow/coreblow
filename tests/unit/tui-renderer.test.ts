/**
 * tests/unit/tui-renderer.test.ts
 * Tests for the TUI renderer
 */
import { describe, it, expect } from 'vitest';
import { TerminalRenderer, colors, box, symbols } from '../../src/tui/renderer.js';

describe('TerminalRenderer', () => {
    const renderer = new TerminalRenderer();

    it('should have width and height', () => {
        expect(renderer.width).toBeGreaterThan(0);
        expect(renderer.height).toBeGreaterThan(0);
    });

    it('should pad strings correctly (left)', () => {
        expect(renderer.pad('hi', 5)).toBe('hi   ');
    });

    it('should pad strings correctly (right)', () => {
        expect(renderer.pad('hi', 5, 'right')).toBe('   hi');
    });

    it('should pad strings correctly (center)', () => {
        const padded = renderer.pad('hi', 6, 'center');
        expect(padded.length).toBe(6);
        expect(padded.trim()).toBe('hi');
    });

    it('should truncate long strings', () => {
        const result = renderer.pad('hello world', 5);
        expect(result.length).toBe(5);
    });

    it('should strip ANSI codes for length calculation', () => {
        const colored = `${colors.red}hi${colors.reset}`;
        const padded = renderer.pad(colored, 10);
        // The visible text "hi" is 2 chars, so 8 spaces of padding
        expect(padded).toContain('hi');
    });

    it('should generate status indicators', () => {
        const online = renderer.statusIndicator(true);
        const offline = renderer.statusIndicator(false);
        expect(online).toContain('●');
        expect(offline).toContain('●');
        expect(online).not.toBe(offline);
    });
});

describe('colors', () => {
    it('should have basic colors', () => {
        expect(colors.red).toBeDefined();
        expect(colors.green).toBeDefined();
        expect(colors.blue).toBeDefined();
        expect(colors.reset).toBeDefined();
    });

    it('should generate 256-color codes', () => {
        const fg = colors.fg256(42);
        expect(fg).toContain('38;5;42');
    });

    it('should generate RGB color codes', () => {
        const fg = colors.fgRgb(255, 128, 0);
        expect(fg).toContain('38;2;255;128;0');
    });
});

describe('box characters', () => {
    it('should have double box chars', () => {
        expect(box.topLeft).toBe('╔');
        expect(box.horizontal).toBe('═');
        expect(box.vertical).toBe('║');
    });

    it('should have thin box chars', () => {
        expect(box.thinTopLeft).toBe('┌');
        expect(box.thinHorizontal).toBe('─');
    });

    it('should have round box chars', () => {
        expect(box.roundTopLeft).toBe('╭');
        expect(box.roundBottomRight).toBe('╯');
    });
});

describe('symbols', () => {
    it('should have status symbols', () => {
        expect(symbols.check).toBe('✓');
        expect(symbols.cross).toBe('✗');
        expect(symbols.online).toBe('🟢');
        expect(symbols.offline).toBe('🔴');
    });
});
