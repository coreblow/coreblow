/**
 * agents/agent-engine-config.ts
 * Configuration types and defaults for AgentEngine.
 */
/** Stub: planned OOP type */
type PolicyDecision = { allowed: boolean; reason?: string };

// ─── Provider Config ─────────────────────────────────────────────
export interface ProviderConfig {
    id: string;
    name: string;
    apiKeyEnvVar?: string;
    baseUrl?: string;
    defaultModel: string;
    models: string[];
}

export const ANTHROPIC_PROVIDER: ProviderConfig = {
    id: 'anthropic', name: 'Anthropic', apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    defaultModel: 'claude-sonnet-4-20250514',
    models: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
};

export const OPENAI_PROVIDER: ProviderConfig = {
    id: 'openai', name: 'OpenAI', apiKeyEnvVar: 'OPENAI_API_KEY',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1', 'o3-mini'],
};

// ─── Tool Approval Policy ────────────────────────────────────────
export type ToolApprovalMode = 'auto' | 'require_approval' | 'deny';

export interface ToolApprovalConfig {
    /** Default mode for unknown tools */
    defaultMode: ToolApprovalMode;
    /** Tools that are always auto-approved (read-only) */
    autoApproveTools: string[];
    /** Tools that require explicit approval */
    requireApprovalTools: string[];
    /** Tools that are always denied */
    denyTools: string[];
}

/** CoreBlow-compatible defaults: safe reads auto, writes/exec need approval */
export const DEFAULT_TOOL_APPROVAL: ToolApprovalConfig = {
    defaultMode: 'require_approval',
    autoApproveTools: ['read_file', 'search', 'glob', 'list_dir', 'view_file'],
    requireApprovalTools: ['bash', 'write_file', 'edit_file', 'run_command'],
    denyTools: [],
};

// ─── Agent Engine Config ─────────────────────────────────────────
export interface AgentEngineConfig {
    /** Default provider */
    defaultProvider: string;
    /** Provider configs */
    providers: ProviderConfig[];
    /** Default model override */
    defaultModel?: string;
    /** System prompt template */
    systemPrompt?: string;
    /** Max context window tokens */
    maxContextTokens: number;
    /** Max output tokens per response */
    maxOutputTokens: number;
    /** Token budget per session (0 = unlimited) */
    sessionTokenBudget: number;
    /** Max turns per session */
    maxTurnsPerSession: number;
    /** Max concurrent sessions */
    maxConcurrentSessions: number;
    /** Tool approval config */
    toolApproval: ToolApprovalConfig;
    /** Sandbox base directory */
    sandboxBaseDir: string;
    /** Read-only directories */
    readOnlyDirs: string[];
    /** Enable streaming */
    enableStreaming: boolean;
    /** Enable compaction */
    enableCompaction: boolean;
    /** Compaction trigger (% of context window) */
    compactionThreshold: number;
    /** Enable tool loop detection */
    enableToolLoopDetection: boolean;
    /** Max tool calls per turn */
    maxToolCallsPerTurn: number;
}

export const DEFAULT_ENGINE_CONFIG: AgentEngineConfig = {
    defaultProvider: 'anthropic',
    providers: [ANTHROPIC_PROVIDER, OPENAI_PROVIDER],
    maxContextTokens: 200_000,
    maxOutputTokens: 8_192,
    sessionTokenBudget: 0,
    maxTurnsPerSession: 100,
    maxConcurrentSessions: 50,
    toolApproval: DEFAULT_TOOL_APPROVAL,
    sandboxBaseDir: process.cwd(),
    readOnlyDirs: ['/usr', '/etc', '/System'],
    enableStreaming: true,
    enableCompaction: true,
    compactionThreshold: 0.8,
    enableToolLoopDetection: true,
    maxToolCallsPerTurn: 25,
};

export function mergeEngineConfig(overrides?: Partial<AgentEngineConfig>): AgentEngineConfig {
    return { ...DEFAULT_ENGINE_CONFIG, ...overrides };
}

// ─── Turn Result ─────────────────────────────────────────────────
export interface TurnResult {
    sessionId: string;
    responseText: string;
    toolCalls: Array<{ id: string; name: string; input: Record<string, unknown>; output: string; durationMs: number }>;
    usage: { inputTokens: number; outputTokens: number; totalTokens: number; estimatedCost: number };
    turnNumber: number;
    durationMs: number;
    finishReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'budget_exceeded' | 'error';
    compacted: boolean;
}

// ─── Session Config ──────────────────────────────────────────────
export interface SessionConfig {
    model?: string;
    provider?: string;
    systemPrompt?: string;
    tools?: string[];
    maxTurns?: number;
    tokenBudget?: number;
    sandboxDir?: string;
}
