/**
 * commands/wizard/doctor-wizard.ts
 * Multi-step diagnostic wizard.
 * Follows CoreBlow's commands/doctor/ pattern.
 */

import { createChildLogger } from '../../utils/logger.js';

const log = createChildLogger('cmd:doctor');

export type DiagnosticCategory = 'config' | 'providers' | 'channels' | 'tools' | 'storage' | 'network';
export type DiagnosticStatus = 'pass' | 'warn' | 'fail' | 'skip';

export interface DiagnosticCheck {
    category: DiagnosticCategory;
    name: string;
    status: DiagnosticStatus;
    message: string;
    fix?: string;
}

export interface DiagnosticReport {
    checks: DiagnosticCheck[];
    passed: number;
    warned: number;
    failed: number;
    skipped: number;
    healthy: boolean;
}

export interface DiagnosticEnv {
    hasConfig: boolean;
    configPath?: string;
    providers: Array<{ id: string; hasKey: boolean }>;
    channels: Array<{ id: string; connected: boolean }>;
    tools: Array<{ name: string; available: boolean }>;
    dataDir: string;
    dataDirWritable: boolean;
    nodeVersion: string;
    port: number;
    portAvailable: boolean;
}

/** Run all diagnostic checks. */
export function runDiagnostics(env: DiagnosticEnv): DiagnosticReport {
    const checks: DiagnosticCheck[] = [
        // Config
        checkConfig(env),
        // Providers
        ...checkProviders(env),
        // Channels
        ...checkChannels(env),
        // Storage
        checkStorage(env),
        // Runtime
        checkNodeVersion(env),
        checkPort(env),
    ];

    const passed = checks.filter(c => c.status === 'pass').length;
    const warned = checks.filter(c => c.status === 'warn').length;
    const failed = checks.filter(c => c.status === 'fail').length;
    const skipped = checks.filter(c => c.status === 'skip').length;

    return { checks, passed, warned, failed, skipped, healthy: failed === 0 };
}

function checkConfig(env: DiagnosticEnv): DiagnosticCheck {
    if (env.hasConfig) return { category: 'config', name: 'Configuration file', status: 'pass', message: `Found at ${env.configPath}` };
    return { category: 'config', name: 'Configuration file', status: 'warn', message: 'No config file found', fix: 'Run /setup to create one' };
}

function checkProviders(env: DiagnosticEnv): DiagnosticCheck[] {
    if (env.providers.length === 0) {
        return [{ category: 'providers', name: 'AI Providers', status: 'fail', message: 'No providers configured', fix: 'Add an API key: OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.' }];
    }
    return env.providers.map(p => ({
        category: 'providers' as DiagnosticCategory, name: `Provider: ${p.id}`,
        status: p.hasKey ? 'pass' as DiagnosticStatus : 'warn' as DiagnosticStatus,
        message: p.hasKey ? 'API key configured' : 'No API key found',
        fix: p.hasKey ? undefined : `Set ${p.id.toUpperCase()}_API_KEY environment variable`,
    }));
}

function checkChannels(env: DiagnosticEnv): DiagnosticCheck[] {
    if (env.channels.length === 0) return [{ category: 'channels', name: 'Channels', status: 'skip', message: 'No channels configured' }];
    return env.channels.map(c => ({
        category: 'channels' as DiagnosticCategory, name: `Channel: ${c.id}`,
        status: c.connected ? 'pass' as DiagnosticStatus : 'fail' as DiagnosticStatus,
        message: c.connected ? 'Connected' : 'Disconnected',
    }));
}

function checkStorage(env: DiagnosticEnv): DiagnosticCheck {
    if (env.dataDirWritable) return { category: 'storage', name: 'Data directory', status: 'pass', message: `Writable: ${env.dataDir}` };
    return { category: 'storage', name: 'Data directory', status: 'fail', message: `Not writable: ${env.dataDir}`, fix: `chmod 755 ${env.dataDir}` };
}

function checkNodeVersion(env: DiagnosticEnv): DiagnosticCheck {
    const major = parseInt(env.nodeVersion.replace('v', ''));
    if (major >= 20) return { category: 'network', name: 'Node.js version', status: 'pass', message: env.nodeVersion };
    return { category: 'network', name: 'Node.js version', status: 'warn', message: `${env.nodeVersion} (recommend v20+)` };
}

function checkPort(env: DiagnosticEnv): DiagnosticCheck {
    if (env.portAvailable) return { category: 'network', name: `Port ${env.port}`, status: 'pass', message: 'Available' };
    return { category: 'network', name: `Port ${env.port}`, status: 'fail', message: 'Port in use', fix: `Set COREBLOW_PORT to a different port` };
}

/** Format report for CLI output. */
export function formatDiagnosticReport(report: DiagnosticReport): string {
    const lines: string[] = ['🏥 CoreBlow Doctor\n'];
    const icons = { pass: '✅', warn: '⚠️', fail: '❌', skip: '⏭️' };

    let currentCat = '';
    for (const check of report.checks) {
        if (check.category !== currentCat) { currentCat = check.category; lines.push(`\n📋 ${currentCat.toUpperCase()}`); }
        lines.push(`  ${icons[check.status]} ${check.name}: ${check.message}`);
        if (check.fix) lines.push(`     💡 Fix: ${check.fix}`);
    }

    lines.push(`\n${'─'.repeat(40)}`);
    lines.push(`✅ ${report.passed} passed  ⚠️ ${report.warned} warned  ❌ ${report.failed} failed  ⏭️ ${report.skipped} skipped`);
    lines.push(report.healthy ? '\n🟢 System healthy!' : '\n🔴 Issues detected. Run /doctor --fix to auto-fix.');
    return lines.join('\n');
}
