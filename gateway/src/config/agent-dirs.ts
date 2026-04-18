/**
 * CoreBlow — Agent Directory Paths
 *
 * Centralized path resolution for agent workspaces, skills, and tools.
 *
 * @packageDocumentation
 */

import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';

const ROOT = path.join(os.homedir(), '.coreblow');

export const AGENT_DIRS = {
    /** Root config directory */
    root: ROOT,
    /** Agent workspaces */
    agents: path.join(ROOT, 'agents'),
    /** Plugin storage */
    plugins: path.join(ROOT, 'plugins'),
    /** Skills directory */
    skills: path.join(ROOT, 'skills'),
    /** Session storage */
    sessions: path.join(ROOT, 'sessions'),
    /** Log files */
    logs: path.join(ROOT, 'logs'),
    /** Backup archives */
    backups: path.join(ROOT, 'backups'),
    /** Secrets store */
    secrets: ROOT,
    /** MCP server configs */
    mcp: ROOT,
    /** Cron job configs */
    cron: ROOT,
    /** Node pairing data */
    nodes: ROOT,
    /** Device tokens */
    devices: ROOT,
    /** Memory storage */
    memory: path.join(ROOT, 'memory'),
    /** Temp files */
    temp: path.join(ROOT, 'tmp'),
} as const;

/**
 * Resolve agent workspace directory.
 */
export function agentWorkspace(agentName: string): string {
    return path.join(AGENT_DIRS.agents, agentName);
}

/**
 * Ensure all required directories exist.
 */
export function ensureDirectories(): void {
    const dirs = [
        AGENT_DIRS.agents,
        AGENT_DIRS.plugins,
        AGENT_DIRS.skills,
        AGENT_DIRS.sessions,
        AGENT_DIRS.logs,
        AGENT_DIRS.backups,
        AGENT_DIRS.memory,
        AGENT_DIRS.temp,
    ];
    for (const dir of dirs) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

/**
 * Get the size of a directory (recursive, in bytes).
 */
export function directorySize(dirPath: string): number {
    if (!fs.existsSync(dirPath)) return 0;
    let total = 0;
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isFile()) {
            total += fs.statSync(fullPath).size;
        } else if (entry.isDirectory()) {
            total += directorySize(fullPath);
        }
    }
    return total;
}
