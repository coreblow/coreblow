/**
 * CoreBlow CLI — `coreblow security`
 *
 * Security tools: audit config, lint API key exposure,
 * scan logs for PII, generate security reports.
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
const red = '\x1b[31m';
const reset = '\x1b[0m';

const CONFIG_DIR = path.join(os.homedir(), '.coreblow');
const CONFIG_FILE = path.join(CONFIG_DIR, 'coreblow.json');
const SECRETS_FILE = path.join(CONFIG_DIR, 'secrets.json');

interface AuditFinding { severity: 'critical' | 'warning' | 'info'; message: string; fix?: string }

function auditConfig(): AuditFinding[] {
    const findings: AuditFinding[] = [];

    // Check config file permissions
    try {
        const stat = fs.statSync(CONFIG_FILE);
        const mode = (stat.mode & 0o777).toString(8);
        if (mode !== '600' && mode !== '400') {
            findings.push({
                severity: 'warning',
                message: `Config file permissions too open (${mode})`,
                fix: `chmod 600 ${CONFIG_FILE}`,
            });
        }
    } catch { /* no config */ }

    // Check for API keys in config
    try {
        const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
        const keyPatterns = [/sk-[a-zA-Z0-9]{20,}/, /sk-ant-[a-zA-Z0-9]{20,}/, /AIza[a-zA-Z0-9_-]{35}/];
        for (const pattern of keyPatterns) {
            if (pattern.test(raw)) {
                findings.push({
                    severity: 'info',
                    message: 'API key found in config file (expected if using config-based auth)',
                });
                break;
            }
        }
    } catch { /* no config */ }

    // Check secrets file permissions
    try {
        const stat = fs.statSync(SECRETS_FILE);
        const mode = (stat.mode & 0o777).toString(8);
        if (mode !== '600' && mode !== '400') {
            findings.push({
                severity: 'critical',
                message: `Secrets file permissions too open (${mode})`,
                fix: `chmod 600 ${SECRETS_FILE}`,
            });
        }
    } catch { /* no secrets */ }

    // Check for .env files with secrets
    const envFile = path.join(process.cwd(), '.env');
    if (fs.existsSync(envFile)) {
        try {
            const envContent = fs.readFileSync(envFile, 'utf8');
            if (/API_KEY|SECRET|TOKEN/i.test(envContent)) {
                findings.push({
                    severity: 'warning',
                    message: '.env file contains potential secrets — ensure it is in .gitignore',
                });
            }
        } catch { /* skip */ }
    }

    // Check gateway host binding
    try {
        const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        if (cfg.gateway?.host === '0.0.0.0') {
            findings.push({
                severity: 'info',
                message: 'Gateway bound to 0.0.0.0 (all interfaces) — ensure firewall is configured for production',
            });
        }
    } catch { /* no config */ }

    if (findings.length === 0) {
        findings.push({ severity: 'info', message: 'No security issues detected.' });
    }

    return findings;
}

function scanForPii(content: string): string[] {
    const patterns: Array<[string, RegExp]> = [
        ['email', /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g],
        ['phone', /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g],
        ['SSN', /\b\d{3}-\d{2}-\d{4}\b/g],
        ['credit card', /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g],
    ];
    const found: string[] = [];
    for (const [name, pattern] of patterns) {
        const matches = content.match(pattern);
        if (matches) found.push(`${name}: ${matches.length} occurrence(s)`);
    }
    return found;
}

export function registerSecurityCommand(parent: Command): void {
    const cmd = parent.command('security').description('Security tools and config audits');

    cmd.command('audit').description('Audit configuration for security issues')
        .option('--json', 'Output as JSON')
        .action((opts: { json?: boolean }) => {
            const findings = auditConfig();
            if (opts.json) { console.log(JSON.stringify(findings, null, 2)); return; }
            console.log(`\n  ${bold}Security Audit${reset}\n`);
            for (const f of findings) {
                let icon: string;
                if (f.severity === 'critical') icon = `${red}✗${reset}`;
                else if (f.severity === 'warning') icon = `${yellow}⚠${reset}`;
                else icon = `${green}✓${reset}`;
                console.log(`  ${icon} ${f.message}`);
                if (f.fix) console.log(`    ${dim}Fix: ${cyan}${f.fix}${reset}`);
            }
            console.log();
            const criticals = findings.filter(f => f.severity === 'critical');
            if (criticals.length > 0) process.exitCode = 1;
        });

    cmd.command('scan').description('Scan logs for PII patterns')
        .option('--dir <path>', 'Directory to scan', path.join(CONFIG_DIR, 'logs'))
        .action((opts: { dir: string }) => {
            console.log(`\n  ${bold}PII Scan${reset} ${dim}(${opts.dir})${reset}\n`);
            if (!fs.existsSync(opts.dir)) { console.log(`  ${dim}Directory not found.${reset}\n`); return; }
            const files = fs.readdirSync(opts.dir).filter(f => f.endsWith('.log') || f.endsWith('.json'));
            let totalFindings = 0;
            for (const file of files) {
                const content = fs.readFileSync(path.join(opts.dir, file), 'utf8');
                const pii = scanForPii(content);
                if (pii.length > 0) {
                    console.log(`  ${yellow}⚠${reset} ${cyan}${file}${reset}`);
                    for (const p of pii) console.log(`    ${dim}${p}${reset}`);
                    totalFindings += pii.length;
                }
            }
            if (totalFindings === 0) console.log(`  ${green}✓${reset} No PII patterns detected.\n`);
            else console.log(`\n  ${yellow}Found ${totalFindings} potential PII pattern(s).${reset}\n`);
        });

    cmd.command('report').description('Generate a full security report')
        .action(() => {
            const findings = auditConfig();
            console.log(`\n  ${bold}CoreBlow Security Report${reset}`);
            console.log(`  ${dim}Generated: ${new Date().toISOString()}${reset}\n`);
            console.log(`  ${bold}Summary${reset}`);
            console.log(`  Critical: ${findings.filter(f => f.severity === 'critical').length}`);
            console.log(`  Warning:  ${findings.filter(f => f.severity === 'warning').length}`);
            console.log(`  Info:     ${findings.filter(f => f.severity === 'info').length}\n`);
            for (const f of findings) {
                const sev = f.severity === 'critical' ? red : f.severity === 'warning' ? yellow : dim;
                console.log(`  [${sev}${f.severity.toUpperCase()}${reset}] ${f.message}`);
            }
            console.log();
        });
}
