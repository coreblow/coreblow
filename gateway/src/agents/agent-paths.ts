/**
 * agents/agent-paths.ts
 * Agent directory and file path resolution.
 * Ported from CoreBlow src/agents/agent-paths.ts.
 */

import path from 'node:path';
import fs from 'node:fs';

const AGENT_DIR_NAME = '.coreblow';
const AGENT_SESSIONS_DIR = 'sessions';
const AGENT_WORKSPACE_DIR = 'workspace';
const AGENT_CONFIG_FILE = 'agent.json';
const AGENT_CONTEXT_DIR = 'context';

export interface AgentPaths {
    agentDir: string;
    sessionsDir: string;
    workspaceDir: string;
    configPath: string;
    contextDir: string;
    sessionPath: (sessionId: string) => string;
    transcriptPath: (sessionId: string) => string;
}

/**
 * Resolve the CoreBlow agent directory from a base path.
 */
export function resolveAgentDir(basePath: string, agentId?: string): string {
    const base = path.join(basePath, AGENT_DIR_NAME);
    return agentId ? path.join(base, 'agents', agentId) : base;
}

/**
 * Resolve all agent paths from an agent directory.
 */
export function resolveAgentPaths(agentDir: string): AgentPaths {
    return {
        agentDir,
        sessionsDir: path.join(agentDir, AGENT_SESSIONS_DIR),
        workspaceDir: path.join(agentDir, AGENT_WORKSPACE_DIR),
        configPath: path.join(agentDir, AGENT_CONFIG_FILE),
        contextDir: path.join(agentDir, AGENT_CONTEXT_DIR),
        sessionPath: (sessionId: string) => path.join(agentDir, AGENT_SESSIONS_DIR, sessionId),
        transcriptPath: (sessionId: string) => path.join(agentDir, AGENT_SESSIONS_DIR, sessionId, 'transcript.jsonl'),
    };
}

/**
 * Ensure all agent directories exist.
 */
export function ensureAgentDirs(agentDir: string): void {
    const paths = resolveAgentPaths(agentDir);
    fs.mkdirSync(paths.sessionsDir, { recursive: true });
    fs.mkdirSync(paths.workspaceDir, { recursive: true });
    fs.mkdirSync(paths.contextDir, { recursive: true });
}

/**
 * List all session IDs for an agent.
 */
export function listAgentSessions(agentDir: string): string[] {
    const sessionsDir = path.join(agentDir, AGENT_SESSIONS_DIR);
    if (!fs.existsSync(sessionsDir)) return [];
    return fs.readdirSync(sessionsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort();
}

/**
 * Resolve the default agent workspace directory.
 */
export function resolveDefaultWorkspaceDir(env?: NodeJS.ProcessEnv): string {
    const e = env ?? process.env;
    return e.COREBLOW_WORKSPACE ?? e.HOME ?? process.cwd();
}

/**
 * Strip null bytes from paths (prevent ENOTDIR on malformed input).
 */
export function sanitizePath(p: string): string {
    // eslint-disable-next-line no-control-regex
    return p.replace(/\0/g, '');
}
