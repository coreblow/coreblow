/**
 * CoreBlow — CLI Banner
 *
 * Beautiful ASCII art banner with system status display,
 * version info, and dynamic stats for the CLI interface.
 */

/** Banner options */
export interface BannerOptions {
    version?: string;
    agentName?: string;
    provider?: string;
    model?: string;
    channels?: string[];
    plugins?: number;
    skills?: number;
    port?: number;
}

/**
 * CoreBlow CLI Banner
 */
export class CLIBanner {
    /**
     * Generate the full startup banner.
     */
    static generate(opts?: BannerOptions): string {
        const version = opts?.version ?? '1.0.0';
        const agentName = opts?.agentName ?? 'CoreBlow';
        const provider = opts?.provider ?? 'anthropic';
        const model = opts?.model ?? 'claude-sonnet-4-20250514';
        const channels = opts?.channels ?? ['webhook'];
        const plugins = opts?.plugins ?? 0;
        const skills = opts?.skills ?? 5;
        const port = opts?.port ?? 3000;

        // CoreBlow brand color: #DA7756 → closest ANSI-256 = 173 (#d7875f)
        const g = '\x1b[38;5;173m';
        const r = '\x1b[0m';

        const lines = [
            '',
            `  ${g}██████╗ ██████╗ ██████╗ ███████╗██████╗ ██╗      ██████╗ ██╗    ██╗${r}`,
            `  ${g}██╔════╝██╔═══██╗██╔══██╗██╔════╝██╔══██╗██║     ██╔═══██╗██║    ██║${r}`,
            `  ${g}██║     ██║   ██║██████╔╝█████╗  ██████╔╝██║     ██║   ██║██║ █╗ ██║${r}`,
            `  ${g}██║     ██║   ██║██╔══██╗██╔══╝  ██╔══██╗██║     ██║   ██║██║███╗██║${r}`,
            `  ${g}╚██████╗╚██████╔╝██║  ██║███████╗██████╔╝███████╗╚██████╔╝╚███╔███╔╝${r}`,
            `  ${g} ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═════╝ ╚══════╝ ╚═════╝  ╚══╝╚══╝${r}`,
            '',
            `  ${CLIBanner.dim('AI Gateway')} v${version}`,
            '',
            `  ${CLIBanner.label('Agent')}    ${agentName}`,
            `  ${CLIBanner.label('Provider')} ${provider} → ${model}`,
            `  ${CLIBanner.label('Channels')} ${channels.join(', ')}`,
            `  ${CLIBanner.label('Plugins')}  ${plugins} loaded  |  ${CLIBanner.label('Skills')} ${skills} active`,
            `  ${CLIBanner.label('Server')}   http://localhost:${port}`,
            '',
            `  ${CLIBanner.dim('──────────────────────────────────────────────')}`,
            `  ${CLIBanner.success('✓ Ready')} — Type /help for commands`,
            '',
        ];

        return lines.join('\n');
    }

    /**
     * Generate a compact status line.
     */
    static statusLine(opts?: { uptime?: number; requests?: number; errors?: number }): string {
        const uptime = opts?.uptime ?? 0;
        const requests = opts?.requests ?? 0;
        const errors = opts?.errors ?? 0;
        const uptimeStr = CLIBanner.formatUptime(uptime);

        return `  ↑ ${uptimeStr}  |  ${requests} req  |  ${errors} err`;
    }

    /**
     * Get available commands help.
     */
    static helpText(): string {
        return [
            '',
            '  Available Commands:',
            '  ──────────────────',
            '  /help          Show this help',
            '  /status        System status',
            '  /persona <id>  Switch persona',
            '  /skills        List skills',
            '  /plugins       List plugins',
            '  /config        Show configuration',
            '  /clear         Clear conversation',
            '  /export        Export conversation',
            '  /quit          Exit CoreBlow',
            '',
        ].join('\n');
    }

    // === Helpers ===

    static label(text: string): string { return `\x1b[36m${text.padEnd(8)}\x1b[0m`; }
    static dim(text: string): string { return `\x1b[2m${text}\x1b[0m`; }
    static success(text: string): string { return `\x1b[32m${text}\x1b[0m`; }
    static error(text: string): string { return `\x1b[31m${text}\x1b[0m`; }

    static formatUptime(ms: number): string {
        const s = Math.floor(ms / 1000);
        const m = Math.floor(s / 60);
        const h = Math.floor(m / 60);
        const d = Math.floor(h / 24);
        if (d > 0) return `${d}d ${h % 24}h`;
        if (h > 0) return `${h}h ${m % 60}m`;
        if (m > 0) return `${m}m ${s % 60}s`;
        return `${s}s`;
    }
}
