/**
 * plugin-sdk/cli-scaffold.ts
 *
 * Plugin project scaffold generator.
 * Generates boilerplate files for new CoreBlow plugins with
 * sensible defaults, TypeScript config, tests, and documentation.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('plugin:scaffold');

// ─── Types ───────────────────────────────────────────────────────

/** Scaffold options */
export interface ScaffoldOptions {
    /** Plugin name (kebab-case) */
    name: string;
    /** Target directory (default: ./<name>) */
    targetDir?: string;
    /** Plugin description */
    description?: string;
    /** Author name */
    author?: string;
    /** License */
    license?: string;
    /** Template type */
    template?: ScaffoldTemplate;
    /** Include example tool */
    withTool?: boolean;
    /** Include example hook */
    withHook?: boolean;
    /** Include example command */
    withCommand?: boolean;
    /** Include config schema */
    withConfig?: boolean;
    /** Include test setup */
    withTests?: boolean;
    /** Overwrite if directory exists */
    overwrite?: boolean;
}

/** Available templates */
export type ScaffoldTemplate = 'basic' | 'tool' | 'channel' | 'provider' | 'full';

/** Scaffold result */
export interface ScaffoldResult {
    success: boolean;
    targetDir: string;
    filesCreated: string[];
    errors: string[];
}

// ─── Templates ───────────────────────────────────────────────────

function generatePluginJson(opts: Required<ScaffoldOptions>): string {
    const manifest: Record<string, unknown> = {
        name: opts.name,
        version: '0.1.0',
        description: opts.description,
        author: opts.author,
        license: opts.license,
        main: 'dist/index.js',
        permissions: ['network'],
        coreblow: {
            minVersion: '1.0.0',
        },
    };
    return JSON.stringify(manifest, null, 2) + '\n';
}

function generatePackageJson(opts: Required<ScaffoldOptions>): string {
    return JSON.stringify({
        name: `coreblow-plugin-${opts.name}`,
        version: '0.1.0',
        description: opts.description,
        author: opts.author,
        license: opts.license,
        type: 'module',
        main: 'dist/index.js',
        types: 'dist/index.d.ts',
        scripts: {
            build: 'tsc',
            dev: 'tsc --watch',
            test: 'vitest run',
            'test:watch': 'vitest',
            lint: 'tsc --noEmit',
        },
        devDependencies: {
            typescript: '^5.4.0',
            vitest: '^1.6.0',
        },
    }, null, 2) + '\n';
}

function generateTsConfig(): string {
    return JSON.stringify({
        compilerOptions: {
            target: 'ES2022',
            module: 'ESNext',
            moduleResolution: 'bundler',
            outDir: './dist',
            rootDir: './src',
            declaration: true,
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            forceConsistentCasingInFileNames: true,
        },
        include: ['src/**/*.ts'],
        exclude: ['node_modules', 'dist'],
    }, null, 2) + '\n';
}

function generateIndexTs(opts: Required<ScaffoldOptions>): string {
    const imports: string[] = [];
    const pluginParts: string[] = [];

    if (opts.withTool || opts.template === 'tool' || opts.template === 'full') {
        imports.push("import { exampleTool } from './tools.js';");
        pluginParts.push('    tools: [exampleTool],');
    }
    if (opts.withHook || opts.template === 'full') {
        imports.push("import { messageHook } from './hooks.js';");
        pluginParts.push('    hooks: [messageHook],');
    }
    if (opts.withCommand || opts.template === 'full') {
        imports.push("import { statusCommand } from './commands.js';");
        pluginParts.push('    commands: [statusCommand],');
    }
    if (opts.withConfig || opts.template === 'full') {
        imports.push("import { configSchema } from './config.js';");
        pluginParts.push('    configSchema,');
    }

    return `/**
 * ${opts.name} — CoreBlow Plugin
 *
 * ${opts.description}
 */

${imports.length > 0 ? imports.join('\n') + '\n' : ''}
export default {
    meta: {
        name: '${opts.name}',
        version: '0.1.0',
        description: '${opts.description}',
        author: '${opts.author}',
    },

${pluginParts.join('\n')}

    async activate(ctx) {
        ctx.log.info('${opts.name} activated');
    },

    async deactivate(ctx) {
        ctx.log.info('${opts.name} deactivated');
    },
};
`;
}

