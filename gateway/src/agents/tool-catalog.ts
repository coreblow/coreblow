/**
 * agents/tool-catalog.ts
 * Tool catalog — registry of available tools for agents.
 */
export type ToolCategory = 'file' | 'exec' | 'search' | 'browser' | 'mcp' | 'plugin' | 'system' | 'custom';
export interface ToolDefinition {
    name: string;
    description: string;
    category: ToolCategory;
    inputSchema?: Record<string, unknown>;
    requiresApproval?: boolean;
    riskLevel?: 'safe' | 'moderate' | 'dangerous';
    tags?: string[];
    enabled?: boolean;
}

export class ToolCatalog {
    private tools = new Map<string, ToolDefinition>();
    register(tool: ToolDefinition): void { this.tools.set(tool.name, { enabled: true, ...tool }); }
    unregister(name: string): boolean { return this.tools.delete(name); }
    get(name: string): ToolDefinition | undefined { return this.tools.get(name); }
    has(name: string): boolean { return this.tools.has(name); }
    list(): ToolDefinition[] { return [...this.tools.values()]; }
    listEnabled(): ToolDefinition[] { return this.list().filter((t) => t.enabled !== false); }
    listByCategory(category: ToolCategory): ToolDefinition[] { return this.list().filter((t) => t.category === category); }
    listByRisk(level: string): ToolDefinition[] { return this.list().filter((t) => t.riskLevel === level); }
    setEnabled(name: string, enabled: boolean): boolean { const t = this.tools.get(name); if (!t) return false; t.enabled = enabled; return true; }
    size(): number { return this.tools.size; }
    categories(): ToolCategory[] { return [...new Set(this.list().map((t) => t.category))]; }
    toJSON(): ToolDefinition[] { return this.list(); }
    buildToolPrompt(): string {
        const enabled = this.listEnabled();
        if (enabled.length === 0) return 'No tools available.';
        const byCategory = new Map<string, ToolDefinition[]>();
        for (const t of enabled) { const list = byCategory.get(t.category) ?? []; list.push(t); byCategory.set(t.category, list); }
        const lines: string[] = [];
        for (const [cat, tools] of byCategory) { lines.push(`## ${cat}`, ...tools.map((t) => `- **${t.name}**: ${t.description}`), ''); }
        return lines.join('\n');
    }
}
