/**
 * CoreBlow — Skill System
 *
 * Reusable, composable skill modules that agents can learn
 * and use. Each skill bundles a prompt, tools, and examples
 * into a self-contained capability.
 */

/** Skill definition */
export interface Skill {
    id: string;
    name: string;
    description: string;
    category: string;
    /** System prompt addition */
    systemPrompt?: string;
    /** Associated tool names */
    tools?: string[];
    /** Few-shot examples */
    examples?: Array<{ input: string; output: string }>;
    /** Required skills */
    requires?: string[];
    /** Activation keywords */
    triggers?: string[];
    enabled: boolean;
    version: string;
}

/** Skill match result */
export interface SkillMatch {
    skill: Skill;
    confidence: number;
    trigger?: string;
}

/**
 * CoreBlow Skill System
 */
export class SkillSystem {
    private skills = new Map<string, Skill>();

    constructor() {
        // Built-in skills
        this.register({
            id: 'code-gen', name: 'Code Generation', description: 'Generate code in any language',
            category: 'development', systemPrompt: 'Generate clean, documented code following best practices.',
            triggers: ['write code', 'generate', 'implement', 'create function'], enabled: true, version: '1.0',
        });
        this.register({
            id: 'code-review', name: 'Code Review', description: 'Review and improve code quality',
            category: 'development', systemPrompt: 'Review code for bugs, performance, and best practices.',
            triggers: ['review', 'improve', 'refactor', 'optimize'], enabled: true, version: '1.0',
        });
        this.register({
            id: 'data-analysis', name: 'Data Analysis', description: 'Analyze and visualize data',
            category: 'analytics', systemPrompt: 'Analyze data and provide structured insights with tables.',
            triggers: ['analyze', 'data', 'statistics', 'chart'], enabled: true, version: '1.0',
        });
        this.register({
            id: 'summarize', name: 'Summarization', description: 'Summarize long texts',
            category: 'text', systemPrompt: 'Provide concise, accurate summaries preserving key information.',
            triggers: ['summarize', 'summary', 'tldr', 'brief'], enabled: true, version: '1.0',
        });
        this.register({
            id: 'translate', name: 'Translation', description: 'Translate between languages',
            category: 'text', systemPrompt: 'Translate accurately preserving tone and cultural context.',
            triggers: ['translate', 'translation', 'convert language'], enabled: true, version: '1.0',
        });
    }

    /**
     * Register a skill.
     */
    register(skill: Skill): void {
        this.skills.set(skill.id, skill);
    }

    /**
     * Get a skill by ID.
     */
    get(id: string): Skill | null {
        return this.skills.get(id) ?? null;
    }

    /**
     * Match skills based on user input.
     */
    match(input: string, topK: number = 3): SkillMatch[] {
        const lower = input.toLowerCase();
        const matches: SkillMatch[] = [];

        for (const skill of Array.from(this.skills.values())) {
            if (!skill.enabled) continue;
            let confidence = 0;
            let matchedTrigger: string | undefined;

            for (const trigger of skill.triggers ?? []) {
                if (lower.includes(trigger.toLowerCase())) {
                    confidence = Math.max(confidence, 0.8);
                    matchedTrigger = trigger;
                }
            }

            // Description match
            const descWords = skill.description.toLowerCase().split(' ');
            for (const word of descWords) {
                if (word.length > 3 && lower.includes(word)) confidence = Math.max(confidence, 0.4);
            }

            if (confidence > 0) {
                matches.push({ skill, confidence, trigger: matchedTrigger });
            }
        }

        return matches.sort((a, b) => b.confidence - a.confidence).slice(0, topK);
    }

    /**
     * Build system prompt additions for active skills.
     */
    buildPromptAdditions(skillIds: string[]): string {
        return skillIds
            .map((id) => this.skills.get(id))
            .filter((s): s is Skill => s !== null && s !== undefined && !!s.systemPrompt)
            .map((s) => s.systemPrompt!)
            .join('\n');
    }

    /**
     * Enable/disable a skill.
     */
    setEnabled(id: string, enabled: boolean): boolean {
        const skill = this.skills.get(id);
        if (!skill) return false;
        skill.enabled = enabled;
        return true;
    }

    /**
     * List skills by category.
     */
    listByCategory(): Record<string, Array<{ id: string; name: string; enabled: boolean }>> {
        const cats: Record<string, Array<{ id: string; name: string; enabled: boolean }>> = {};
        for (const skill of Array.from(this.skills.values())) {
            if (!cats[skill.category]) cats[skill.category] = [];
            cats[skill.category].push({ id: skill.id, name: skill.name, enabled: skill.enabled });
        }
        return cats;
    }

    /**
     * List all skills.
     */
    list(): Array<{ id: string; name: string; category: string; enabled: boolean }> {
        return Array.from(this.skills.values()).map((s) => ({
            id: s.id, name: s.name, category: s.category, enabled: s.enabled,
        }));
    }

    /** Count */
    count(): number { return this.skills.size; }
}