function generateToolsTs(opts: Required<ScaffoldOptions>): string {
    return `/**
 * ${opts.name} — Tools
 */

export const exampleTool = {
    name: '${opts.name}_search',
    description: 'Example tool for ${opts.name}',
    parameters: {
        query: { type: 'string', description: 'Search query', required: true },
    },
    async execute(args: Record<string, unknown>) {
        const query = String(args.query ?? '');
        return \`Results for: \${query}\`;
    },
};
`;
}

function generateHooksTs(opts: Required<ScaffoldOptions>): string {
    return `/**
 * ${opts.name} — Hooks
 */

export const messageHook = {
    event: 'message_received',
    priority: 50,
    async handler(event: unknown, ctx: Record<string, unknown>) {
        // Process incoming messages
        return undefined;
    },
};
`;
}

function generateCommandsTs(opts: Required<ScaffoldOptions>): string {
    return `/**
 * ${opts.name} — Commands
 */

export const statusCommand = {
    name: '/${opts.name}',
    description: '${opts.name} status',
    async handler(args?: string[]) {
        return '${opts.name} is running!';
    },
};
`;
}

function generateConfigTs(opts: Required<ScaffoldOptions>): string {
    return `/**
 * ${opts.name} — Config Schema
 */

export const configSchema = {
    validate(value: unknown) {
        if (!value || typeof value !== 'object') {
            return { ok: false as const, errors: ['Config must be an object'] };
        }
        return { ok: true as const, value };
    },
    uiHints: {
        apiKey: { label: 'API Key', sensitive: true },
    },
    jsonSchema: {
        type: 'object',
        properties: {
            apiKey: { type: 'string', description: 'API key for the service' },
            enabled: { type: 'boolean', default: true },
        },
    },
};
`;
}

function generateTestTs(opts: Required<ScaffoldOptions>): string {
    const imports: string[] = ["import { describe, it, expect } from 'vitest';"];
    const tests: string[] = [];

    if (opts.withTool || opts.template === 'tool' || opts.template === 'full') {
        imports.push("import { exampleTool } from '../src/tools.js';");
        tests.push(`
    describe('exampleTool', () => {
        it('should execute with query', async () => {
            const result = await exampleTool.execute({ query: 'test' });
            expect(result).toContain('test');
        });
    });`);
    }

    if (opts.withCommand || opts.template === 'full') {
        imports.push("import { statusCommand } from '../src/commands.js';");
        tests.push(`
    describe('statusCommand', () => {
        it('should return status', async () => {
            const result = await statusCommand.handler();
            expect(result).toContain('running');
        });
    });`);
    }

    if (tests.length === 0) {
        tests.push(`
    it('should load plugin', async () => {
        const plugin = await import('../src/index.js');
        expect(plugin.default.meta.name).toBe('${opts.name}');
    });`);
    }

    return `${imports.join('\n')}

describe('${opts.name}', () => {${tests.join('\n')}
});
`;
}

function generateReadme(opts: Required<ScaffoldOptions>): string {
    return `# ${opts.name}

${opts.description}

## Installation

\`\`\`bash
coreblow plugin install ./${opts.name}
\`\`\`

## Configuration

Add to your \`config.json\`:

\`\`\`json
{
  "plugins": {
    "${opts.name}": {
      "enabled": true
    }
  }
}
\`\`\`

## Development

\`\`\`bash
npm install
npm run dev       # Watch mode
npm test          # Run tests
npm run build     # Production build
\`\`\`

## License

${opts.license}
`;
}

function generateGitignore(): string {
    return `node_modules/
dist/
*.tsbuildinfo
.env
.env.*
`;
}

// ─── PluginScaffold ──────────────────────────────────────────────

/**
 * CoreBlow Plugin Scaffold Generator
 *
 * Generates a complete plugin project with TypeScript config,
 * manifest, source files, tests, and documentation.
 */
