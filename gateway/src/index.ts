#!/usr/bin/env node
/**
 * src/index.ts
 * CoreBlow Gateway — CLI Entry Point
 */

import { Command } from 'commander';
import { gatewayCommand } from './cli/gateway.js';
import { doctorCommand } from './cli/doctor.js';
import { onboardCommand } from './cli/onboard.js';
import { configureCommand } from './cli/configure.js';
import { pairCommand } from './cli/pair.js';
import { channelsCommand } from './cli/channels.js';
import { logsCommand } from './cli/logs.js';
import { platformCommand } from './cli/platform.js';
import { skillhubCommand } from './cli/skillhub.js';

const program = new Command();

program
    .name('coreblow')
    .description('CoreBlow AI Gateway — Self-hosted AI assistant platform')
    .version('1.0.0');

program
    .command('gateway')
    .description('Manage the gateway daemon')
    .argument('<action>', 'start | status | stop')
    .action(async (action: string) => {
        await gatewayCommand(action);
    });

program
    .command('doctor')
    .description('Check system health and dependencies')
    .action(async () => {
        await doctorCommand();
    });

program
    .command('onboard')
    .description('Interactive first-time setup wizard')
    .action(async () => {
        await onboardCommand();
    });

program
    .command('configure')
    .description('Edit config interactively')
    .argument('[section]', 'provider | channels | port')
    .action(async (section?: string) => {
        await configureCommand(section);
    });

program
    .command('pair')
    .description('Device pairing (generate code / list / revoke)')
    .argument('[action]', 'generate | list | revoke')
    .action(async (action?: string) => {
        await pairCommand(action);
    });

program
    .command('channels')
    .description('View and test channel connections')
    .argument('[action]', 'list | test')
    .action(async (action?: string) => {
        await channelsCommand(action);
    });

program
    .command('logs')
    .description('View gateway logs, sessions, and audit trail')
    .argument('[action]', 'tail | sessions | audit | clear')
    .argument('[arg]', 'Optional argument (e.g. number of lines)')
    .action(async (action?: string, arg?: string) => {
        await logsCommand(action, arg);
    });

program
    .command('platform')
    .description('Install/manage auto-start service (LaunchAgent/systemd)')
    .argument('[action]', 'install | uninstall | status')
    .action(async (action?: string) => {
        await platformCommand(action);
    });

program
    .command('skillhub')
    .description('Manage skills — install, list, remove, catalog')
    .argument('[action]', 'install | list | remove | catalog')
    .argument('[name]', 'Skill name')
    .action(async (action?: string, name?: string) => {
        await skillhubCommand(action, name);
    });

program
    .command('start')
    .description('Shortcut for: coreblow gateway start')
    .action(async () => {
        await gatewayCommand('start');
    });

program.parse();
