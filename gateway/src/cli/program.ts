/**
 * CoreBlow — CLI Program (Commander Framework)
 *
 * Full Commander CLI porting from OpenClaw pattern.
 * This is the central CLI dispatcher that routes subcommands
 * (gateway, status, doctor, etc.) to their handlers.
 *
 * Enterprise OOP pattern with extensible subcommand registration.
 *
 * @packageDocumentation
 */

import { Command } from 'commander';
import { VERSION } from '../version.js';
import { registerGatewayCommand } from './commands/gateway-cmd.js';
import { registerStatusCommand } from './commands/status-cmd.js';
import { registerDoctorCommand } from './commands/doctor-cmd.js';
import { registerChatCommand } from './commands/chat-cmd.js';
import { registerOnboardCommand } from './commands/onboard-cmd.js';
import { registerAgentCommand } from './commands/agent-cmd.js';
import { registerConfigCommand } from './commands/config-cmd.js';
import { registerVersionCommand } from './commands/version-cmd.js';
import { registerChannelsCommand } from './commands/channels-cmd.js';
import { registerModelsCommand } from './commands/models-cmd.js';
import { registerSessionsCommand } from './commands/sessions-cmd.js';
import { registerLogsCommand } from './commands/logs-cmd.js';
import { registerAuthCommand } from './commands/auth-cmd.js';
// Tier 1: Essential
import { registerSetupCommand } from './commands/setup-cmd.js';
import { registerConfigureCommand } from './commands/configure-cmd.js';
import { registerHealthCommand } from './commands/health-cmd.js';
import { registerDashboardCommand } from './commands/dashboard-cmd.js';
import { registerResetCommand } from './commands/reset-cmd.js';
// Tier 2: Operations
import { registerMessageCommand } from './commands/message-cmd.js';
import { registerAgentsCommand } from './commands/agents-cmd.js';
import { registerPluginsCommand } from './commands/plugins-cmd.js';
import { registerBackupCommand } from './commands/backup-cmd.js';
import { registerSecretsCommand } from './commands/secrets-cmd.js';
// Tier 3: Advanced
import { registerCronCommand } from './commands/cron-cmd.js';
import { registerWebhooksCommand } from './commands/webhooks-cmd.js';
import { registerMcpCommand } from './commands/mcp-cmd.js';
import { registerSecurityCommand } from './commands/security-cmd.js';
import { registerSkillsCommand } from './commands/skills-cmd.js';
// Tier 4: Infrastructure
import { registerDaemonCommand } from './commands/daemon-cmd.js';
import { registerUpdateCommand } from './commands/update-cmd.js';
import { registerUninstallCommand } from './commands/uninstall-cmd.js';
import { registerCompletionCommand } from './commands/completion-cmd.js';
import { registerTuiCommand } from './commands/tui-cmd.js';
// Tier 5: Extended
import { registerNodesCommand } from './commands/nodes-cmd.js';
import { registerDevicesCommand } from './commands/devices-cmd.js';

/**
 * CoreBlow CLI Program
 *
 * Creates and configures the Commander program with all
 * registered subcommands. Follows OpenClaw's Commander pattern
 * but with CoreBlow's Enterprise OOP architecture.
 */
export class CoreBlowProgram {
    private program: Command;

    constructor() {
        this.program = new Command();
        this.configure();
        this.registerCommands();
    }

    /**
     * Configure the root Commander program.
     */
    private configure(): void {
        this.program
            .name('coreblow')
            .description('CoreBlow AI Gateway — Multi-channel agent orchestration runtime')
            .version(VERSION, '-v, --version', 'Show CoreBlow version')
            .option('--no-color', 'Disable colored output')
            .option('--log-level <level>', 'Set log level (debug, info, warn, error)', 'info')
            .option('--config <path>', 'Path to config file');
    }

    /**
     * Register all subcommands.
     */
    private registerCommands(): void {
        // ── Core commands (6 original) ───────────────────
        registerGatewayCommand(this.program);
        registerStatusCommand(this.program);
        registerDoctorCommand(this.program);
        registerChatCommand(this.program);
        registerOnboardCommand(this.program);
        registerAgentCommand(this.program);

        // ── Phase 1 additions (7 commands) ───────────────
        registerConfigCommand(this.program);
        registerVersionCommand(this.program);
        registerChannelsCommand(this.program);
        registerModelsCommand(this.program);
        registerSessionsCommand(this.program);
        registerLogsCommand(this.program);
        registerAuthCommand(this.program);

        // ── Tier 1: Essential (5 commands) ───────────────
        registerSetupCommand(this.program);
        registerConfigureCommand(this.program);
        registerHealthCommand(this.program);
        registerDashboardCommand(this.program);
        registerResetCommand(this.program);

        // ── Tier 2: Operations (5 commands) ──────────────
        registerMessageCommand(this.program);
        registerAgentsCommand(this.program);
        registerPluginsCommand(this.program);
        registerBackupCommand(this.program);
        registerSecretsCommand(this.program);

        // ── Tier 3: Advanced (5 commands) ────────────────
        registerCronCommand(this.program);
        registerWebhooksCommand(this.program);
        registerMcpCommand(this.program);
        registerSecurityCommand(this.program);
        registerSkillsCommand(this.program);

        // ── Tier 4: Infrastructure (5 commands) ──────────
        registerDaemonCommand(this.program);
        registerUpdateCommand(this.program);
        registerUninstallCommand(this.program);
        registerCompletionCommand(this.program);
        registerTuiCommand(this.program);

        // ── Tier 5: Extended (2 commands) ────────────────
        registerNodesCommand(this.program);
        registerDevicesCommand(this.program);
    }

    /**
     * Parse arguments and execute the matched command.
     */
    async run(argv: string[] = process.argv): Promise<void> {
        await this.program.parseAsync(argv);
    }

    /**
     * Get the Commander program (for testing / extension).
     */
    getProgram(): Command { return this.program; }
}

/**
 * Create and run the CLI program.
 * This is the main entry point called from coreblow.mjs.
 */
export async function runCli(argv: string[] = process.argv): Promise<void> {
    const cli = new CoreBlowProgram();
    await cli.run(argv);
}
