/**
 * Phase 5 Tests: Canvas Host + A2UI v0.9
 * Tests: A2UI rendering, validation, tree parsing
 * (Canvas host HTTP tests skipped — requires ws dependency)
 */
import { describe, it, expect } from 'vitest';
import {
    renderA2UIToHTML, validateA2UITree, parseA2UIFromComponents,
    type A2UITree, type A2UIComponent,
} from '../../src/canvas/a2ui-renderer.js';

// ═══════════════════════════════════════════════════════════════════
// A2UI v0.9 Renderer
// ═══════════════════════════════════════════════════════════════════

describe('A2UI v0.9 Renderer', () => {
    const simpleTree: A2UITree = {
        version: '0.9',
        root: 'root',
        title: 'Test Dashboard',
        theme: 'dark',
        components: [
            { id: 'root', type: 'column', children: ['header', 'content', 'footer'] },
            { id: 'header', type: 'heading', value: 'Dashboard', level: 1 },
            { id: 'content', type: 'text', value: 'Welcome to CoreBlow' },
            { id: 'footer', type: 'button', label: 'Click me', action: 'greet', variant: 'primary' },
        ],
    };

    it('renders HTML from tree', () => {
        const html = renderA2UIToHTML(simpleTree);
        expect(html).toContain('<!DOCTYPE html>');
        expect(html).toContain('Dashboard');
        expect(html).toContain('Welcome to CoreBlow');
        expect(html).toContain('Click me');
    });

    it('includes title', () => {
        const html = renderA2UIToHTML(simpleTree);
        expect(html).toContain('<title>Test Dashboard</title>');
    });

    it('renders dark theme styles', () => {
        const html = renderA2UIToHTML(simpleTree);
        expect(html).toContain('data-theme="dark"');
        expect(html).toContain('#0a0a0a'); // dark background
    });

    it('renders light theme', () => {
        const lightTree = { ...simpleTree, theme: 'light' as const };
        const html = renderA2UIToHTML(lightTree);
        expect(html).toContain('data-theme="light"');
    });

    it('renders button with action', () => {
        const html = renderA2UIToHTML(simpleTree);
        expect(html).toContain('data-action="greet"');
    });

    it('renders heading with correct level', () => {
        const html = renderA2UIToHTML(simpleTree);
        expect(html).toContain('<h1');
    });

    it('escapes HTML in content', () => {
        const tree: A2UITree = {
            version: '0.9', root: 'r',
            components: [{ id: 'r', type: 'text', value: '<script>alert(1)</script>' }],
        };
        const html = renderA2UIToHTML(tree);
        expect(html).not.toContain('<script>alert');
        expect(html).toContain('&lt;script&gt;');
    });

    it('includes interaction script', () => {
        const html = renderA2UIToHTML(simpleTree);
        expect(html).toContain('a2ui-action');
    });
});

// ═══════════════════════════════════════════════════════════════════
// A2UI Component Types
// ═══════════════════════════════════════════════════════════════════

describe('A2UI Component Types', () => {
    function render(comp: A2UIComponent): string {
        return renderA2UIToHTML({
            version: '0.9', root: comp.id,
            components: [comp],
        });
    }

    it('renders input', () => {
        const html = render({ id: 'inp', type: 'input', placeholder: 'Enter text' });
        expect(html).toContain('placeholder="Enter text"');
        expect(html).toContain('<input');
    });

    it('renders select with options', () => {
        const html = render({
            id: 'sel', type: 'select',
            options: [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }],
        });
        expect(html).toContain('<select');
        expect(html).toContain('<option');
    });

    it('renders checkbox', () => {
        const html = render({ id: 'chk', type: 'checkbox', label: 'Accept', checked: true });
        expect(html).toContain('type="checkbox"');
        expect(html).toContain('checked');
    });

    it('renders slider', () => {
        const html = render({ id: 'sld', type: 'slider', min: 0, max: 100, step: 5 });
        expect(html).toContain('type="range"');
        expect(html).toContain('min="0"');
        expect(html).toContain('max="100"');
    });

    it('renders image', () => {
        const html = render({ id: 'img', type: 'image', src: 'https://example.com/img.png', label: 'Photo' });
        expect(html).toContain('<img');
        expect(html).toContain('src="https://example.com/img.png"');
    });

    it('renders code block', () => {
        const html = render({ id: 'code', type: 'code', value: 'const x = 1;', language: 'typescript' });
        expect(html).toContain('<pre');
        expect(html).toContain('language-typescript');
        expect(html).toContain('const x = 1;');
    });

    it('renders table', () => {
        const html = render({
            id: 'tbl', type: 'table',
            headers: ['Name', 'Role'],
            rows: [['Alice', 'Engineer'], ['Bob', 'Designer']],
        });
        expect(html).toContain('<table');
        expect(html).toContain('Alice');
        expect(html).toContain('Engineer');
    });

    it('renders divider', () => {
        const html = render({ id: 'div', type: 'divider' });
        expect(html).toContain('<hr');
    });

    it('renders card', () => {
        const html = render({ id: 'card', type: 'card', value: 'Card content' });
        expect(html).toContain('a2ui-card');
        expect(html).toContain('Card content');
    });

    it('renders badge with variant', () => {
        const html = render({ id: 'badge', type: 'badge', value: 'New', variant: 'success' });
        expect(html).toContain('a2ui-success');
        expect(html).toContain('New');
    });

    it('renders progress bar', () => {
        const html = render({ id: 'prog', type: 'progress', progress: 75 });
        expect(html).toContain('width:75%');
    });

    it('renders markdown content', () => {
        const html = render({ id: 'md', type: 'markdown', value: '**bold** and *italic*' });
        expect(html).toContain('<strong>bold</strong>');
        expect(html).toContain('<em>italic</em>');
    });

    it('renders disabled button', () => {
        const html = render({ id: 'btn', type: 'button', label: 'No', disabled: true });
        expect(html).toContain('disabled');
    });

    it('applies custom style', () => {
        const html = render({ id: 't', type: 'text', value: 'red', style: { color: 'red' } });
        expect(html).toContain('style="color:red"');
    });
});

