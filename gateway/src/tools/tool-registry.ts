/**
 * CoreBlow — Tool Registry
 *
 * Central registry for agent tools. Handles tool discovery,
 * schema validation, permission management, and OpenAI-compatible
 * function definitions for the chat API.
 */

/** Tool definition */
export interface ToolDefinition {
    name: string;
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, {
            type: string;
            description?: string;
            enum?: string[];
            default?: unknown;
        }>;
        required?: string[];
    };
    /** Handler function */
    handler: (args: Record<string, unknown>) => Promise<string>;
    /** Permission level */
    permission?: 'public' | 'owner' | 'admin';
    /** Category for grouping */
    category?: string;
    /** Whether the tool is enabled */
    enabled?: boolean;
}

/** OpenAI-compatible tool format */
export interface OpenAITool {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: unknown;
    };
}

/**
 * CoreBlow Tool Registry
 */
export class ToolRegistry {
    private tools = new Map<string, ToolDefinition>();

    /**
     * Register a tool.
     */
    register(tool: ToolDefinition): void {
        if (tool.enabled === undefined) tool.enabled = true;
        this.tools.set(tool.name, tool);
    }

    /**
     * Register multiple tools.
     */
    registerMany(tools: ToolDefinition[]): void {
        for (const tool of tools) this.register(tool);
    }

    /**
     * Get a tool by name.
     */
    get(name: string): ToolDefinition | null {
        return this.tools.get(name) ?? null;
    }

    /**
     * Check if a tool exists.
     */
    has(name: string): boolean {
        return this.tools.has(name);
    }

    /**
     * Enable or disable a tool.
     */
    setEnabled(name: string, enabled: boolean): boolean {
        const tool = this.tools.get(name);
        if (!tool) return false;
        tool.enabled = enabled;
        return true;
    }

    /**
     * List all enabled tools as OpenAI-compatible definitions.
     */
    toOpenAI(permission?: string): OpenAITool[] {
        return Array.from(this.tools.values())
            .filter((t) => t.enabled !== false)
            .filter((t) => !permission || !t.permission || t.permission === 'public' || t.permission === permission)
            .map((t) => ({
                type: 'function' as const,
                function: {
                    name: t.name,
                    description: t.description,
                    parameters: t.parameters,
                },
            }));
    }

    /**
     * List tools by category.
     */
    listByCategory(): Record<string, string[]> {
        const categories: Record<string, string[]> = {};
        for (const tool of Array.from(this.tools.values())) {
            const cat = tool.category ?? 'general';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(tool.name);
        }
        return categories;
    }

    /**
     * List all tool names.
     */
    listNames(): string[] {
        return Array.from(this.tools.keys());
    }

    /** Total count */
    count(): number {
        return this.tools.size;
    }
}
