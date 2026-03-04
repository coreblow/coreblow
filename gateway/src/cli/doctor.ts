/**
 * src/cli/doctor.ts
 * CLI: coreblow doctor — check system health and dependencies
 */

import fs from 'node:fs';
import path from 'node:path';
import { getHomeDir, getConfigPath } from '../gateway/config.js';

interface Check {
    name: string;
    status: 'ok' | 'warn' | 'fail';
    detail: string;
}

export async function doctorCommand() {
    console.log('🔍 CoreBlow Doctor — System Check\n');

    const checks: Check[] = [];

    // Node.js version
    const nodeVersion = process.version;
    const major = parseInt(nodeVersion.slice(1));
    checks.push({
        name: 'Node.js version',
        status: major >= 20 ? 'ok' : major >= 18 ? 'warn' : 'fail',
        detail: `${nodeVersion} ${major >= 20 ? '(recommended)' : major >= 18 ? '(minimum, upgrade to 20+)' : '(too old, need 20+)'}`,
    });

    // Home directory
    const homeDir = getHomeDir();
    const homeExists = fs.existsSync(homeDir);
    checks.push({
        name: 'Home directory',
        status: homeExists ? 'ok' : 'warn',
        detail: `${homeDir} ${homeExists ? '(exists)' : '(will be created on first run)'}`,
    });

    // Config file
    const configPath = getConfigPath();
    const configExists = fs.existsSync(configPath);
    checks.push({
        name: 'Config file',
        status: configExists ? 'ok' : 'warn',
        detail: `${configPath} ${configExists ? '(found)' : '(will be created with defaults)'}`,
    });

    // Config validation
    if (configExists) {
        try {
            const raw = fs.readFileSync(configPath, 'utf-8');
            JSON.parse(raw);
            checks.push({ name: 'Config syntax', status: 'ok', detail: 'Valid JSON' });
        } catch {
            checks.push({ name: 'Config syntax', status: 'fail', detail: 'Invalid JSON — fix or delete to regenerate' });
        }
    }

    // Workspace
    if (configExists) {
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            const workspace = config?.agent?.workspace;
            if (workspace) {
                const wsExists = fs.existsSync(workspace);
                checks.push({
                    name: 'Workspace',
                    status: wsExists ? 'ok' : 'warn',
                    detail: `${workspace} ${wsExists ? '(exists)' : '(will be created)'}`,
                });
            }
        } catch { /* skip */ }
    }

    // Gateway connectivity
    try {
        const res = await fetch('http://127.0.0.1:3120/api/health');
        if (res.ok) {
            const data: any = await res.json();
            checks.push({ name: 'Gateway', status: 'ok', detail: `Running (uptime: ${data.uptimeHuman})` });
        } else {
            checks.push({ name: 'Gateway', status: 'warn', detail: `Responded with HTTP ${res.status}` });
        }
    } catch {
        checks.push({ name: 'Gateway', status: 'warn', detail: 'Not running (start with: coreblow gateway start)' });
    }

    // Ollama
    try {
        const res = await fetch('http://127.0.0.1:11434/api/tags');
        if (res.ok) {
            const data: any = await res.json();
            const models = data.models?.map((m: any) => m.name).join(', ') || 'none';
            checks.push({ name: 'Ollama', status: 'ok', detail: `Running (models: ${models})` });
        }
    } catch {
        checks.push({ name: 'Ollama', status: 'warn', detail: 'Not running (optional, for local AI models)' });
    }

    // Print results
    const icons = { ok: '✅', warn: '⚠️ ', fail: '❌' };
    for (const check of checks) {
        console.log(`  ${icons[check.status]} ${check.name}: ${check.detail}`);
    }

    const failures = checks.filter((c) => c.status === 'fail');
    const warnings = checks.filter((c) => c.status === 'warn');

    console.log('');
    if (failures.length > 0) {
        console.log(`❌ ${failures.length} issue(s) need fixing`);
    } else if (warnings.length > 0) {
        console.log(`⚠️  ${warnings.length} warning(s), but system is functional`);
    } else {
        console.log('✅ All checks passed!');
    }
}