// ═══════════════════════════════════════════════════════════════════
// A2UI Validation
// ═══════════════════════════════════════════════════════════════════

describe('A2UI Validation', () => {
    it('validates valid tree', () => {
        const tree: A2UITree = {
            version: '0.9', root: 'root',
            components: [{ id: 'root', type: 'text', value: 'hello' }],
        };
        expect(validateA2UITree(tree)).toHaveLength(0);
    });

    it('detects wrong version', () => {
        const tree = { version: '0.8' as any, root: 'r', components: [{ id: 'r', type: 'text' }] };
        const errors = validateA2UITree(tree as any);
        expect(errors.some(e => e.includes('version'))).toBe(true);
    });

    it('detects missing root', () => {
        const tree: A2UITree = {
            version: '0.9', root: 'nonexistent',
            components: [{ id: 'root', type: 'text' }],
        };
        const errors = validateA2UITree(tree);
        expect(errors.some(e => e.includes('not found'))).toBe(true);
    });

    it('detects duplicate IDs', () => {
        const tree: A2UITree = {
            version: '0.9', root: 'r',
            components: [
                { id: 'r', type: 'column', children: ['a'] },
                { id: 'a', type: 'text' },
                { id: 'a', type: 'button' },
            ],
        };
        const errors = validateA2UITree(tree);
        expect(errors.some(e => e.includes('Duplicate'))).toBe(true);
    });

    it('detects invalid child references', () => {
        const tree: A2UITree = {
            version: '0.9', root: 'r',
            components: [
                { id: 'r', type: 'column', children: ['missing'] },
            ],
        };
        const errors = validateA2UITree(tree);
        expect(errors.some(e => e.includes('non-existent'))).toBe(true);
    });

    it('detects empty components', () => {
        const tree: A2UITree = { version: '0.9', root: 'r', components: [] };
        const errors = validateA2UITree(tree);
        expect(errors.length).toBeGreaterThan(0);
    });
});

// ═══════════════════════════════════════════════════════════════════
// A2UI Parser
// ═══════════════════════════════════════════════════════════════════

describe('A2UI Parser', () => {
    it('parses flat component list to tree', () => {
        const components: A2UIComponent[] = [
            { id: 'root', type: 'column', children: ['text1'] },
            { id: 'text1', type: 'text', value: 'Hello' },
        ];
        const tree = parseA2UIFromComponents(components, { title: 'Test' });
        expect(tree.version).toBe('0.9');
        expect(tree.root).toBe('root');
        expect(tree.title).toBe('Test');
        expect(tree.components).toHaveLength(2);
    });

    it('uses first component as root by default', () => {
        const tree = parseA2UIFromComponents([
            { id: 'main', type: 'text', value: 'Hi' },
        ]);
        expect(tree.root).toBe('main');
    });

    it('allows custom root override', () => {
        const tree = parseA2UIFromComponents(
            [{ id: 'a', type: 'text' }, { id: 'b', type: 'text' }],
            { root: 'b' },
        );
        expect(tree.root).toBe('b');
    });

    it('sets default theme to auto', () => {
        const tree = parseA2UIFromComponents([{ id: 'r', type: 'text' }]);
        expect(tree.theme).toBe('auto');
    });
});
