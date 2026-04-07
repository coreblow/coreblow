/**
 * cli/plugin-commands.ts
 *
 * CLI commands for plugin management:
 *   /plugin create <name>   — Scaffold a new plugin
 *   /plugin install <path>  — Install a plugin
 *   /plugin uninstall <id>  — Uninstall a plugin
 *   /plugin list            — List installed plugins
 *   /plugin status [id]     — Show plugin status
 *   /plugin enable <id>     — Enable a plugin
 *   /plugin disable <id>    — Disable a plugin
 *   /plugin search <query>  — Search marketplace
 *   /plugin info <id>       — Show plugin details
 *   /plugin doctor          — Run plugin diagnostics
 */

import { createChildLogger } from '../utils/logger.js';
import { PluginScaffold } from '../plugin-sdk/cli-scaffold.js';
import { PluginInstaller } from '../plugins/install.js';
import { PluginMarketplace } from '../plugins/marketplace.js';
import { PluginStatusReporter } from '../plugins/status.js';
import { PluginConfigState } from '../plugins/config-state.js';
import {
    createPluginRecord,
    createEmptyPluginRegistryData,
    type PluginRecord,
    type PluginRegistryData,
} from '../plugins/types.js';

const log = createChildLogger('cli:plugin');

// ─── Types ───────────────────────────────────────────────────────

export interface PluginCommandContext {
    registryData?: PluginRegistryData;
    pluginsDir?: string;
    workspaceDir?: string;
}

export interface PluginCommandResult {
    output: string;
    error?: string;
    success: boolean;
}

// ─── PluginCommands ──────────────────────────────────────────────

/**
 * CoreBlow Plugin CLI Commands
 *
 * Provides all `/plugin` subcommands for the CLI and chat interface.
 */
export class PluginCommands {
    private scaffold = new PluginScaffold();
    private installer = new PluginInstaller();
    private marketplace = new PluginMarketplace();
    private statusReporter = new PluginStatusReporter();
    private configState = new PluginConfigState();
    private context: PluginCommandContext;

    constructor(context?: Partial<PluginCommandContext>) {
        this.context = {
            registryData: context?.registryData ?? createEmptyPluginRegistryData(),
            pluginsDir: context?.pluginsDir ?? '~/.coreblow/plugins',
            workspaceDir: context?.workspaceDir ?? process.cwd(),
        };
    }

    /**
     * Route a /plugin command to the appropriate handler.
     */
    async execute(subcommand: string, args: string[], flags: Record<string, string | boolean> = {}): Promise<PluginCommandResult> {
        switch (subcommand) {
            case 'create': return this.create(args, flags);
            case 'install': return this.install(args, flags);
            case 'uninstall': return this.uninstall(args);
            case 'list': return this.list(flags);
            case 'status': return this.status(args);
            case 'enable': return this.enable(args);
            case 'disable': return this.disable(args);
            case 'search': return this.search(args, flags);
            case 'info': return this.info(args);
            case 'doctor': return this.doctor();
            case 'templates': return this.templates();
            default: return this.help();
        }
    }

    // ─── Subcommands ─────────────────────────────────────────────

    /**
     * /plugin create <name> [--template=<type>] [--full]
     */
    private create(args: string[], flags: Record<string, string | boolean>): PluginCommandResult {
        const name = args[0];
        if (!name) {
            return { output: '', error: 'Usage: /plugin create <name> [--template=basic|tool|channel|provider|full]', success: false };
        }

        const validation = this.scaffold.validateName(name);
        if (!validation.valid) {
            return { output: '', error: `Invalid plugin name: ${validation.reason}`, success: false };
        }

        const template = (typeof flags.template === 'string' ? flags.template : (flags.full ? 'full' : 'basic')) as 'basic' | 'tool' | 'channel' | 'provider' | 'full';
        const result = this.scaffold.generate({
            name,
            template,
            description: typeof flags.description === 'string' ? flags.description : undefined,
            author: typeof flags.author === 'string' ? flags.author : undefined,
            overwrite: !!flags.overwrite,
            withTests: true,
        });

        if (!result.success) {
            return { output: '', error: result.errors.join('\n'), success: false };
        }

        const lines = [
            `✅ Plugin "${name}" created successfully!`,
            '',
            `  📁 ${result.targetDir}`,
            `  📄 ${result.filesCreated.length} files generated`,
            '',
            '  Next steps:',
            `    cd ${name}`,
            '    npm install',
            '    npm run dev',
            '',
            `  Install: coreblow plugin install ./${name}`,
        ];

        return { output: lines.join('\n'), success: true };
    }

