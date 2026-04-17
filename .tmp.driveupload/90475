/**
 * markdown/frontmatter.ts
 * YAML frontmatter parsing and extraction.
 * Ported from OpenClaw src/markdown/frontmatter.ts.
 */

export interface FrontmatterResult {
    frontmatter: Record<string, unknown>;
    content: string;
    hasFrontmatter: boolean;
}

/**
 * Extract YAML frontmatter from markdown.
 */
export function extractFrontmatter(markdown: string): FrontmatterResult {
    const trimmed = markdown.trimStart();
    if (!trimmed.startsWith('---')) return { frontmatter: {}, content: markdown, hasFrontmatter: false };

    const endIdx = trimmed.indexOf('\n---', 3);
    if (endIdx < 0) return { frontmatter: {}, content: markdown, hasFrontmatter: false };

    const yamlBlock = trimmed.slice(4, endIdx);
    const content = trimmed.slice(endIdx + 4).trimStart();
    const frontmatter = parseSimpleYaml(yamlBlock);

    return { frontmatter, content, hasFrontmatter: true };
}

/**
 * Simple YAML parser (key: value pairs, no nested objects).
 */
function parseSimpleYaml(yaml: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const lines = yaml.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const colonIdx = trimmed.indexOf(':');
        if (colonIdx < 0) continue;

        const key = trimmed.slice(0, colonIdx).trim();
        const rawValue = trimmed.slice(colonIdx + 1).trim();
        result[key] = parseYamlValue(rawValue);
    }

    return result;
}

function parseYamlValue(raw: string): unknown {
    if (!raw || raw === 'null' || raw === '~') return null;
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    const num = Number(raw);
    if (!isNaN(num) && raw !== '') return num;
    // Strip quotes
    if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) return raw.slice(1, -1);
    // Array
    if (raw.startsWith('[') && raw.endsWith(']')) {
        return raw.slice(1, -1).split(',').map((s) => parseYamlValue(s.trim()));
    }
    return raw;
}

/**
 * Add or update frontmatter.
 */
export function setFrontmatter(markdown: string, updates: Record<string, unknown>): string {
    const { frontmatter, content, hasFrontmatter } = extractFrontmatter(markdown);
    const merged = { ...frontmatter, ...updates };
    const yaml = Object.entries(merged).map(([k, v]) => `${k}: ${formatYamlValue(v)}`).join('\n');
    return `---\n${yaml}\n---\n\n${content}`;
}

function formatYamlValue(value: unknown): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return String(value);
    if (typeof value === 'number') return String(value);
    if (Array.isArray(value)) return `[${value.map(formatYamlValue).join(', ')}]`;
    const str = String(value);
    if (str.includes(':') || str.includes('#') || str.includes("'")) return `"${str}"`;
    return str;
}
