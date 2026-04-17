/**
 * CoreBlow Phase 41 — Tool Registry Extended Tests
 *
 * Layer 1 (Edge Cases):
 *   - ToolRegistry: register, registerMany, setEnabled, toOpenAI, listByCategory
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry } from '../../src/tools/tool-registry.js';
import type { ToolDefinition } from '../../src/tools/tool-registry.js';

describe('ToolRegistry — Extended', () => {
    let registry: ToolRegistry;

    const mockTool = (name: string, category = 'general', permission: 'public' | 'owner' | 'admin' = 'public'): ToolDefinition => ({
        name, description: 'Test tool',
        parameters: { type: 'object', properties: {} },
        handler: async () => 'ok',
        category, permission,
    });

    beforeEach(() => { registry = new ToolRegistry(); });

    it('should register and retrieve a tool', () => {
        registry.register(mockTool('test-tool'));
        expect(registry.has('test-tool')).toBe(true);
        expect(registry.get('test-tool')?.name).toBe('test-tool');
        expect(registry.count()).toBe(1);
    });

    it('should register multiple tools', () => {
        registry.registerMany([mockTool('t1'), mockTool('t2')]);
        expect(registry.count()).toBe(2);
        expect(registry.listNames()).toEqual(['t1', 't2']);
    });

    it('should enable and disable tools', () => {
        registry.register(mockTool('t1'));
        expect(registry.setEnabled('t1', false)).toBe(true);
        expect(registry.get('t1')?.enabled).toBe(false);

        expect(registry.setEnabled('unknown', true)).toBe(false);
    });

    it('should generate OpenAI schema for enabled tools', () => {
        registry.registerMany([mockTool('t1'), mockTool('t2')]);
        registry.setEnabled('t2', false);

        const schemas = registry.toOpenAI();
        expect(schemas).toHaveLength(1);
        expect(schemas[0]?.function.name).toBe('t1');
    });

    it('should filter OpenAI schema by permission level', () => {
        registry.registerMany([
            mockTool('pub', 'misc', 'public'),
            mockTool('adm', 'misc', 'admin'),
        ]);

        const schemas = registry.toOpenAI('admin');
        expect(schemas).toHaveLength(2); // admin sees both public and admin

        const pubSchemas = registry.toOpenAI('public');
        expect(pubSchemas).toHaveLength(1); // public sees only public
        expect(pubSchemas[0]?.function.name).toBe('pub');
    });

    it('should list tools by category', () => {
        registry.registerMany([
            mockTool('t1', 'system'),
            mockTool('t2', 'system'),
            mockTool('t3', 'ui'),
        ]);
        const categories = registry.listByCategory();
        expect(categories['system']).toEqual(['t1', 't2']);
        expect(categories['ui']).toEqual(['t3']);
    });
});
