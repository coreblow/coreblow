/**
 * src/tools/registry.ts
 * Tool registry — register, discover, and execute tools
 */

import type { ToolHandler } from './types.js';
import type { ToolDefinition } from '../providers/interface.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('tools');

export class ToolRegistry {
    private tools: Map<string, ToolHandler> = new Map();

    /**
     * Register a tool
     */
    register(handler: ToolHandler) {
        this.tools.set(handler.name, handler);
        log.debug({ tool: handler.name }, 'Tool registered');
    }

    /**
     * Get tool definitions for AI providers
     */
    getDefinitions(): ToolDefinition[] {
        return Array.from(this.tools.values()).map((t) => ({
            type: 'function' as const,
            function: {
                name: t.name,
                description: t.description,
                parameters: t.parameters,
            },
        }));
    }

    /**
     * Execute a tool by name
     */
    async execute(name: string, args: Record<string, any>): Promise<string> {
        const tool = this.tools.get(name);
        if (!tool) {
            return `Error: Unknown tool "${name}"`;
        }

        log.info({ tool: name, args }, 'Executing tool');
        const start = Date.now();

        try {
            const result = await tool.execute(args);
            const duration = Date.now() - start;
            log.info({ tool: name, duration }, 'Tool executed');
            return result;
        } catch (err: any) {
            log.error({ tool: name, err: err.message }, 'Tool execution failed');
            return `Error executing ${name}: ${err.message}`;
        }
    }

    /**
     * List registered tools
     */
    list(): string[] {
        return Array.from(this.tools.keys());
    }

    /**
     * Check if a tool exists
     */
    has(name: string): boolean {
        return this.tools.has(name);
    }
}
