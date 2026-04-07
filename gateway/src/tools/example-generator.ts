/**
 * CoreBlow — Example Generator
 *
 * Generates example request/response payloads,
 * code snippets, and cURL commands for API docs.
 */

/** Example config */
export interface ExampleConfig {
    method: string;
    path: string;
    baseUrl: string;
    headers?: Record<string, string>;
    body?: unknown;
    response?: unknown;
}

/**
 * CoreBlow Example Generator
 */
export class ExampleGenerator {
    private defaultBaseUrl = 'http://localhost:3000';
    private defaultHeaders: Record<string, string> = { 'Content-Type': 'application/json' };

    /**
     * Set defaults.
     */
    setDefaults(baseUrl: string, headers?: Record<string, string>): void {
        this.defaultBaseUrl = baseUrl;
        if (headers) this.defaultHeaders = headers;
    }

    /**
     * Generate cURL command.
     */
    toCurl(config: Partial<ExampleConfig> & { method: string; path: string }): string {
        const url = `${config.baseUrl ?? this.defaultBaseUrl}${config.path}`;
        const parts = [`curl -X ${config.method.toUpperCase()} '${url}'`];
        const headers = { ...this.defaultHeaders, ...config.headers };
        for (const [key, value] of Object.entries(headers)) {
            parts.push(`  -H '${key}: ${value}'`);
        }
        if (config.body) {
            parts.push(`  -d '${JSON.stringify(config.body)}'`);
        }
        return parts.join(' \\\n');
    }

    /**
     * Generate fetch snippet.
     */
    toFetch(config: Partial<ExampleConfig> & { method: string; path: string }): string {
        const url = `${config.baseUrl ?? this.defaultBaseUrl}${config.path}`;
        const headers = { ...this.defaultHeaders, ...config.headers };
        const opts: string[] = [`  method: '${config.method.toUpperCase()}'`];
        opts.push(`  headers: ${JSON.stringify(headers)}`);
        if (config.body) opts.push(`  body: JSON.stringify(${JSON.stringify(config.body)})`);
        return `const response = await fetch('${url}', {\n${opts.join(',\n')}\n});\nconst data = await response.json();`;
    }

    /**
     * Generate Python requests snippet.
     */
    toPython(config: Partial<ExampleConfig> & { method: string; path: string }): string {
        const url = `${config.baseUrl ?? this.defaultBaseUrl}${config.path}`;
        const headers = { ...this.defaultHeaders, ...config.headers };
        const lines = ['import requests', ''];
        if (config.body) {
            lines.push(`response = requests.${config.method.toLowerCase()}(`);
            lines.push(`    '${url}',`);
            lines.push(`    headers=${JSON.stringify(headers)},`);
            lines.push(`    json=${JSON.stringify(config.body)}`);
            lines.push(')');
        } else {
            lines.push(`response = requests.${config.method.toLowerCase()}('${url}', headers=${JSON.stringify(headers)})`);
        }
        lines.push('data = response.json()');
        return lines.join('\n');
    }

    /**
     * Generate full example block.
     */
    toMarkdown(config: Partial<ExampleConfig> & { method: string; path: string }): string {
        const lines: string[] = [];
        lines.push('#### cURL\n```bash');
        lines.push(this.toCurl(config));
        lines.push('```\n');
        lines.push('#### JavaScript\n```javascript');
        lines.push(this.toFetch(config));
        lines.push('```\n');
        lines.push('#### Python\n```python');
        lines.push(this.toPython(config));
        lines.push('```\n');
        if (config.response) {
            lines.push('#### Response\n```json');
            lines.push(JSON.stringify(config.response, null, 2));
            lines.push('```');
        }
        return lines.join('\n');
    }
}
