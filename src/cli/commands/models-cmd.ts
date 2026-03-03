/**
 * CoreBlow CLI — `coreblow models` command
 *
 * List and query available AI models from configured providers.
 * Reads the active config to determine which providers are set up
 * and displays their model catalogs.
 *
 * @packageDocumentation
 */

import type { Command } from 'commander';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const bold = '\x1b[1m';
const dim = '\x1b[2m';
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const reset = '\x1b[0m';

// ─── Built-in Model Catalog ─────────────────────────────────────

interface ModelEntry {
    id: string;
    displayName: string;
    provider: string;
    contextWindow: number;
    maxOutput?: number;
    tags: string[];
}

/**
 * Static catalog of well-known models.
 * Updated periodically; users can also query live APIs.
 */
const MODEL_CATALOG: ModelEntry[] = [
    // OpenAI
    { id: 'gpt-4o', displayName: 'GPT-4o', provider: 'openai', contextWindow: 128_000, maxOutput: 16_384, tags: ['flagship', 'vision', 'tools'] },
    { id: 'gpt-4o-mini', displayName: 'GPT-4o Mini', provider: 'openai', contextWindow: 128_000, maxOutput: 16_384, tags: ['fast', 'cheap'] },
    { id: 'gpt-4-turbo', displayName: 'GPT-4 Turbo', provider: 'openai', contextWindow: 128_000, maxOutput: 4_096, tags: ['vision'] },
    { id: 'o3-mini', displayName: 'o3-mini', provider: 'openai', contextWindow: 200_000, maxOutput: 100_000, tags: ['reasoning'] },
    // Anthropic
    { id: 'claude-sonnet-4-20250514', displayName: 'Claude Sonnet 4', provider: 'anthropic', contextWindow: 200_000, maxOutput: 64_000, tags: ['flagship', 'vision', 'tools'] },
    { id: 'claude-3-5-haiku-20241022', displayName: 'Claude 3.5 Haiku', provider: 'anthropic', contextWindow: 200_000, maxOutput: 8_192, tags: ['fast', 'cheap'] },
    // Google
    { id: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', provider: 'google', contextWindow: 1_048_576, maxOutput: 65_536, tags: ['flagship', 'thinking', 'vision'] },
    { id: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', provider: 'google', contextWindow: 1_048_576, maxOutput: 65_536, tags: ['fast', 'thinking'] },
    // DeepSeek
    { id: 'deepseek-chat', displayName: 'DeepSeek V3', provider: 'deepseek', contextWindow: 64_000, maxOutput: 8_192, tags: ['cheap', 'code'] },
    { id: 'deepseek-reasoner', displayName: 'DeepSeek R1', provider: 'deepseek', contextWindow: 64_000, maxOutput: 8_192, tags: ['reasoning'] },
    // Ollama (local)
    { id: 'llama3.3:latest', displayName: 'Llama 3.3', provider: 'ollama', contextWindow: 128_000, maxOutput: 4_096, tags: ['local', 'open'] },
    { id: 'qwen2.5:latest', displayName: 'Qwen 2.5', provider: 'ollama', contextWindow: 128_000, maxOutput: 4_096, tags: ['local', 'open'] },
];

// ─── Config Reading ──────────────────────────────────────────────

function getActiveProvider(): { provider: string; model: string } | null {
    const configPath = path.join(os.homedir(), '.coreblow', 'coreblow.json');
    try {
        const raw = fs.readFileSync(configPath, 'utf8');
        const cfg = JSON.parse(raw) as Record<string, unknown>;
        const provider = (cfg.provider as string) ?? (cfg.activeProvider as string);
        const model = (cfg.model as string) ?? (cfg.activeModel as string);
        if (provider && model) {
            return { provider, model };
        }
    } catch {
        // no config
    }
    return null;
}

// ─── Format Helpers ──────────────────────────────────────────────

function formatContext(tokens: number): string {
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
    return `${(tokens / 1_000).toFixed(0)}K`;
}

function formatTags(tags: string[]): string {
    return tags.map(t => `${dim}#${t}${reset}`).join(' ');
}

// ─── Command Registration ───────────────────────────────────────

export function registerModelsCommand(parent: Command): void {
    const cmd = parent
        .command('models')
        .description('List available AI models');

    cmd.command('list')
        .alias('ls')
        .description('List known models from all providers')
        .option('--provider <name>', 'Filter by provider')
        .option('--tag <tag>', 'Filter by tag (e.g. flagship, fast, reasoning)')
        .option('--json', 'Output as JSON')
        .action((opts: { provider?: string; tag?: string; json?: boolean }) => {
            let models = [...MODEL_CATALOG];

            if (opts.provider) {
                models = models.filter(m => m.provider === opts.provider);
            }
            if (opts.tag) {
                models = models.filter(m => m.tags.includes(opts.tag!));
            }

            if (opts.json) {
                console.log(JSON.stringify(models, null, 2));
                return;
            }

            const active = getActiveProvider();

            console.log(`\n  ${bold}Available Models${reset}\n`);

            // Group by provider
            const grouped = new Map<string, ModelEntry[]>();
            for (const m of models) {
                const list = grouped.get(m.provider) ?? [];
                list.push(m);
                grouped.set(m.provider, list);
            }

            for (const [provider, providerModels] of grouped) {
                console.log(`  ${cyan}${bold}${provider}${reset}`);
                for (const m of providerModels) {
                    const isActive = active?.provider === provider && active?.model === m.id;
                    const marker = isActive ? ` ${green}◀ active${reset}` : '';
                    const ctx = formatContext(m.contextWindow);
                    console.log(`    ${m.id.padEnd(35)} ${dim}${ctx} ctx${reset}  ${formatTags(m.tags)}${marker}`);
                }
                console.log();
            }

            if (models.length === 0) {
                console.log(`  ${dim}No models found matching filters.${reset}\n`);
            }
        });

    // Shortcut: `coreblow models` without subcommand = list
    cmd.action(() => {
        cmd.commands.find(c => c.name() === 'list')?.parse(process.argv);
    });
}
