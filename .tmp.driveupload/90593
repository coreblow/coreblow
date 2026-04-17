/**
 * CoreBlow — Template Engine
 *
 * Lightweight template engine for message formatting across channels.
 * Supports variable interpolation, conditionals, loops, filters,
 * and channel-specific markdown conversion.
 */

/** Template context */
export type TemplateContext = Record<string, unknown>;

/** Registered filter function */
export type FilterFn = (value: unknown, ...args: string[]) => string;

/**
 * CoreBlow Template Engine
 */
export class TemplateEngine {
    private templates = new Map<string, string>();
    private filters = new Map<string, FilterFn>();
    private partials = new Map<string, string>();

    constructor() {
        // Built-in filters
        this.filters.set('upper', (v) => String(v).toUpperCase());
        this.filters.set('lower', (v) => String(v).toLowerCase());
        this.filters.set('trim', (v) => String(v).trim());
        this.filters.set('truncate', (v, len) => {
            const s = String(v);
            const n = parseInt(len) || 100;
            return s.length > n ? s.slice(0, n) + '...' : s;
        });
        this.filters.set('capitalize', (v) => {
            const s = String(v);
            return s.charAt(0).toUpperCase() + s.slice(1);
        });
        this.filters.set('default', (v, def) => v ? String(v) : (def ?? ''));
        this.filters.set('json', (v) => JSON.stringify(v, null, 2));
        this.filters.set('escape', (v) => String(v).replace(/[&<>"']/g, (c) =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c)));
    }

    /**
     * Register a named template.
     */
    register(name: string, template: string): void {
        this.templates.set(name, template);
    }

    /**
     * Register a custom filter.
     */
    registerFilter(name: string, fn: FilterFn): void {
        this.filters.set(name, fn);
    }

    /**
     * Register a partial template.
     */
    registerPartial(name: string, template: string): void {
        this.partials.set(name, template);
    }

    /**
     * Render a template string with context.
     */
    render(template: string, context: TemplateContext = {}): string {
        let result = template;

        // Include partials: {{> partialName}}
        result = result.replace(/\{\{>\s*(\w+)\s*\}\}/g, (_, name) => {
            return this.partials.get(name) ?? '';
        });

        // Conditionals: {{#if key}}...{{/if}} and {{#if key}}...{{#else}}...{{/if}}
        result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)(?:\{\{#else\}\}([\s\S]*?))?\{\{\/if\}\}/g, (_, key, ifBlock, elseBlock) => {
            const value = this.resolve(key, context);
            return value ? ifBlock : (elseBlock ?? '');
        });

        // Loops: {{#each items}}...{{/each}}
        result = result.replace(/\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (_, key, block) => {
            const items = this.resolve(key, context);
            if (!Array.isArray(items)) return '';
            return items.map((item, index) => {
                let rendered = block;
                if (typeof item === 'object' && item !== null) {
                    for (const [k, v] of Object.entries(item)) {
                        rendered = rendered.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
                    }
                }
                rendered = rendered.replace(/\{\{this\}\}/g, String(item));
                rendered = rendered.replace(/\{\{@index\}\}/g, String(index));
                return rendered;
            }).join('');
        });

        // Variable interpolation with filters: {{name|filter:arg}}
        result = result.replace(/\{\{(\w+(?:\.\w+)*)(?:\|(\w+)(?::([^}]*))?)?\}\}/g, (_, key, filterName, filterArg) => {
            let value = this.resolve(key, context);
            if (filterName) {
                const filter = this.filters.get(filterName);
                if (filter) value = filter(value, filterArg);
            }
            return value !== undefined && value !== null ? String(value) : '';
        });

        return result;
    }

    /**
     * Render a registered template.
     */
    renderNamed(name: string, context: TemplateContext = {}): string {
        const template = this.templates.get(name);
        if (!template) throw new Error(`Template "${name}" not found`);
        return this.render(template, context);
    }

    /**
     * List registered templates.
     */
    listTemplates(): string[] {
        return Array.from(this.templates.keys());
    }

    /**
     * List registered filters.
     */
    listFilters(): string[] {
        return Array.from(this.filters.keys());
    }

    // === Private ===

    private resolve(key: string, context: TemplateContext): unknown {
        const parts = key.split('.');
        let current: unknown = context;
        for (const part of parts) {
            if (current == null || typeof current !== 'object') return undefined;
            current = (current as Record<string, unknown>)[part];
        }
        return current;
    }
}
