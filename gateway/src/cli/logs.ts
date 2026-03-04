/**
 * src/cli/logs.ts
 * CLI: coreblow logs — view and manage gateway logs
 */

import fs from 'node:fs';
import path from 'node:path';
import { getHomeDir } from '../gateway/config.js';

export async function logsCommand(action?: string, arg2?: string) {
    const homeDir = getHomeDir();
    const logDir = path.join(homeDir, 'logs');
    fs.mkdirSync(logDir, { recursive: true });

    switch (action) {
        case 'tail':
        case undefined: {
            // Show recent log output by reading the gateway process
            const logFile = path.join(logDir, 'gateway.log');
            if (!fs.existsSync(logFile)) {
                console.log('No log file found. Gateway may be running in foreground mode.');
                console.log('Tip: redirect output with: coreblow gateway start > ~/.coreblow/logs/gateway.log 2>&1');
                return;
            }
            const lines = arg2 ? parseInt(arg2) : 50;
            const content = fs.readFileSync(logFile, 'utf-8');
            const allLines = content.trim().split('\n');
            const recent = allLines.slice(-lines);
            console.log(`\n  Last ${recent.length} log lines:\n`);
            for (const line of recent) {
                console.log(`  ${line}`);
            }
            console.log('');
            break;
        }

        case 'sessions': {
            // List session files
            const sessionsDir = path.join(homeDir, 'agents', 'default', 'sessions');
            if (!fs.existsSync(sessionsDir)) {
                console.log('No sessions found.');
                return;
            }
            const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl'));
            console.log(`\n  📝 Sessions (${files.length}):\n`);
            for (const f of files) {
                const stat = fs.statSync(path.join(sessionsDir, f));
                const lines = fs.readFileSync(path.join(sessionsDir, f), 'utf-8').trim().split('\n').length;
                const ago = Math.round((Date.now() - stat.mtimeMs) / 60000);
                const agoStr = ago < 60 ? `${ago}m ago` : `${Math.round(ago / 60)}h ago`;
                console.log(`  ${f.replace('.jsonl', '').padEnd(40)} ${lines} msgs  ${agoStr}`);
            }
            console.log('');
            break;
        }

        case 'audit': {
            // Show audit log
            const auditFile = path.join(homeDir, 'audit.log');
            if (!fs.existsSync(auditFile)) {
                console.log('No audit log found.');
                return;
            }
            const content = fs.readFileSync(auditFile, 'utf-8');
            const lines = content.trim().split('\n').slice(-30);
            console.log(`\n  🔒 Recent Audit Events:\n`);
            for (const line of lines) {
                try {
                    const entry = JSON.parse(line);
                    console.log(`  [${new Date(entry.timestamp).toLocaleString()}] ${entry.action}: ${entry.details || ''}`);
                } catch {
                    console.log(`  ${line}`);
                }
            }
            console.log('');
            break;
        }

        case 'clear': {
            const logFile = path.join(logDir, 'gateway.log');
            if (fs.existsSync(logFile)) {
                fs.writeFileSync(logFile, '');
                console.log('✅ Log file cleared.');
            } else {
                console.log('No log file to clear.');
            }
            break;
        }

        default:
            console.log('Usage: coreblow logs [tail|sessions|audit|clear] [lines]');
    }
}
