/**
 * CoreBlow — Route Docs
 *
 * Generates human-readable documentation for
 * registered API routes with examples.
 */

/** Route doc */
export interface RouteDoc {
    method: string;
    path: string;
    summary: string;
    description?: string;
    auth?: string;
    params?: Array<{ name: string; type: string; description: string; required: boolean }>;
    requestExample?: unknown;
    responseExample?: unknown;
    tags?: string[];
}

/**
 * CoreBlow Route Docs
 */
export class RouteDocs {
    private docs: RouteDoc[] = [];

    /**
     * Add route documentation.
     */
    add(doc: RouteDoc): void { this.docs.push(doc); }

    /**
     * Get docs by tag.
     */
    getByTag(tag: string): RouteDoc[] {
        return this.docs.filter((d) => d.tags?.includes(tag));
    }

    /**
     * Get all tags.
     */
    getTags(): string[] {
        const tags = new Set<string>();
        for (const doc of this.docs) {
            if (doc.tags) doc.tags.forEach((t) => tags.add(t));
        }
        return Array.from(tags);
    }

    /**
     * Generate markdown documentation.
     */
    toMarkdown(): string {
        const lines: string[] = ['# API Routes\n'];
        const tags = this.getTags();

        for (const tag of tags) {
            lines.push(`## ${tag}\n`);
            for (const doc of this.getByTag(tag)) {
                lines.push(`### \`${doc.method.toUpperCase()} ${doc.path}\``);
                lines.push(`\n${doc.summary}\n`);
                if (doc.description) lines.push(`${doc.description}\n`);
                if (doc.auth) lines.push(`**Auth:** ${doc.auth}\n`);
                if (doc.params && doc.params.length > 0) {
                    lines.push('**Parameters:**\n');
                    lines.push('| Name | Type | Required | Description |');
                    lines.push('|------|------|----------|-------------|');
                    for (const p of doc.params) {
                        lines.push(`| ${p.name} | ${p.type} | ${p.required ? 'Yes' : 'No'} | ${p.description} |`);
                    }
                    lines.push('');
                }
                if (doc.requestExample) {
                    lines.push('**Request:**\n```json');
                    lines.push(JSON.stringify(doc.requestExample, null, 2));
                    lines.push('```\n');
                }
                if (doc.responseExample) {
                    lines.push('**Response:**\n```json');
                    lines.push(JSON.stringify(doc.responseExample, null, 2));
                    lines.push('```\n');
                }
            }
        }

        // Untagged
        const untagged = this.docs.filter((d) => !d.tags || d.tags.length === 0);
        if (untagged.length > 0) {
            lines.push('## Other\n');
            for (const doc of untagged) {
                lines.push(`### \`${doc.method.toUpperCase()} ${doc.path}\`\n${doc.summary}\n`);
            }
        }

        return lines.join('\n');
    }

    /**
     * Search docs.
     */
    search(query: string): RouteDoc[] {
        const q = query.toLowerCase();
        return this.docs.filter((d) => d.summary.toLowerCase().includes(q) || d.path.toLowerCase().includes(q));
    }

    /** Count */
    count(): number { return this.docs.length; }
}
