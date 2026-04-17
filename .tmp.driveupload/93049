/**
 * CoreBlow — SDK Builder
 *
 * Generates SDK client code for multiple languages
 * from API route definitions. Supports TypeScript,
 * Python, and cURL snippet generation.
 */

/** SDK endpoint */
export interface SDKEndpoint {
    path: string;
    method: string;
    name: string;
    description?: string;
    params?: Array<{ name: string; type: string; required: boolean }>;
    responseType?: string;
}

/** SDK config */
export interface SDKConfig {
    baseUrl: string;
    apiName: string;
    version: string;
    endpoints: SDKEndpoint[];
}

/**
 * CoreBlow SDK Builder
 */
export class SDKBuilder {
    /**
     * Generate TypeScript SDK.
     */
    generateTypeScript(config: SDKConfig): string {
        const lines: string[] = [
            `// ${config.apiName} SDK v${config.version}`,
            `// Auto-generated — do not edit`,
            ``,
            `export class ${this.toPascal(config.apiName)}Client {`,
            `  private baseUrl: string;`,
            `  private headers: Record<string, string>;`,
            ``,
            `  constructor(baseUrl: string = '${config.baseUrl}', apiKey?: string) {`,
            `    this.baseUrl = baseUrl;`,
            `    this.headers = { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: \`Bearer \${apiKey}\` } : {}) };`,
            `  }`,
        ];

        for (const ep of config.endpoints) {
            const params = ep.params?.map((p) => `${p.name}${p.required ? '' : '?'}: ${p.type}`).join(', ') ?? '';
            lines.push('');
            if (ep.description) lines.push(`  /** ${ep.description} */`);
            lines.push(`  async ${ep.name}(${params}): Promise<any> {`);
            if (ep.method === 'GET') {
                lines.push(`    const res = await fetch(\`\${this.baseUrl}${ep.path}\`, { headers: this.headers });`);
            } else {
                const bodyParams = ep.params?.filter((p) => p.name !== 'id') ?? [];
                const body = bodyParams.length > 0 ? `{ ${bodyParams.map((p) => p.name).join(', ')} }` : '{}';
                lines.push(`    const res = await fetch(\`\${this.baseUrl}${ep.path}\`, { method: '${ep.method}', headers: this.headers, body: JSON.stringify(${body}) });`);
            }
            lines.push(`    return res.json();`);
            lines.push(`  }`);
        }

        lines.push('}');
        return lines.join('\n');
    }

    /**
     * Generate Python SDK.
     */
    generatePython(config: SDKConfig): string {
        const lines: string[] = [
            `# ${config.apiName} SDK v${config.version}`,
            `# Auto-generated — do not edit`,
            `import requests`,
            ``,
            `class ${this.toPascal(config.apiName)}Client:`,
            `    def __init__(self, base_url='${config.baseUrl}', api_key=None):`,
            `        self.base_url = base_url`,
            `        self.headers = {'Content-Type': 'application/json'}`,
            `        if api_key:`,
            `            self.headers['Authorization'] = f'Bearer {api_key}'`,
        ];

        for (const ep of config.endpoints) {
            const params = ep.params?.map((p) => `${this.toSnake(p.name)}`) ?? [];
            const allParams = ['self', ...params].join(', ');
            lines.push('');
            lines.push(`    def ${this.toSnake(ep.name)}(${allParams}):`);
            if (ep.method === 'GET') {
                lines.push(`        return requests.get(f'{self.base_url}${ep.path}', headers=self.headers).json()`);
            } else {
                lines.push(`        data = {${params.map((p) => `'${p}': ${p}`).join(', ')}}`);
                lines.push(`        return requests.${ep.method.toLowerCase()}(f'{self.base_url}${ep.path}', json=data, headers=self.headers).json()`);
            }
        }

        return lines.join('\n');
    }

    /**
     * Generate cURL snippets.
     */
    generateCurl(config: SDKConfig): string {
        return config.endpoints.map((ep) => {
            const parts = [`curl -X ${ep.method} '${config.baseUrl}${ep.path}'`];
            parts.push(`  -H 'Content-Type: application/json'`);
            parts.push(`  -H 'Authorization: Bearer YOUR_API_KEY'`);
            if (ep.method !== 'GET' && ep.params?.length) {
                const body = Object.fromEntries(ep.params.map((p) => [p.name, `<${p.type}>`]));
                parts.push(`  -d '${JSON.stringify(body)}'`);
            }
            return `# ${ep.name}\n${parts.join(' \\\n')}`;
        }).join('\n\n');
    }

    /**
     * List supported languages.
     */
    supportedLanguages(): string[] {
        return ['typescript', 'python', 'curl'];
    }

    // === Helpers ===
    private toPascal(s: string): string { return s.replace(/(^|[-_ ])(\w)/g, (_, __, c) => c.toUpperCase()); }
    private toSnake(s: string): string { return s.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, ''); }
}
