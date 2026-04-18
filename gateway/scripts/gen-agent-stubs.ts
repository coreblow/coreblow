/**
 * Batch generator for remaining agent module stubs.
 * Run: node --loader ts-node/esm scripts/gen-agent-stubs.ts
 */
import fs from 'node:fs';
import path from 'node:path';

const AGENTS_DIR = path.resolve(import.meta.dirname, '../src/agents');

const modules: Record<string, string> = {
// ─── Bash Tools ───
'bash-tools.exec-host-gateway.ts': `/** Exec host — gateway mode. */
export { execCommand } from './bash-tools.js';
export type ExecHostMode = 'gateway';
export function isGatewayMode(): boolean { return true; }`,

'bash-tools.exec-host-node.ts': `/** Exec host — Node.js mode. */
export { execCommand } from './bash-tools.js';
export type ExecHostMode = 'node';
export function isNodeMode(): boolean { return typeof process !== 'undefined'; }`,

'bash-tools.exec-runtime.ts': `/** Exec runtime environment detection. */
export function detectRuntime(): 'node' | 'bun' | 'deno' | 'unknown' {
    if (typeof process !== 'undefined' && process.versions?.bun) return 'bun';
    if (typeof process !== 'undefined' && process.versions?.node) return 'node';
    return 'unknown';
}
export function getRuntimeVersion(): string { return process.version ?? 'unknown'; }`,

'bash-tools.process.ts': `/** Process management utilities. */
export function killProcess(pid: number, signal: NodeJS.Signals = 'SIGTERM'): boolean { try { process.kill(pid, signal); return true; } catch { return false; } }
export function isProcessAlive(pid: number): boolean { try { process.kill(pid, 0); return true; } catch { return false; } }`,

// ─── ACP Spawn ───
'acp-spawn.ts': `/** Agent Code Protocol spawn. */
export interface AcpSpawnOptions { agentId: string; task: string; timeout?: number; model?: string; }
export interface AcpResult { agentId: string; output: string; exitCode: number; duration: number; }
export function createAcpSpawnOptions(agentId: string, task: string): AcpSpawnOptions { return { agentId, task, timeout: 300_000 }; }`,

'acp-spawn-parent-stream.ts': `/** ACP parent stream communication. */
export interface ParentStreamMessage { type: 'text' | 'tool_use' | 'tool_result' | 'done' | 'error'; content?: string; }
export function encodeParentMessage(msg: ParentStreamMessage): string { return JSON.stringify(msg); }
export function decodeParentMessage(data: string): ParentStreamMessage | null { try { return JSON.parse(data); } catch { return null; } }`,

// ─── Anthropic/Provider Streaming ───
'anthropic-vertex-stream.ts': `/** Anthropic Vertex AI stream adapter. */
export interface VertexStreamConfig { projectId: string; location: string; model: string; }
export function buildVertexEndpoint(config: VertexStreamConfig): string { return \`https://\${config.location}-aiplatform.googleapis.com/v1/projects/\${config.projectId}/locations/\${config.location}/publishers/anthropic/models/\${config.model}:streamRawPredict\`; }`,

'openai-ws-connection.ts': `/** OpenAI WebSocket connection management. */
export interface WsConnectionConfig { url: string; apiKey: string; model: string; }
export function buildWsUrl(config: WsConnectionConfig): string { return \`\${config.url}?model=\${encodeURIComponent(config.model)}\`; }
export function createWsHeaders(apiKey: string): Record<string, string> { return { 'Authorization': \`Bearer \${apiKey}\`, 'OpenAI-Beta': 'realtime=v1' }; }`,

'openai-ws-message-conversion.ts': `/** OpenAI WS message format conversion. */
export function convertWsToContentBlock(msg: Record<string, unknown>): { type: string; content?: string } {
    const type = msg.type as string;
    if (type === 'response.text.delta') return { type: 'text', content: msg.delta as string };
    if (type === 'response.done') return { type: 'done' };
    return { type: 'unknown' };
}`,

// ─── CLI ───
'cli-backends.ts': `/** CLI backend selection. */
export type CliBackend = 'anthropic' | 'openai' | 'google' | 'ollama' | 'custom';
export function resolveCliBackend(provider?: string): CliBackend { return (provider as CliBackend) ?? 'anthropic'; }
export function getCliBackendLabel(backend: CliBackend): string { const labels: Record<string, string> = { anthropic: 'Anthropic Claude', openai: 'OpenAI', google: 'Google Gemini', ollama: 'Ollama', custom: 'Custom' }; return labels[backend] ?? backend; }`,

'cli-runner.ts': `/** CLI runner — main entry point. */
export interface CliRunnerConfig { model?: string; provider?: string; interactive?: boolean; maxTurns?: number; }
export function createCliRunnerConfig(overrides?: Partial<CliRunnerConfig>): CliRunnerConfig { return { interactive: true, maxTurns: 100, ...overrides }; }`,

'cli-session.ts': `/** CLI session management. */
export interface CliSession { id: string; startedAt: number; model: string; provider: string; turnCount: number; }
export function createCliSession(model: string, provider: string): CliSession { return { id: \`cli_\${Date.now().toString(36)}\`, startedAt: Date.now(), model, provider, turnCount: 0 }; }`,

'cli-watchdog-defaults.ts': `/** CLI watchdog configuration defaults. */
export const CLI_WATCHDOG_TIMEOUT_MS = 600_000;
export const CLI_WATCHDOG_CHECK_INTERVAL_MS = 30_000;
export const CLI_WATCHDOG_MAX_IDLE_MS = 300_000;`,

'claude-cli-runner.ts': `/** Claude-specific CLI runner. */
export interface ClaudeCliConfig { apiKey?: string; model?: string; maxTokens?: number; }
export function resolveClaudeCliConfig(env?: Record<string, string | undefined>): ClaudeCliConfig { return { apiKey: env?.ANTHROPIC_API_KEY, model: env?.CLAUDE_MODEL ?? 'claude-sonnet-4-20250514' }; }`,

// ─── Model Auth ───
'model-auth-env.ts': `/** Model auth from environment variables. */
export function resolveApiKeyFromEnv(provider: string): string | undefined {
    const envMap: Record<string, string> = { openai: 'OPENAI_API_KEY', anthropic: 'ANTHROPIC_API_KEY', google: 'GOOGLE_API_KEY', deepseek: 'DEEPSEEK_API_KEY', groq: 'GROQ_API_KEY', mistral: 'MISTRAL_API_KEY' };
    const envVar = envMap[provider.toLowerCase()];
    return envVar ? process.env[envVar] : undefined;
}`,

'model-auth-env-vars.ts': `/** Model auth environment variable names. */
export const AUTH_ENV_VARS: Record<string, string> = { openai: 'OPENAI_API_KEY', anthropic: 'ANTHROPIC_API_KEY', google: 'GOOGLE_API_KEY', deepseek: 'DEEPSEEK_API_KEY', groq: 'GROQ_API_KEY', mistral: 'MISTRAL_API_KEY', together: 'TOGETHER_API_KEY', fireworks: 'FIREWORKS_API_KEY' };
export function getAuthEnvVar(provider: string): string | undefined { return AUTH_ENV_VARS[provider.toLowerCase()]; }`,

'model-auth-label.ts': `/** Model auth display labels. */
export function formatAuthLabel(provider: string, type: string): string { return \`\${provider} (\${type})\`; }
export function redactApiKey(key: string): string { return key.length > 8 ? key.slice(0, 4) + '…' + key.slice(-4) : '***'; }`,

'model-auth-markers.ts': `/** Model auth status markers. */
export type AuthMarker = 'valid' | 'expired' | 'missing' | 'refreshing';
export function getAuthMarkerIcon(marker: AuthMarker): string { const icons: Record<AuthMarker, string> = { valid: '✅', expired: '❌', missing: '⚠️', refreshing: '🔄' }; return icons[marker]; }`,

'model-auth-runtime-shared.ts': `/** Shared model auth runtime utilities. */
export function isApiKeyValid(key: string | undefined): boolean { return typeof key === 'string' && key.trim().length > 10; }
export function normalizeApiKey(key: string): string { return key.trim(); }`,

// ─── Model Config Extensions ───
'model-alias-lines.ts': `/** Model alias line parsing. */
export function parseModelAlias(line: string): { alias: string; target: string } | null { const m = line.match(/^([\\w-]+)\\s*=\\s*([\\w\\/-]+)/); return m ? { alias: m[1], target: m[2] } : null; }
export function formatModelAlias(alias: string, target: string): string { return \`\${alias} = \${target}\`; }`,

'model-allowlist-ref.ts': `/** Model allowlist reference. */
export function isModelAllowed(modelId: string, allowlist?: string[]): boolean { return !allowlist || allowlist.length === 0 || allowlist.includes(modelId); }
export function isModelBlocked(modelId: string, blocklist?: string[]): boolean { return !!blocklist && blocklist.includes(modelId); }`,

'model-ref-profile.ts': `/** Model reference profiles. */
export interface ModelRefProfile { modelId: string; provider: string; profileId?: string; }
export function parseModelRef(ref: string): ModelRefProfile { const [provider, ...rest] = ref.split('/'); return { provider, modelId: rest.join('/') || provider }; }`,

'model-fallback.types.ts': `/** Model fallback type definitions. */
export type FallbackReason = 'rate_limit' | 'overloaded' | 'error' | 'timeout' | 'manual';
export interface FallbackEntry { from: string; to: string; reason: FallbackReason; timestamp: number; }`,

'models-config.merge.ts': `/** Model config merge utilities. */
export { mergeModelConfigs } from './models-config.js';`,

'models-config.plan.ts': `/** Model config planning. */
export interface ModelPlan { primary: string; fallbacks: string[]; maxRetries: number; }
export function createModelPlan(primary: string, fallbacks?: string[]): ModelPlan { return { primary, fallbacks: fallbacks ?? [], maxRetries: 3 }; }`,

'models-config.providers.ts': `/** Provider configuration registry. */
export { listModelsByProvider, resolveModelConfig } from './models-config.js';`,

'models-config.providers.implicit.ts': `/** Implicit provider resolution. */
export function inferProvider(modelId: string): string | null {
    if (modelId.startsWith('claude') || modelId.startsWith('anthropic')) return 'anthropic';
    if (modelId.startsWith('gpt') || modelId.startsWith('o1') || modelId.startsWith('o3')) return 'openai';
    if (modelId.startsWith('gemini')) return 'google';
    if (modelId.startsWith('deepseek')) return 'deepseek';
    return null;
}`,

'models-config.providers.normalize.ts': `/** Provider normalization. */
export { normalizeProviderId } from './provider-id.js';`,

'models-config.providers.policy.ts': `/** Provider policy configuration. */
export interface ProviderPolicy { maxRequestsPerMinute?: number; maxConcurrent?: number; allowStreaming?: boolean; }
export const DEFAULT_PROVIDER_POLICY: ProviderPolicy = { maxRequestsPerMinute: 60, maxConcurrent: 5, allowStreaming: true };`,

'models-config.providers.secrets.ts': `/** Provider secrets management. */
export { resolveApiKeyFromEnv } from './model-auth-env.js';`,

'models-config.providers.source-managed.ts': `/** Source-managed provider configurations. */
export type ProviderSource = 'env' | 'config' | 'oauth' | 'managed';
export function resolveProviderSource(provider: string): ProviderSource { return process.env[\`\${provider.toUpperCase()}_API_KEY\`] ? 'env' : 'config'; }`,

'models-config.providers.static.ts': `/** Static provider definitions. */
export const STATIC_PROVIDERS = ['openai', 'anthropic', 'google', 'deepseek', 'groq', 'mistral', 'together', 'fireworks'] as const;
export type StaticProvider = typeof STATIC_PROVIDERS[number];`,

// ─── Subagent Extensions ───
'subagent-announce-delivery.ts': `/** Subagent announcement delivery. */
export { announceSubagent, formatAnnouncement } from './subagent-announce.js';`,

'subagent-announce-dispatch.ts': `/** Subagent announcement dispatch. */
export { announceSubagent, getAnnouncements } from './subagent-announce.js';`,

'subagent-announce-output.ts': `/** Subagent announcement output formatting. */
export { formatAnnouncement } from './subagent-announce.js';
export function formatAnnouncementList(announcements: Array<{ agentId: string; status: string; task: string }>): string { return announcements.map((a) => \`[\${a.agentId}] \${a.status}: \${a.task}\`).join('\\n'); }`,

'subagent-announce-queue.ts': `/** Subagent announcement queue. */
const queue: Array<{ agentId: string; message: string; timestamp: number }> = [];
export function enqueueAnnouncement(agentId: string, message: string): void { queue.push({ agentId, message, timestamp: Date.now() }); }
export function drainQueue(): typeof queue { const items = [...queue]; queue.length = 0; return items; }
export function queueSize(): number { return queue.length; }`,

'subagent-registry-cleanup.ts': `/** Subagent registry cleanup. */
export function cleanupStaleEntries<T extends { lastActivityAt: number }>(entries: Map<string, T>, maxAgeMs: number): number { const cutoff = Date.now() - maxAgeMs; let removed = 0; for (const [k, v] of entries) { if (v.lastActivityAt < cutoff) { entries.delete(k); removed++; } } return removed; }`,

'subagent-registry-completion.ts': `/** Subagent completion tracking. */
export interface CompletionRecord { agentId: string; sessionId: string; status: 'success' | 'failure' | 'timeout'; duration: number; timestamp: number; }
const completions: CompletionRecord[] = [];
export function recordCompletion(record: Omit<CompletionRecord, 'timestamp'>): void { completions.push({ ...record, timestamp: Date.now() }); }
export function getCompletions(): readonly CompletionRecord[] { return completions; }
export function clearCompletions(): void { completions.length = 0; }`,

'subagent-registry-helpers.ts': `/** Subagent registry helper utilities. */
export function generateRegistryKey(parentId: string, agentId: string): string { return \`\${parentId}:\${agentId}\`; }
export function parseRegistryKey(key: string): { parentId: string; agentId: string } { const [parentId, agentId] = key.split(':'); return { parentId, agentId }; }`,

'subagent-registry-lifecycle.ts': `/** Subagent registry lifecycle management. */
export type RegistryLifecyclePhase = 'created' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
export function validateTransition(from: RegistryLifecyclePhase, to: RegistryLifecyclePhase): boolean {
    const valid: Record<string, string[]> = { created: ['starting'], starting: ['running', 'error'], running: ['stopping', 'error'], stopping: ['stopped', 'error'], stopped: [], error: ['starting'] };
    return valid[from]?.includes(to) ?? false;
}`,

'subagent-registry-memory.ts': `/** Subagent registry memory management. */
export function estimateEntryMemory(entry: { messages?: unknown[]; aggregated?: string }): number {
    let bytes = 200;
    if (entry.messages) bytes += entry.messages.length * 500;
    if (entry.aggregated) bytes += entry.aggregated.length * 2;
    return bytes;
}`,

'subagent-registry-queries.ts': `/** Subagent registry query utilities. */
export function filterByStatus<T extends { status: string }>(entries: T[], status: string): T[] { return entries.filter((e) => e.status === status); }
export function sortByTimestamp<T extends { timestamp?: number }>(entries: T[]): T[] { return [...entries].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)); }`,

'subagent-registry-read.ts': `/** Subagent registry read operations. */
export function getRegistrySnapshot<T>(registry: Map<string, T>): Array<[string, T]> { return [...registry.entries()]; }
export function findInRegistry<T>(registry: Map<string, T>, predicate: (v: T) => boolean): T | undefined { for (const v of registry.values()) { if (predicate(v)) return v; } return undefined; }`,

'subagent-registry-run-manager.ts': `/** Subagent run manager — concurrent execution slots. */
export class RunManager { private running = new Set<string>(); private maxConcurrent: number; constructor(max = 5) { this.maxConcurrent = max; } canRun(): boolean { return this.running.size < this.maxConcurrent; } start(id: string): boolean { if (!this.canRun()) return false; this.running.add(id); return true; } stop(id: string): void { this.running.delete(id); } count(): number { return this.running.size; } clear(): void { this.running.clear(); } }`,

'subagent-registry-runtime.ts': `/** Subagent registry runtime. */
export { SubagentRegistry } from './subagent-registry.js';`,

'subagent-registry-state.ts': `/** Subagent registry state types. */
export type RegistryState = 'empty' | 'active' | 'draining' | 'shutdown';
export function resolveRegistryState(activeCount: number, isShuttingDown: boolean): RegistryState { if (isShuttingDown) return activeCount > 0 ? 'draining' : 'shutdown'; return activeCount > 0 ? 'active' : 'empty'; }`,

'subagent-registry.store.ts': `/** Subagent registry store. */
export { SubagentRegistry } from './subagent-registry.js';`,

'subagent-registry.types.ts': `/** Subagent registry type definitions. */
export type { SubagentEntry } from './subagent-registry.js';`,

// ─── Session/Tool Result ───
'session-tool-result-guard.ts': `/** Tool result guard — validate results before sending. */
export function guardToolResult(result: string, maxLen = 200_000): { content: string; truncated: boolean } {
    if (result.length <= maxLen) return { content: result, truncated: false };
    return { content: result.slice(0, maxLen) + '\\n[truncated]', truncated: true };
}`,

'session-tool-result-guard-wrapper.ts': `/** Tool result guard wrapper. */
export { guardToolResult } from './session-tool-result-guard.js';`,

'session-tool-result-state.ts': `/** Tool result state tracking. */
const toolResultState = new Map<string, { count: number; totalChars: number }>();
export function recordToolResult(sessionId: string, chars: number): void { const s = toolResultState.get(sessionId) ?? { count: 0, totalChars: 0 }; s.count++; s.totalChars += chars; toolResultState.set(sessionId, s); }
export function getToolResultState(sessionId: string): { count: number; totalChars: number } { return toolResultState.get(sessionId) ?? { count: 0, totalChars: 0 }; }
export function clearToolResultState(): void { toolResultState.clear(); }`,

'session-file-repair.ts': `/** Session file repair — fix corrupted session files. */
export function repairJsonl(content: string): string[] { return content.split('\\n').filter((line) => { try { JSON.parse(line); return true; } catch { return false; } }); }`,

// ─── Skills ───
'skills-clawhub.ts': `/** Skills from ClawHub marketplace. */
export interface ClawHubSkill { id: string; name: string; version: string; url: string; }
export function buildClawHubUrl(skillId: string): string { return \`https://clawhub.dev/skills/\${skillId}\`; }`,

'skills-install.ts': `/** Skills installation. */
export interface SkillInstallResult { skillId: string; success: boolean; version?: string; error?: string; }
export function formatInstallResult(result: SkillInstallResult): string { return result.success ? \`✅ Installed \${result.skillId} v\${result.version}\` : \`❌ Failed: \${result.error}\`; }`,

'skills-install-download.ts': `/** Skill download management. */
export function buildDownloadUrl(registry: string, skillId: string, version: string): string { return \`\${registry}/\${skillId}/\${version}.tar.gz\`; }`,

'skills-install-extract.ts': `/** Skill archive extraction. */
export function getExtractDir(baseDir: string, skillId: string): string { return \`\${baseDir}/.coreblow/skills/\${skillId}\`; }`,

'skills-install-output.ts': `/** Skill installation output formatting. */
export function formatDownloadProgress(downloaded: number, total: number): string { const pct = total > 0 ? Math.round((downloaded / total) * 100) : 0; return \`Downloading: \${pct}%\`; }`,

'skills-install-tar-verbose.ts': `/** Skill tar extraction verbose logging. */
export function logExtraction(file: string): string { return \`  extracting: \${file}\`; }`,

'skills-install.download-test-utils.ts': `/** Skill download test utilities. */
export function createMockDownload(content: string): { data: Buffer; size: number } { const data = Buffer.from(content); return { data, size: data.length }; }`,

'skills-status.ts': `/** Skill status reporting. */
export type SkillStatus = 'installed' | 'available' | 'outdated' | 'error';
export function formatSkillStatus(name: string, status: SkillStatus): string { const icons: Record<SkillStatus, string> = { installed: '✅', available: '📦', outdated: '🔄', error: '❌' }; return \`\${icons[status]} \${name}: \${status}\`; }`,

// ─── Misc ───
'chutes-oauth.ts': `/** Chutes OAuth flow. */
export function buildChutesAuthUrl(clientId: string): string { return \`https://chutes.ai/oauth/authorize?client_id=\${clientId}\`; }`,

'custom-api-registry.ts': `/** Custom API endpoint registry. */
const customApis = new Map<string, { baseUrl: string; headers?: Record<string, string> }>();
export function registerCustomApi(name: string, baseUrl: string, headers?: Record<string, string>): void { customApis.set(name, { baseUrl, headers }); }
export function getCustomApi(name: string) { return customApis.get(name); }
export function listCustomApis(): string[] { return [...customApis.keys()]; }
export function clearCustomApis(): void { customApis.clear(); }`,

'compaction-real-conversation.ts': `/** Compaction test helper for real conversations. */
export { estimateTokens, estimateMessagesTokens, splitMessagesByTokenShare } from './compaction.js';`,

'embedded-pi-lsp.ts': `/** Embedded LSP bridge. */
export interface LspConfig { rootUri: string; capabilities?: string[]; }
export function createLspConfig(rootUri: string): LspConfig { return { rootUri, capabilities: ['completion', 'diagnostics', 'hover'] }; }`,

'embedded-pi-mcp.ts': `/** Embedded MCP bridge. */
export interface McpBridgeConfig { serverName: string; transport: 'stdio' | 'sse'; }
export function createMcpBridge(name: string, transport: 'stdio' | 'sse' = 'stdio'): McpBridgeConfig { return { serverName: name, transport }; }`,

'github-copilot-token.ts': `/** GitHub Copilot token resolution. */
export function resolveGithubCopilotToken(): string | undefined { return process.env.GITHUB_COPILOT_TOKEN ?? process.env.GITHUB_TOKEN; }`,

'live-auth-keys.ts': `/** Live auth key monitoring. */
export function maskKey(key: string): string { return key.length > 8 ? key.slice(0, 4) + '…' + key.slice(-4) : '***'; }
export function isKeyExpiring(expiresAt: number, warnMs = 86_400_000): boolean { return expiresAt - Date.now() < warnMs; }`,

'live-model-errors.ts': `/** Live model error tracking. */
const errors: Array<{ model: string; error: string; timestamp: number }> = [];
export function recordModelError(model: string, error: string): void { errors.push({ model, error, timestamp: Date.now() }); if (errors.length > 100) errors.splice(0, errors.length - 100); }
export function getRecentErrors(n = 10) { return errors.slice(-n); }
export function clearModelErrors() { errors.length = 0; }`,

'live-model-filter.ts': `/** Live model filtering. */
export function filterModels(models: Array<{ id: string; disabled?: boolean }>, query?: string): typeof models {
    let result = models.filter((m) => !m.disabled);
    if (query) result = result.filter((m) => m.id.toLowerCase().includes(query.toLowerCase()));
    return result;
}`,

'live-model-switch.ts': `/** Live model switching. */
export interface ModelSwitch { from: string; to: string; reason?: string; timestamp: number; }
const switches: ModelSwitch[] = [];
export function recordSwitch(from: string, to: string, reason?: string): void { switches.push({ from, to, reason, timestamp: Date.now() }); }
export function getSwitchHistory(): readonly ModelSwitch[] { return switches; }
export function clearSwitchHistory(): void { switches.length = 0; }`,

'live-test-helpers.ts': `/** Test helpers for live/integration tests. */
export function createMockResponse(content: string) { return { id: 'mock', content: [{ type: 'text', text: content }], model: 'mock', usage: { input_tokens: 10, output_tokens: 5 } }; }
export function waitMs(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }`,

'mcp-stdio.ts': `/** MCP stdio transport. */
export interface StdioTransportConfig { command: string; args?: string[]; env?: Record<string, string>; }
export function buildStdioArgs(config: StdioTransportConfig): string[] { return [config.command, ...(config.args ?? [])]; }`,

'memory-search.ts': `/** Memory/conversation search. */
export function searchMessages(messages: Array<{ content: string }>, query: string): number[] {
    const q = query.toLowerCase();
    return messages.map((m, i) => m.content.toLowerCase().includes(q) ? i : -1).filter((i) => i >= 0);
}`,

'minimax-vlm.ts': `/** MiniMax VLM integration. */
export const MINIMAX_MODELS = ['minimax-01'] as const;
export function isMinimaxModel(id: string): boolean { return id.startsWith('minimax'); }`,

'moonshot-provider-compat.ts': `/** Moonshot provider compatibility. */
export function isMoonshotModel(id: string): boolean { return id.startsWith('moonshot'); }
export function getMoonshotEndpoint(): string { return 'https://api.moonshot.cn/v1'; }`,

'coreblow-tools.ts': `/** CoreBlow tool definitions (compatibility). */
export const COREBLOW_TOOLS = ['bash', 'read', 'write', 'edit', 'search', 'glob', 'browser', 'mcp'] as const;
export type CoreBlowTool = typeof COREBLOW_TOOLS[number];
export function isCoreBlowTool(name: string): boolean { return COREBLOW_TOOLS.includes(name as CoreBlowTool); }`,

'opencode-zen-models.ts': `/** OpenCode Zen model definitions. */
export function isZenModel(id: string): boolean { return id.includes('zen'); }`,

'plugin-tool-delivery-defaults.ts': `/** Plugin tool delivery defaults. */
export const PLUGIN_TOOL_TIMEOUT_MS = 30_000;
export const PLUGIN_TOOL_MAX_OUTPUT = 100_000;
export const PLUGIN_TOOL_MAX_CONCURRENT = 3;`,

'provider-attribution.ts': `/** Provider attribution display. */
export function formatAttribution(provider: string, model: string): string { return \`Powered by \${provider} — \${model}\`; }`,

'pty-dsr.ts': `/** PTY Device Status Report handling. */
export function parseDsr(data: string): { row: number; col: number } | null { const m = data.match(/\\x1b\\[(\\d+);(\\d+)R/); return m ? { row: parseInt(m[1]), col: parseInt(m[2]) } : null; }`,

'pty-keys.ts': `/** PTY key sequence mapping. */
export const KEY_MAP: Record<string, string> = { up: '\\x1b[A', down: '\\x1b[B', right: '\\x1b[C', left: '\\x1b[D', enter: '\\r', tab: '\\t', escape: '\\x1b', backspace: '\\x7f' };
export function getKeySequence(key: string): string { return KEY_MAP[key] ?? key; }`,

'runtime-auth-refresh.ts': `/** Runtime auth token refresh. */
export async function refreshAuthToken(refreshToken: string, endpoint: string): Promise<{ accessToken: string; expiresAt: number } | null> {
    try { const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: refreshToken }) }); if (!res.ok) return null; return await res.json() as { accessToken: string; expiresAt: number }; } catch { return null; }
}`,

'runtime-plugins.ts': `/** Runtime plugin loading. */
export interface RuntimePlugin { id: string; name: string; enabled: boolean; }
export function loadRuntimePlugins(): RuntimePlugin[] { return []; /* populated at runtime */ }`,

'sandbox-media-paths.ts': `/** Sandbox media path validation. */
import path from 'node:path';
export function isMediaPath(filePath: string): boolean { const ext = path.extname(filePath).toLowerCase(); return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.mp4', '.webm', '.svg'].includes(ext); }`,

'sandbox-tool-policy.ts': `/** Sandbox-aware tool policy. */
export { Sandbox, createDefaultSandbox } from './sandbox.js';`,

'self-hosted-provider-defaults.ts': `/** Self-hosted provider defaults (Ollama, LM Studio, etc). */
export const OLLAMA_DEFAULT_URL = 'http://localhost:11434';
export const LMSTUDIO_DEFAULT_URL = 'http://localhost:1234/v1';
export function resolveSelfHostedUrl(provider: string): string | undefined { if (provider === 'ollama') return process.env.OLLAMA_HOST ?? OLLAMA_DEFAULT_URL; if (provider === 'lmstudio') return LMSTUDIO_DEFAULT_URL; return undefined; }`,

'simple-completion-runtime.ts': `/** Simple completion runtime (non-streaming). */
export { execCommand } from './bash-tools.js';`,

'simple-completion-transport.ts': `/** Simple completion transport. */
export interface CompletionRequest { model: string; messages: Array<{ role: string; content: string }>; maxTokens?: number; }
export interface CompletionResponse { content: string; usage: { inputTokens: number; outputTokens: number }; }`,

'spawned-context.ts': `/** Context passed to spawned agents. */
export interface SpawnedContext { parentSessionId: string; depth: number; task: string; model?: string; tools?: string[]; maxTurns?: number; }
export function createSpawnedContext(parentSessionId: string, task: string, depth = 0): SpawnedContext { return { parentSessionId, depth, task, maxTurns: 20 }; }`,

'stream-message-shared.ts': `/** Shared stream message types. */
export type StreamMessageType = 'text_delta' | 'tool_use_start' | 'tool_use_delta' | 'tool_use_end' | 'thinking' | 'usage' | 'done' | 'error';
export interface StreamMessage { type: StreamMessageType; content?: string; toolName?: string; toolId?: string; }`,

'system-prompt-params.ts': `/** System prompt parameter types. */
export interface SystemPromptParams { identity?: string; persona?: string; capabilities?: string[]; tools?: string[]; instructions?: string; context?: string; }
export function mergePromptParams(...params: Partial<SystemPromptParams>[]): SystemPromptParams { return Object.assign({}, ...params); }`,

'system-prompt-report.ts': `/** System prompt report generation. */
export function generatePromptReport(prompt: string): { charCount: number; estimatedTokens: number; sections: number } {
    return { charCount: prompt.length, estimatedTokens: Math.ceil(prompt.length / 4), sections: (prompt.match(/^##/gm) ?? []).length };
}`,

'tool-description-summary.ts': `/** Tool description summarization. */
export function summarizeToolDescription(desc: string, maxLen = 80): string { return desc.length <= maxLen ? desc : desc.slice(0, maxLen) + '…'; }`,

'tool-display-exec.ts': `/** Exec tool display formatting. */
export function formatExecDisplay(command: string, exitCode: number | null): string { const icon = exitCode === 0 ? '✅' : '❌'; return \`\${icon} \$ \${command} → exit \${exitCode ?? '?'}\`; }`,

'tool-display-exec-shell.ts': `/** Shell exec display. */
export function formatShellPrompt(cwd?: string): string { return \`\${cwd ?? '~'} $\`; }`,

'tool-images.ts': `/** Tool image handling. */
export { isAllowedImageType, validateImageInput, inferMimeType } from './image-sanitization.js';`,

'tool-policy-match.ts': `/** Tool policy pattern matching. */
export { globMatch, globMatchAny } from './glob-pattern.js';`,

'tool-policy-pipeline.ts': `/** Tool policy pipeline — chain multiple policies. */
import { ToolPolicy, type ToolPolicyResult } from './tool-policy.js';
export function evaluatePipeline(policies: ToolPolicy[], toolName: string): ToolPolicyResult {
    for (const policy of policies) { const result = policy.evaluate(toolName); if (result.decision !== 'allow') return result; }
    return { decision: 'allow' };
}`,

'tool-policy-shared.ts': `/** Shared tool policy utilities. */
export { isDangerousTool, DANGEROUS_TOOLS } from './tool-policy.js';`,

'tools-effective-inventory.ts': `/** Effective tool inventory — resolve enabled tools after policy. */
import { ToolCatalog } from './tool-catalog.js';
import { ToolPolicy } from './tool-policy.js';
export function getEffectiveTools(catalog: ToolCatalog, policy: ToolPolicy): string[] { return catalog.listEnabled().filter((t) => policy.evaluate(t.name).decision !== 'deny').map((t) => t.name); }`,

'workspace-dir.ts': `/** Workspace directory resolution. */
export { getWorkspaceDirs } from './workspace-dirs.js';`,

'workspace-run.ts': `/** Workspace command execution. */
export { execCommand } from './bash-tools.js';`,

'workspace-templates.ts': `/** Workspace template detection. */
export type WorkspaceTemplate = 'nextjs' | 'vite' | 'express' | 'fastapi' | 'unknown';
export function detectTemplate(files: string[]): WorkspaceTemplate {
    if (files.includes('next.config.js') || files.includes('next.config.ts')) return 'nextjs';
    if (files.includes('vite.config.ts') || files.includes('vite.config.js')) return 'vite';
    if (files.some((f) => f.includes('express'))) return 'express';
    if (files.includes('main.py') || files.includes('app.py')) return 'fastapi';
    return 'unknown';
}`,

'volc-models.shared.ts': `/** Volcengine model definitions. */
export function isVolcModel(id: string): boolean { return id.startsWith('volc-') || id.includes('doubao'); }`,
};

let created = 0;
for (const [filename, content] of Object.entries(modules)) {
    const filePath = path.join(AGENTS_DIR, filename);
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, content + '\n', 'utf-8');
        created++;
    }
}
console.log(`Created ${created} agent modules`);