    /**
     * /plugin install <path>
     */
    private async install(args: string[], flags: Record<string, string | boolean>): Promise<PluginCommandResult> {
        const source = args[0];
        if (!source) {
            return { output: '', error: 'Usage: /plugin install <path|npm-package>', success: false };
        }

        const targetDir = this.context.pluginsDir!;
        const result = await this.installer.installFromLocal(source, targetDir);

        if (!result.success) {
            return { output: '', error: `Installation failed: ${result.error}`, success: false };
        }

        return {
            output: `✅ Plugin "${result.pluginId}" installed successfully to ${targetDir}`,
            success: true,
        };
    }

    /**
     * /plugin uninstall <id>
     */
    private async uninstall(args: string[]): Promise<PluginCommandResult> {
        const pluginId = args[0];
        if (!pluginId) {
            return { output: '', error: 'Usage: /plugin uninstall <plugin-id>', success: false };
        }

        const result = await this.installer.uninstall(pluginId);
        if (!result.success) {
            return { output: '', error: `Uninstall failed: ${result.error}`, success: false };
        }

        return { output: `✅ Plugin "${pluginId}" uninstalled.`, success: true };
    }

    /**
     * /plugin list [--all] [--json]
     */
    private list(flags: Record<string, string | boolean>): PluginCommandResult {
        const data = this.context.registryData!;
        const plugins = data.plugins;

        if (plugins.length === 0) {
            return { output: '📦 No plugins installed.', success: true };
        }

        if (flags.json) {
            return {
                output: JSON.stringify(plugins.map((p) => ({
                    id: p.id,
                    name: p.name,
                    status: p.status,
                    version: p.version,
                    origin: p.origin,
                })), null, 2),
                success: true,
            };
        }

        const lines = [`📦 Installed Plugins (${plugins.length})`, ''];
        for (const p of plugins) {
            const status = p.status === 'loaded' ? '🟢' : p.status === 'disabled' ? '🔴' : '🟡';
            const tools = p.toolNames.length > 0 ? ` [${p.toolNames.length} tools]` : '';
            const hooks = p.hookNames.length > 0 ? ` [${p.hookNames.length} hooks]` : '';
            lines.push(`  ${status} ${p.name ?? p.id} v${p.version ?? '?'}${tools}${hooks}  (${p.origin})`);
        }

        return { output: lines.join('\n'), success: true };
    }

    /**
     * /plugin status [id]
     */
    private status(args: string[]): PluginCommandResult {
        const data = this.context.registryData!;
        const pluginId = args[0];

        if (pluginId) {
            const plugin = data.plugins.find((p) => p.id === pluginId);
            if (!plugin) {
                return { output: '', error: `Plugin not found: ${pluginId}`, success: false };
            }
            const lines = [
                `📋 Plugin: ${plugin.name ?? plugin.id}`,
                `  Status: ${plugin.status}`,
                `  Version: ${plugin.version ?? 'unknown'}`,
                `  Origin: ${plugin.origin}`,
                `  Source: ${plugin.source}`,
                `  Tools: ${plugin.toolNames.join(', ') || 'none'}`,
                `  Hooks: ${plugin.hookNames.join(', ') || 'none'}`,
            ];
            return { output: lines.join('\n'), success: true };
        }

        return { output: this.statusReporter.formatForCli(data), success: true };
    }

    /**
     * /plugin enable <id>
     */
    private enable(args: string[]): PluginCommandResult {
        const pluginId = args[0];
        if (!pluginId) {
            return { output: '', error: 'Usage: /plugin enable <plugin-id>', success: false };
        }

        const plugin = this.context.registryData!.plugins.find((p) => p.id === pluginId);
        if (!plugin) {
            return { output: '', error: `Plugin not found: ${pluginId}`, success: false };
        }
        plugin.status = 'loaded';
        return { output: `✅ Plugin "${pluginId}" enabled.`, success: true };
    }

    /**
     * /plugin disable <id>
     */
    private disable(args: string[]): PluginCommandResult {
        const pluginId = args[0];
        if (!pluginId) {
            return { output: '', error: 'Usage: /plugin disable <plugin-id>', success: false };
        }

        const plugin = this.context.registryData!.plugins.find((p) => p.id === pluginId);
        if (!plugin) {
            return { output: '', error: `Plugin not found: ${pluginId}`, success: false };
        }
        plugin.status = 'disabled';
        return { output: `🔴 Plugin "${pluginId}" disabled.`, success: true };
    }

