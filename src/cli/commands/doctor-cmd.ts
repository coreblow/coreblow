/**
 * CoreBlow — Doctor Command
 *
 * CLI command: `coreblow doctor`
 * Runs health diagnostics to verify system readiness.
 *
 * @packageDocumentation
 */

import type { Command } from 'commander';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const c = {
    reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
    green: '\x1b[32m', cyan: '\x1b[36m', yellow: '\x1b[33m', red: '\x1b[31m',
    orange: '\x1b[38;5;173m',
};

const PASS = `${c.green}✓${c.reset}`;
const WARN = `${c.yellow}⚠${c.reset}`;
const FAIL = `${c.red}✗${c.reset}`;

export function registerDoctorCommand(program: Command): void {
    program
        .command('doctor')
        .description('Run health diagnostics for CoreBlow')
        .action(async () => {
            console.log(`\n  ${c.orange}${c.bold}🐙 CoreBlow Doctor${c.reset}\n`);

            let issues = 0;

            // 1. Node.js version
            const nodeMajor = parseInt(process.versions.node.split('.')[0]!, 10);
            if (nodeMajor >= 22) {
                console.log(`  ${PASS} Node.js        v${process.versions.node} ${c.green}(recommended)${c.reset}`);
            } else if (nodeMajor >= 20) {
                console.log(`  ${PASS} Node.js        v${process.versions.node} ${c.yellow}(min supported)${c.reset}`);
            } else {
                console.log(`  ${FAIL} Node.js        v${process.versions.node} ${c.red}(v20+ required)${c.reset}`);
                issues++;
            }

            // 2. Config file
            const configDir = process.env.COREBLOW_CONFIG_DIR ?? path.join(os.homedir(), '.coreblow');
            const configPath = path.join(configDir, 'coreblow.json');

            if (fs.existsSync(configPath)) {
                try {
                    const raw = fs.readFileSync(configPath, 'utf8');
                    const config = JSON.parse(raw) as Record<string, unknown>;
                    const model = (config.agents as Record<string, unknown>)?.defaults;
                    console.log(`  ${PASS} Config         ${c.dim}${configPath}${c.reset}`);

                    if (model) {
                        console.log(`  ${PASS} Model config   ${c.dim}agents.defaults found${c.reset}`);
                    } else {
                        console.log(`  ${WARN} Model config   ${c.yellow}No agents.defaults — run coreblow onboard${c.reset}`);
                        issues++;
                    }
                } catch {
                    console.log(`  ${FAIL} Config         ${c.red}Invalid JSON${c.reset}: ${configPath}`);
                    issues++;
                }
            } else {
                console.log(`  ${WARN} Config         ${c.yellow}Not found${c.reset} — run ${c.cyan}coreblow onboard${c.reset}`);
                issues++;
            }

            // 3. API keys
            const apiKeys = [
                { name: 'OpenAI', env: 'OPENAI_API_KEY' },
                { name: 'Anthropic', env: 'ANTHROPIC_API_KEY' },
                { name: 'Google', env: 'GOOGLE_API_KEY' },
                { name: 'Gemini', env: 'GEMINI_API_KEY' },
                { name: 'DeepSeek', env: 'DEEPSEEK_API_KEY' },
            ];

            const foundKeys = apiKeys.filter(k => process.env[k.env]);
            if (foundKeys.length > 0) {
                for (const k of foundKeys) {
                    const val = process.env[k.env]!;
                    const masked = val.slice(0, 6) + '...' + val.slice(-4);
                    console.log(`  ${PASS} ${k.name.padEnd(14)} ${c.dim}${k.env}=${masked}${c.reset}`);
                }
            } else {
                console.log(`  ${WARN} API Keys       ${c.yellow}No API keys found in environment${c.reset}`);
                console.log(`  ${c.dim}  Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_API_KEY${c.reset}`);
                issues++;
            }

            // 4. Gateway check
            try {
                const res = await fetch('http://127.0.0.1:3000/healthz');
                if (res.ok) {
                    console.log(`  ${PASS} Gateway        ${c.green}Running${c.reset} on port 3000`);
                } else {
                    console.log(`  ${WARN} Gateway        ${c.yellow}Unhealthy${c.reset} (status ${res.status})`);
                }
            } catch {
                console.log(`  ${c.dim}○${c.reset} Gateway        ${c.dim}Not running (start with: coreblow gateway)${c.reset}`);
            }

            // 5. Config directory permissions
            if (fs.existsSync(configDir)) {
                try {
                    fs.accessSync(configDir, fs.constants.R_OK | fs.constants.W_OK);
                    console.log(`  ${PASS} Permissions    ${c.dim}${configDir} is writable${c.reset}`);
                } catch {
                    console.log(`  ${FAIL} Permissions    ${c.red}${configDir} is not writable${c.reset}`);
                    issues++;
                }
            }

            // Summary
            console.log();
            if (issues === 0) {
                console.log(`  ${c.green}${c.bold}All checks passed!${c.reset} CoreBlow is ready. 🐙\n`);
            } else {
                console.log(`  ${c.yellow}${c.bold}${issues} issue(s) found.${c.reset} Fix the items above for best experience.\n`);
            }
        });
}
