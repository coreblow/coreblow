import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry, type ToolDefinition } from './tool-registry.js';

function makeTool(overrides: Partial<ToolDefinition> = {}): ToolDefinition {
    return {
        name: overrides.name ?? 'test-tool',
        description: overrides.description ?? 'A test tool',
        parameters: overrides.parameters ?? {
            type: 'object' as const,
            properties: { input: { type: 'string', description: 'Test input' } },
            required: ['input'],
        },
        handler: overrides.handler ?? (async () => 'ok'),
        permission: overrides.permission,
        category: overrides.category,
        enabled: overrides.enabled,
    };
}

describe('ToolRegistry', () => {
    let registry: ToolRegistry;

    beforeEach(() => {
        registry = new ToolRegistry();
    });

    // === Registration ===

    describe('register', () => {
        it('adds a tool and makes it retrievable', () => {
            registry.register(makeTool({ name: 'hello' }));
            expect(registry.has('hello')).toBe(true);
            expect(registry.get('hello')?.name).toBe('hello');
        });

        it('defaults enabled to true when not specified', () => {
            registry.register(makeTool({ name: 'auto', enabled: undefined }));
            expect(registry.get('auto')?.enabled).toBe(true);
        });

        it('overwrites a duplicate registration', () => {
            registry.register(makeTool({ name: 'dup', description: 'first' }));
            registry.register(makeTool({ name: 'dup', description: 'second' }));
            expect(registry.get('dup')?.description).toBe('second');
            expect(registry.count()).toBe(1);
        });
    });

    describe('registerMany', () => {
        it('registers multiple tools at once', () => {
            registry.registerMany([
                makeTool({ name: 'a' }),
                makeTool({ name: 'b' }),
                makeTool({ name: 'c' }),
            ]);
            expect(registry.count()).toBe(3);
            expect(registry.listNames()).toEqual(expect.arrayContaining(['a', 'b', 'c']));
        });
    });

    // === Lookup ===

    describe('get', () => {
        it('returns null for non-existent tool', () => {
            expect(registry.get('nope')).toBeNull();
        });
    });

    describe('has', () => {
        it('returns false for unregistered tool', () => {
            expect(registry.has('missing')).toBe(false);
        });
    });

    // === Enable / Disable ===

    describe('setEnabled', () => {
        it('disables a registered tool', () => {
            registry.register(makeTool({ name: 'toggle' }));
            expect(registry.setEnabled('toggle', false)).toBe(true);
            expect(registry.get('toggle')?.enabled).toBe(false);
        });

        it('re-enables a disabled tool', () => {
            registry.register(makeTool({ name: 'toggle', enabled: false }));
            registry.setEnabled('toggle', true);
            expect(registry.get('toggle')?.enabled).toBe(true);
        });

        it('returns false for non-existent tool', () => {
            expect(registry.setEnabled('ghost', true)).toBe(false);
        });
    });

    // === OpenAI Format ===

    describe('toOpenAI', () => {
        it('outputs enabled tools in OpenAI function format', () => {
            registry.register(makeTool({ name: 'search', description: 'Web search' }));
            const tools = registry.toOpenAI();
            expect(tools).toHaveLength(1);
            expect(tools[0]).toEqual({
                type: 'function',
                function: {
                    name: 'search',
                    description: 'Web search',
                    parameters: expect.objectContaining({ type: 'object' }),
                },
            });
        });

        it('excludes disabled tools', () => {
            registry.register(makeTool({ name: 'active' }));
            registry.register(makeTool({ name: 'inactive', enabled: false }));
            const tools = registry.toOpenAI();
            expect(tools).toHaveLength(1);
            expect(tools[0]!.function.name).toBe('active');
        });

        it('filters by permission level', () => {
            registry.register(makeTool({ name: 'pub', permission: 'public' }));
            registry.register(makeTool({ name: 'own', permission: 'owner' }));
            registry.register(makeTool({ name: 'adm', permission: 'admin' }));

            const ownerTools = registry.toOpenAI('owner');
            const names = ownerTools.map((t) => t.function.name);
            expect(names).toContain('pub');
            expect(names).toContain('own');
            expect(names).not.toContain('adm');
        });

        it('includes tools with no permission set when filtering', () => {
            registry.register(makeTool({ name: 'noPerm' }));
            const tools = registry.toOpenAI('owner');
            expect(tools.map((t) => t.function.name)).toContain('noPerm');
        });
    });

    // === Categories ===

    describe('listByCategory', () => {
        it('groups tools by category', () => {
            registry.register(makeTool({ name: 'calc', category: 'math' }));
            registry.register(makeTool({ name: 'search', category: 'web' }));
            registry.register(makeTool({ name: 'fetch', category: 'web' }));

            const cats = registry.listByCategory();
            expect(cats['math']).toEqual(['calc']);
            expect(cats['web']).toEqual(expect.arrayContaining(['search', 'fetch']));
        });

        it('uses "general" for uncategorized tools', () => {
            registry.register(makeTool({ name: 'uncat' }));
            const cats = registry.listByCategory();
            expect(cats['general']).toContain('uncat');
        });
    });

    // === Helpers ===

    describe('listNames', () => {
        it('returns empty array when no tools registered', () => {
            expect(registry.listNames()).toEqual([]);
        });
    });

    describe('count', () => {
        it('returns 0 for empty registry', () => {
            expect(registry.count()).toBe(0);
        });
    });
});