    /**
     * /plugin search <query>
     */
    private search(args: string[], flags: Record<string, string | boolean>): PluginCommandResult {
        const query = args.join(' ');
        if (!query) {
            return { output: '', error: 'Usage: /plugin search <query>', success: false };
        }

        const result = this.marketplace.search({
            query,
            limit: typeof flags.limit === 'string' ? parseInt(flags.limit, 10) : 10,
        });

        if (result.plugins.length === 0) {
            return { output: `🔍 No plugins found for "${query}".`, success: true };
        }

        const lines = [`🔍 Found ${result.total} plugin(s) for "${query}"`, ''];
        for (const p of result.plugins) {
            const verified = p.verified ? ' ✓' : '';
            lines.push(`  📦 ${p.name ?? p.id}${verified} v${p.version} — ${p.description ?? ''}`);
            if (p.downloads) lines.push(`     ⬇ ${p.downloads.toLocaleString()} downloads`);
        }

        return { output: lines.join('\n'), success: true };
    }

    /**
     * /plugin info <id>
     */
    private info(args: string[]): PluginCommandResult {
        const pluginId = args[0];
        if (!pluginId) {
            return { output: '', error: 'Usage: /plugin info <plugin-id>', success: false };
        }

        // Check installed first
        const installed = this.context.registryData!.plugins.find((p) => p.id === pluginId);
        if (installed) {
            const lines = [
                `📦 ${installed.name ?? installed.id}`,
                `  ID: ${installed.id}`,
                `  Version: ${installed.version ?? 'unknown'}`,
                `  Status: ${installed.status}`,
                `  Origin: ${installed.origin}`,
                `  Source: ${installed.source}`,
                `  Tools: ${installed.toolNames.join(', ') || 'none'}`,
                `  Hooks: ${installed.hookNames.join(', ') || 'none'}`,
                `  Channels: ${installed.channelIds?.join(', ') || 'none'}`,
            ];
            return { output: lines.join('\n'), success: true };
        }

        return { output: '', error: `Plugin not found: ${pluginId}`, success: false };
    }

    /**
     * /plugin doctor — diagnostics
     */
    private doctor(): PluginCommandResult {
        const data = this.context.registryData!;
        const diagnostics = data.diagnostics;
        const plugins = data.plugins;

        const errors = diagnostics.filter((d) => d.level === 'error');
        const warnings = diagnostics.filter((d) => d.level === 'warn');

        const lines = [
            '🩺 Plugin Doctor',
            '',
            `  Plugins: ${plugins.length} total, ${plugins.filter((p) => p.status === 'loaded').length} loaded`,
            `  Tools: ${data.tools.length}`,
            `  Hooks: ${data.hooks.length + data.typedHooks.length}`,
            `  Services: ${data.services.length}`,
            '',
        ];

        if (errors.length === 0 && warnings.length === 0) {
            lines.push('  ✅ No issues found!');
        } else {
            if (errors.length > 0) {
                lines.push(`  🔴 ${errors.length} error(s):`);
                for (const e of errors.slice(0, 10)) {
                    lines.push(`     • [${e.pluginId}] ${e.message}`);
                }
            }
            if (warnings.length > 0) {
                lines.push(`  🟡 ${warnings.length} warning(s):`);
                for (const w of warnings.slice(0, 10)) {
                    lines.push(`     • [${w.pluginId}] ${w.message}`);
                }
            }
        }

        return { output: lines.join('\n'), success: true };
    }

    /**
     * /plugin templates
     */
    private templates(): PluginCommandResult {
        const templates = this.scaffold.listTemplates();
        const lines = ['📋 Available Templates', ''];
        for (const t of templates) {
            lines.push(`  • ${t.name.padEnd(12)} ${t.description}`);
        }
        lines.push('');
        lines.push('  Usage: /plugin create <name> --template=<type>');
        return { output: lines.join('\n'), success: true };
    }

    /**
     * /plugin help
     */
    private help(): PluginCommandResult {
        return {
            output: [
                '📦 Plugin Commands',
                '',
                '  /plugin create <name>      Scaffold a new plugin',
                '  /plugin install <path>     Install a plugin from local path',
                '  /plugin uninstall <id>     Uninstall a plugin',
                '  /plugin list               List installed plugins',
                '  /plugin status [id]        Show plugin status / details',
                '  /plugin enable <id>        Enable a plugin',
                '  /plugin disable <id>       Disable a plugin',
                '  /plugin search <query>     Search the marketplace',
                '  /plugin info <id>          Show plugin details',
                '  /plugin doctor             Run plugin diagnostics',
                '  /plugin templates          List available templates',
            ].join('\n'),
            success: true,
        };
    }

    // ─── Accessors for Testing ───────────────────────────────────

    getScaffold(): PluginScaffold { return this.scaffold; }
    getInstaller(): PluginInstaller { return this.installer; }
    getMarketplace(): PluginMarketplace { return this.marketplace; }
}
