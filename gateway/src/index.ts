#!/usr/bin/env node
/**
 * src/index.ts
 * CoreBlow Gateway — CLI Entry Point
 */

import { Command } from 'commander';
import { gatewayCommand } from './cli/gateway.js';
import { doctorCommand } from './cli/doctor.js';

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
    .command('start')
    .description('Shortcut for: coreblow gateway start')
    .action(async () => {
        await gatewayCommand('start');
    });

program.parse();
