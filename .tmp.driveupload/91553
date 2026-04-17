/**
 * CoreBlow — Prompt Manager
 *
 * Manages, versions, and templates system prompts for agents.
 * Supports prompt variants, A/B testing, variable injection,
 * and prompt chaining for complex instructions.
 */

/** Prompt template */
export interface PromptTemplate {
    id: string;
    name: string;
    content: string;
    version: number;
    variables?: string[];
    tags?: string[];
    createdAt: number;
    updatedAt: number;
}

/** Prompt chain */
export interface PromptChain {
    id: string;
    name: string;
    prompts: string[]; // IDs
    separator?: string;
}

/**
 * CoreBlow Prompt Manager
 */
export class PromptManager {
    private prompts = new Map<string, PromptTemplate>();
    private chains = new Map<string, PromptChain>();
    private history = new Map<string, PromptTemplate[]>(); // versioned history

    /**
     * Register a prompt template.
     */
    register(id: string, name: string, content: string, tags?: string[]): PromptTemplate {
        const variables = this.extractVariables(content);
        const existing = this.prompts.get(id);
        const version = existing ? existing.version + 1 : 1;

        // Save old version to history
        if (existing) {
            const hist = this.history.get(id) ?? [];
            hist.push({ ...existing });
            this.history.set(id, hist);
        }

        const template: PromptTemplate = {
            id, name, content, version, variables, tags,
            createdAt: existing?.createdAt ?? Date.now(),
            updatedAt: Date.now(),
        };
        this.prompts.set(id, template);
        return template;
    }

    /**
     * Get a prompt by ID.
     */
    get(id: string): PromptTemplate | null {
        return this.prompts.get(id) ?? null;
    }

    /**
     * Render a prompt with variables.
     */
    render(id: string, variables?: Record<string, string>): string | null {
        const prompt = this.prompts.get(id);
        if (!prompt) return null;

        let content = prompt.content;
        if (variables) {
            for (const [key, value] of Object.entries(variables)) {
                content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
            }
        }
        return content;
    }

    /**
     * Register a prompt chain.
     */
    registerChain(id: string, name: string, promptIds: string[], separator?: string): void {
        this.chains.set(id, { id, name, prompts: promptIds, separator: separator ?? '\n\n' });
    }

    /**
     * Render a prompt chain.
     */
    renderChain(chainId: string, variables?: Record<string, string>): string | null {
        const chain = this.chains.get(chainId);
        if (!chain) return null;

        const parts: string[] = [];
        for (const promptId of chain.prompts) {
            const rendered = this.render(promptId, variables);
            if (rendered) parts.push(rendered);
        }
        return parts.join(chain.separator ?? '\n\n');
    }

    /**
     * List all prompts.
     */
    list(tag?: string): Array<{ id: string; name: string; version: number; variables?: string[] }> {
        return Array.from(this.prompts.values())
            .filter((p) => !tag || p.tags?.includes(tag))
            .map((p) => ({ id: p.id, name: p.name, version: p.version, variables: p.variables }));
    }

    /**
     * Get version history for a prompt.
     */
    getVersions(id: string): PromptTemplate[] {
        const current = this.prompts.get(id);
        const hist = this.history.get(id) ?? [];
        return current ? [...hist, current] : hist;
    }

    /**
     * Delete a prompt.
     */
    delete(id: string): boolean {
        this.history.delete(id);
        return this.prompts.delete(id);
    }

    /** Count */
    count(): number { return this.prompts.size; }

    // === Private ===

    private extractVariables(content: string): string[] {
        const matches = content.match(/\{\{(\w+)\}\}/g) ?? [];
        return Array.from(new Set(matches.map((m) => m.slice(2, -2))));
    }
}