export class PluginScaffold {
    /**
     * Generate a new plugin project.
     */
    generate(options: ScaffoldOptions): ScaffoldResult {
        const opts = this.resolveDefaults(options);
        const result: ScaffoldResult = {
            success: false,
            targetDir: opts.targetDir,
            filesCreated: [],
            errors: [],
        };

        try {
            // Check directory
            if (fs.existsSync(opts.targetDir)) {
                if (!opts.overwrite) {
                    result.errors.push(`Directory already exists: ${opts.targetDir}`);
                    return result;
                }
            }

            // Create directory structure
            this.ensureDir(opts.targetDir);
            this.ensureDir(path.join(opts.targetDir, 'src'));

            // always-generated files
            const files: Array<[string, string]> = [
                ['plugin.json', generatePluginJson(opts)],
                ['package.json', generatePackageJson(opts)],
                ['tsconfig.json', generateTsConfig()],
                ['README.md', generateReadme(opts)],
                ['.gitignore', generateGitignore()],
                ['src/index.ts', generateIndexTs(opts)],
            ];

            // optional files based on template/flags
            if (opts.withTool || opts.template === 'tool' || opts.template === 'full') {
                files.push(['src/tools.ts', generateToolsTs(opts)]);
            }
            if (opts.withHook || opts.template === 'full') {
                files.push(['src/hooks.ts', generateHooksTs(opts)]);
            }
            if (opts.withCommand || opts.template === 'full') {
                files.push(['src/commands.ts', generateCommandsTs(opts)]);
            }
            if (opts.withConfig || opts.template === 'full') {
                files.push(['src/config.ts', generateConfigTs(opts)]);
            }
            if (opts.withTests || opts.template === 'full') {
                this.ensureDir(path.join(opts.targetDir, 'tests'));
                files.push(['tests/plugin.test.ts', generateTestTs(opts)]);
            }

            // Write files
            for (const [relativePath, content] of files) {
                const fullPath = path.join(opts.targetDir, relativePath);
                this.ensureDir(path.dirname(fullPath));
                fs.writeFileSync(fullPath, content, 'utf-8');
                result.filesCreated.push(relativePath);
            }

            result.success = true;
            log.info({ name: opts.name, dir: opts.targetDir, files: result.filesCreated.length }, 'Plugin scaffolded');
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            result.errors.push(msg);
            log.error({ err: msg }, 'Scaffold failed');
        }

        return result;
    }

    /**
     * List available templates.
     */
    listTemplates(): Array<{ name: ScaffoldTemplate; description: string }> {
        return [
            { name: 'basic', description: 'Minimal plugin with activate/deactivate' },
            { name: 'tool', description: 'Plugin with an example tool' },
            { name: 'channel', description: 'Channel adapter plugin' },
            { name: 'provider', description: 'LLM provider plugin' },
            { name: 'full', description: 'Full plugin with tools, hooks, commands, config, and tests' },
        ];
    }

    /**
     * Validate a plugin name.
     */
    validateName(name: string): { valid: boolean; reason?: string } {
        if (!name) return { valid: false, reason: 'Name is required' };
        if (name.length < 2) return { valid: false, reason: 'Name must be at least 2 characters' };
        if (name.length > 50) return { valid: false, reason: 'Name must be at most 50 characters' };
        if (!/^[a-z][a-z0-9-]*$/.test(name)) {
            return { valid: false, reason: 'Name must be lowercase alphanumeric with dashes, starting with a letter' };
        }
        if (name.startsWith('coreblow-')) {
            return { valid: false, reason: 'Name should not start with "coreblow-" (added automatically)' };
        }
        return { valid: true };
    }

    // ─── Private ─────────────────────────────────────────────────

    private resolveDefaults(opts: ScaffoldOptions): Required<ScaffoldOptions> {
        return {
            name: opts.name,
            targetDir: opts.targetDir ?? path.resolve(opts.name),
            description: opts.description ?? `CoreBlow plugin: ${opts.name}`,
            author: opts.author ?? '',
            license: opts.license ?? 'MIT',
            template: opts.template ?? 'basic',
            withTool: opts.withTool ?? (opts.template === 'tool' || opts.template === 'full'),
            withHook: opts.withHook ?? (opts.template === 'full'),
            withCommand: opts.withCommand ?? (opts.template === 'full'),
            withConfig: opts.withConfig ?? (opts.template === 'full'),
            withTests: opts.withTests ?? true,
            overwrite: opts.overwrite ?? false,
        };
    }

    private ensureDir(dir: string): void {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
}
