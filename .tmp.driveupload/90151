/**
 * Batch generator for remaining pi-* and runtime agent modules.
 */
import fs from 'node:fs';
import path from 'node:path';

const AGENTS_DIR = path.resolve(import.meta.dirname, '../src/agents');

const modules: Record<string, string> = {
// ─── Runtime re-exports ───
'auth-profiles.runtime.ts': `/** Runtime re-export. */ export { AuthProfileManager } from './auth-profiles.js';`,
'command-poll-backoff.runtime.ts': `/** Runtime re-export. */ export { ExponentialBackoff } from './command-poll-backoff.js';`,
'context-tokens.runtime.ts': `/** Context token utilities runtime. */ export { estimateTokens, estimateMessagesTokens } from './compaction.js';`,
'model-catalog.runtime.ts': `/** Runtime re-export. */ export { getBuiltinModels, findModel } from './model-catalog.js';`,
'model-suppression.runtime.ts': `/** Runtime re-export. */ export { suppressModel, isModelSuppressed, clearSuppressedModels } from './model-suppression.js';`,
'models-config.runtime.ts': `/** Runtime re-export. */ export { resolveModelConfig, mergeModelConfigs, validateModelsConfig } from './models-config.js';`,
'models-config.e2e-harness.ts': `/** E2E test harness for models-config. */ export { resolveModelConfig, mergeModelConfigs } from './models-config.js';`,
'openclaw-tools.runtime.ts': `/** Runtime re-export. */ export { OPENCLAW_TOOLS, isOpenClawTool } from './openclaw-tools.js';`,
'provider-model-normalization.runtime.ts': `/** Runtime re-export. */ export { normalizeProviderId, parseModelRef } from './provider-id.js';`,
'skills.e2e-test-helpers.ts': `/** E2E test helpers for skills. */ export function createMockSkill(id: string) { return { id, name: id, description: 'mock', category: 'test', enabled: true, version: '1.0.0' }; }`,
'subagent-registry.mocks.shared.ts': `/** Shared mocks for subagent registry tests. */ export function createMockRegistry() { return new Map<string, unknown>(); }`,
'tool-policy.conformance.ts': `/** Tool policy conformance checks. */ export { ToolPolicy } from './tool-policy.js'; export function isConformant(policy: unknown): boolean { return policy !== null && typeof policy === 'object'; }`,

// ─── PI Auth ───
'pi-auth-credentials.ts': `/** PI auth credential management. */
export interface PiCredential { provider: string; token: string; expiresAt?: number; }
export function isCredentialValid(cred: PiCredential): boolean { return !!cred.token && (!cred.expiresAt || cred.expiresAt > Date.now()); }
export function createCredential(provider: string, token: string, expiresAt?: number): PiCredential { return { provider, token, expiresAt }; }`,

'pi-auth-json.ts': `/** PI auth JSON serialization. */
export function serializeAuth(data: Record<string, unknown>): string { return JSON.stringify(data, null, 2); }
export function deserializeAuth(json: string): Record<string, unknown> | null { try { return JSON.parse(json); } catch { return null; } }`,

// ─── PI Embedded (Core Agent Runtime) ───
'pi-embedded.ts': `/** PI embedded agent — main entry. */
export interface PiEmbeddedConfig { model: string; provider: string; apiKey: string; maxTurns?: number; tools?: string[]; }
export function createPiEmbeddedConfig(model: string, provider: string, apiKey: string): PiEmbeddedConfig { return { model, provider, apiKey, maxTurns: 50 }; }`,

'pi-embedded.runtime.ts': `/** PI embedded runtime. */ export { createPiEmbeddedConfig, type PiEmbeddedConfig } from './pi-embedded.js';`,

'pi-embedded-runner.ts': `/** PI embedded runner — orchestrates the agent loop. */
export interface RunnerState { turnCount: number; isRunning: boolean; lastError?: string; }
export function createRunnerState(): RunnerState { return { turnCount: 0, isRunning: false }; }
export function incrementTurn(state: RunnerState): void { state.turnCount++; }`,

'pi-embedded-helpers.ts': `/** PI embedded helper utilities. */
export function truncateContent(content: string, maxLen = 50_000): string { return content.length <= maxLen ? content : content.slice(0, maxLen) + '\\n[truncated]'; }
export function formatTimestamp(ts: number): string { return new Date(ts).toISOString(); }`,

'pi-embedded-utils.ts': `/** PI embedded utility functions. */
export function safeJsonParse<T>(json: string, fallback: T): T { try { return JSON.parse(json) as T; } catch { return fallback; } }
export function generateRequestId(): string { return \`req_\${Date.now().toString(36)}_\${Math.random().toString(36).slice(2, 8)}\`; }`,

'pi-embedded-messaging.ts': `/** PI embedded message types. */
export interface PiMessage { role: 'system' | 'user' | 'assistant' | 'tool'; content: string | unknown[]; timestamp: number; }
export function createMessage(role: PiMessage['role'], content: string): PiMessage { return { role, content, timestamp: Date.now() }; }`,

'pi-embedded-payloads.ts': `/** PI embedded API payload construction. */
export interface ApiPayload { model: string; messages: Array<{ role: string; content: unknown }>; max_tokens?: number; tools?: unknown[]; }
export function buildPayload(model: string, messages: Array<{ role: string; content: unknown }>, maxTokens?: number): ApiPayload { return { model, messages, max_tokens: maxTokens }; }`,

'pi-embedded-block-chunker.ts': `/** PI embedded content block chunking. */
export function chunkBlocks(blocks: unknown[], maxPerChunk = 10): unknown[][] { const chunks: unknown[][] = []; for (let i = 0; i < blocks.length; i += maxPerChunk) chunks.push(blocks.slice(i, i + maxPerChunk)); return chunks; }`,

'pi-embedded-error-observation.ts': `/** PI embedded error observation. */
export interface ErrorObservation { error: string; provider: string; model: string; timestamp: number; retryable: boolean; }
export function createErrorObservation(error: string, provider: string, model: string, retryable = false): ErrorObservation { return { error, provider, model, timestamp: Date.now(), retryable }; }`,

'pi-embedded-queue.runtime.ts': `/** PI embedded message queue runtime. */
export class MessageQueue<T> { private items: T[] = []; enqueue(item: T): void { this.items.push(item); } dequeue(): T | undefined { return this.items.shift(); } peek(): T | undefined { return this.items[0]; } size(): number { return this.items.length; } clear(): void { this.items = []; } isEmpty(): boolean { return this.items.length === 0; } }`,

// ─── PI Embedded Subscribe (Event Stream) ───
'pi-embedded-subscribe.ts': `/** PI embedded subscription — event stream handler. */
export type SubscriptionEvent = 'message' | 'tool_use' | 'thinking' | 'error' | 'done';
export interface Subscription { id: string; events: SubscriptionEvent[]; handler: (event: SubscriptionEvent, data: unknown) => void; }
export function createSubscription(events: SubscriptionEvent[], handler: Subscription['handler']): Subscription { return { id: \`sub_\${Date.now().toString(36)}\`, events, handler }; }`,

'pi-embedded-subscribe.types.ts': `/** PI embedded subscribe types. */
export type { SubscriptionEvent, Subscription } from './pi-embedded-subscribe.js';`,

'pi-embedded-subscribe.handlers.ts': `/** PI embedded subscribe handlers aggregate. */
export { createSubscription } from './pi-embedded-subscribe.js';`,

'pi-embedded-subscribe.handlers.types.ts': `/** Handler type definitions. */
export type HandlerResult = { handled: boolean; shouldContinue: boolean; };
export function createHandlerResult(handled: boolean, shouldContinue = true): HandlerResult { return { handled, shouldContinue }; }`,

'pi-embedded-subscribe.handlers.lifecycle.ts': `/** Lifecycle event handlers. */
export function handleStart(): void { /* lifecycle start */ }
export function handleStop(): void { /* lifecycle stop */ }`,

'pi-embedded-subscribe.handlers.messages.ts': `/** Message event handlers. */
export function handleTextDelta(text: string): string { return text; }
export function handleMessageComplete(content: string): { role: string; content: string } { return { role: 'assistant', content }; }`,

'pi-embedded-subscribe.handlers.tools.ts': `/** Tool use event handlers. */
export function handleToolUseStart(toolName: string, toolId: string): { name: string; id: string } { return { name: toolName, id: toolId }; }
export function handleToolResult(toolId: string, result: string): { toolId: string; result: string } { return { toolId, result }; }`,

'pi-embedded-subscribe.handlers.compaction.ts': `/** Compaction event handlers. */
export { estimateMessagesTokens, pruneHistoryForContextShare } from './compaction.js';`,

'pi-embedded-subscribe.tools.ts': `/** PI embedded subscribe tool integration. */
export function shouldExecuteTool(toolName: string, allowedTools?: string[]): boolean { return !allowedTools || allowedTools.includes(toolName); }`,

'pi-embedded-subscribe.raw-stream.ts': `/** Raw SSE stream parsing. */
export function parseSSELine(line: string): { event?: string; data?: string } | null {
    if (line.startsWith('event: ')) return { event: line.slice(7) };
    if (line.startsWith('data: ')) return { data: line.slice(6) };
    return null;
}`,

'pi-embedded-subscribe.compaction-test-helpers.ts': `/** Compaction test helpers. */
export function createTestMessages(count: number): Array<{ role: string; content: string; timestamp: number }> {
    return Array.from({ length: count }, (_, i) => ({ role: i % 2 === 0 ? 'user' : 'assistant', content: \`Message \${i}\`, timestamp: Date.now() + i }));
}`,

'pi-embedded-subscribe.e2e-harness.ts': `/** E2E test harness for subscribe. */
export function createMockStream(chunks: string[]): AsyncIterable<string> { return { async *[Symbol.asyncIterator]() { for (const c of chunks) yield c; } }; }`,

// ─── PI Bundle ───
'pi-bundle-lsp-runtime.ts': `/** PI LSP bundle runtime. */
export { createLspConfig } from './embedded-pi-lsp.js';`,

'pi-bundle-mcp-tools.ts': `/** PI MCP tools bundle. */
export { createMcpBridge } from './embedded-pi-mcp.js';`,

// ─── PI Model Discovery ───
'pi-model-discovery.ts': `/** PI model discovery — enumerate available models. */
export interface DiscoveredModel { id: string; provider: string; contextWindow: number; }
export async function discoverModels(provider: string, apiKey: string): Promise<DiscoveredModel[]> { return []; /* implement per provider */ }`,

'pi-model-discovery-runtime.ts': `/** Runtime re-export. */ export { discoverModels } from './pi-model-discovery.js';`,

// ─── PI Settings ───
'pi-settings.ts': `/** PI agent settings. */
export interface PiSettings { theme?: 'dark' | 'light'; verbose?: boolean; autoApprove?: boolean; maxTurns?: number; }
export const DEFAULT_PI_SETTINGS: PiSettings = { theme: 'dark', verbose: false, autoApprove: false, maxTurns: 50 };`,

'pi-project-settings.ts': `/** PI project-level settings. */
export interface ProjectSettings { language?: string; framework?: string; testRunner?: string; packageManager?: string; }
export function detectProjectSettings(configFiles: string[]): ProjectSettings {
    const settings: ProjectSettings = {};
    if (configFiles.includes('tsconfig.json')) settings.language = 'typescript';
    if (configFiles.includes('next.config.js')) settings.framework = 'nextjs';
    if (configFiles.includes('vitest.config.ts')) settings.testRunner = 'vitest';
    return settings;
}`,

// ─── PI Tools ───
'pi-tools.ts': `/** PI tool definitions aggregate. */
export const PI_TOOLS = ['bash', 'read_file', 'write_file', 'edit_file', 'search', 'glob', 'browser'] as const;
export type PiTool = typeof PI_TOOLS[number];`,

'pi-tools.types.ts': `/** PI tool type definitions. */
export interface ToolInput { [key: string]: unknown; }
export interface ToolOutput { content: string; isError?: boolean; }`,

'pi-tools.schema.ts': `/** PI tool JSON schema definitions. */
export function buildToolSchema(name: string, description: string, properties: Record<string, unknown>): Record<string, unknown> {
    return { name, description, input_schema: { type: 'object', properties, required: Object.keys(properties) } };
}`,

'pi-tools.params.ts': `/** PI tool parameter extraction. */
export function extractParam<T>(input: Record<string, unknown>, key: string, fallback: T): T { return (input[key] as T) ?? fallback; }
export function requireParam(input: Record<string, unknown>, key: string): unknown { const val = input[key]; if (val === undefined) throw new Error(\`Missing required param: \${key}\`); return val; }`,

'pi-tools.read.ts': `/** PI read file tool. */
import fs from 'node:fs';
export function readFileTool(filePath: string, startLine?: number, endLine?: number): string {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (startLine === undefined) return content;
    const lines = content.split('\\n');
    return lines.slice((startLine ?? 1) - 1, endLine ?? lines.length).join('\\n');
}`,

'pi-tools.host-edit.ts': `/** PI host edit tool. */
export interface EditOperation { filePath: string; oldContent: string; newContent: string; }
export function validateEdit(op: EditOperation): { valid: boolean; error?: string } {
    if (!op.filePath) return { valid: false, error: 'Missing file path' };
    if (!op.oldContent && !op.newContent) return { valid: false, error: 'Empty edit' };
    return { valid: true };
}`,

'pi-tools.policy.ts': `/** PI tool policy. */
export { ToolPolicy, type PolicyDecision } from './tool-policy.js';`,

'pi-tools.abort.ts': `/** PI tool abort handling. */
export function createAbortController(timeoutMs?: number): { controller: AbortController; cleanup: () => void } {
    const controller = new AbortController();
    const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;
    return { controller, cleanup: () => { if (timer) clearTimeout(timer); } };
}`,

'pi-tools.before-tool-call.ts': `/** PI before-tool-call hooks. */
export type BeforeToolCallHook = (toolName: string, args: Record<string, unknown>) => { proceed: boolean; reason?: string };
export function createAutoApproveHook(safeTools: string[]): BeforeToolCallHook {
    return (toolName) => ({ proceed: safeTools.includes(toolName) });
}`,

'pi-tools.before-tool-call.runtime.ts': `/** Runtime re-export. */ export { createAutoApproveHook } from './pi-tools.before-tool-call.js';`,

'pi-tool-definition-adapter.ts': `/** Adapt tool definitions between formats. */
export function anthropicToOpenAI(tool: { name: string; description: string; input_schema: unknown }): { type: string; function: { name: string; description: string; parameters: unknown } } {
    return { type: 'function', function: { name: tool.name, description: tool.description, parameters: tool.input_schema } };
}`,
};

let created = 0;
for (const [filename, content] of Object.entries(modules)) {
    const filePath = path.join(AGENTS_DIR, filename);
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, content + '\n', 'utf-8');
        created++;
    }
}
console.log(`Created ${created} PI/runtime agent modules`);
