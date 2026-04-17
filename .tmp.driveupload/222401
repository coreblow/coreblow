/**
 * CoreBlow — Doc Site Generator
 *
 * Generates documentation site content from module
 * metadata. Supports module docs, API reference,
 * getting started guides, and search indexing.
 */

/** Doc module */
export interface DocModule {
    name: string;
    description: string;
    category: string;
    exports: Array<{ name: string; type: string; description: string }>;
    examples?: Array<{ title: string; code: string }>;
}

/** Doc page */
export interface DocPage {
    slug: string;
    title: string;
    content: string;
    category: string;
    order: number;
}

/**
 * CoreBlow Doc Site Generator
 */
export class DocSiteGenerator {
    private modules: DocModule[] = [];
    private pages: DocPage[] = [];

    /**
     * Add a module doc.
     */
    addModule(doc: DocModule): void {
        this.modules.push(doc);
    }

    /**
     * Generate module doc page.
     */
    generateModulePage(moduleName: string): string | null {
        const mod = this.modules.find((m) => m.name === moduleName);
        if (!mod) return null;

        const lines: string[] = [
            `# ${mod.name}`, '', mod.description, '',
            '## API Reference', '',
        ];

        for (const exp of mod.exports) {
            lines.push(`### \`${exp.name}\` (${exp.type})`);
            lines.push('', exp.description, '');
        }

        if (mod.examples?.length) {
            lines.push('## Examples', '');
            for (const ex of mod.examples) {
                lines.push(`### ${ex.title}`, '', '```typescript', ex.code, '```', '');
            }
        }

        return lines.join('\n');
    }

    /**
     * Generate sidebar navigation.
     */
    generateSidebar(): Array<{ category: string; items: Array<{ name: string; slug: string }> }> {
        const categories = new Map<string, Array<{ name: string; slug: string }>>();
        for (const mod of this.modules) {
            if (!categories.has(mod.category)) categories.set(mod.category, []);
            categories.get(mod.category)!.push({ name: mod.name, slug: this.toSlug(mod.name) });
        }
        return Array.from(categories.entries()).map(([category, items]) => ({ category, items }));
    }

    /**
     * Generate getting started guide.
     */
    generateGettingStarted(): string {
        return [
            '# Getting Started with CoreBlow',
            '',
            '## Installation',
            '```bash',
            'npm install coreblow',
            '```',
            '',
            '## Quick Start',
            '```typescript',
            "import { PersonaEngine, SkillSystem, SessionManager } from 'coreblow';",
            '',
            '// Initialize core systems',
            'const personas = new PersonaEngine();',
            'const skills = new SkillSystem();',
            'const sessions = new SessionManager();',
            '```',
            '',
            `## Available Modules (${this.modules.length})`,
            '',
            ...this.modules.map((m) => `- **${m.name}** — ${m.description}`),
        ].join('\n');
    }

    /**
     * Build search index.
     */
    buildSearchIndex(): Array<{ slug: string; title: string; keywords: string[] }> {
        return this.modules.map((m) => ({
            slug: this.toSlug(m.name),
            title: m.name,
            keywords: [m.name, m.category, ...m.exports.map((e) => e.name)],
        }));
    }

    /**
     * Search modules.
     */
    search(query: string): DocModule[] {
        const q = query.toLowerCase();
        return this.modules.filter((m) =>
            m.name.toLowerCase().includes(q) ||
            m.description.toLowerCase().includes(q) ||
            m.exports.some((e) => e.name.toLowerCase().includes(q))
        );
    }

    /** Count modules */
    count(): number { return this.modules.length; }

    // === Private ===
    private toSlug(name: string): string { return name.toLowerCase().replace(/\s+/g, '-'); }
}
