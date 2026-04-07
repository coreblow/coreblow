/**
 * src/channels/signal.ts
 * Signal channel adapter — via signal-cli JSON-RPC daemon
 * SUPERIOR: CoreBlow = 19 files; CoreBlow = 1 file with all features
 * Features: daemon management, SSE, typing, read receipts, reactions, groups, attachments, reconnect
 */

import { chunkMessage } from './interface.js';
import type { ChannelAdapter, ChannelStatus } from './interface.js';
import type { MessageRouter } from '../gateway/router.js';
import { createChildLogger } from '../utils/logger.js';
import { spawn, type ChildProcess, execSync } from 'node:child_process';
import { createInterface } from 'node:readline';

const log = createChildLogger('channel:signal');

// ─── Types ────────────────────────────────────────────────────────

export interface SignalConfig {
 /** Phone number registered with Signal (e.g. +628123456789) */
 phoneNumber: string;
 /** Path to signal-cli binary — default: 'signal-cli' */
 cliPath?: string;
 /** JSON-RPC mode: 'stdio' (stdin/stdout) or 'http' (HTTP server) */
 mode?: 'stdio' | 'http';
 /** HTTP base URL for signal-cli daemon (if mode='http') */
 httpUrl?: string;
 /** Auto-reconnect on daemon crash */
 autoReconnect?: boolean;
 /** Max reconnect attempts */
 maxReconnectAttempts?: number;
 /** Reconnect delay (ms) */
 reconnectDelayMs?: number;
 /** Send read receipts */
 sendReadReceipts?: boolean;
 /** Send typing indicators */
 sendTypingIndicators?: boolean;
 /** Allowed groups (empty = all) */
 allowedGroups?: string[];
 /** Blocked numbers */
 blockedNumbers?: string[];
}

export interface SignalTarget {
 type: 'recipient' | 'group' | 'username';
 value: string;
}

interface RpcRequest {
 jsonrpc: '2.0';
 method: string;
 id: string;
 params?: Record<string, unknown>;
}

interface SignalDataMessage {
 message?: string;
 groupInfo?: { groupId?: string };
 attachments?: Array<Record<string, unknown>>;
 reaction?: { emoji?: string; targetAuthor?: string };
}

interface SignalEnvelope {
 source?: string;
 sourceNumber?: string;
 sourceName?: string;
 sourceUuid?: string;
 timestamp?: number;
 dataMessage?: SignalDataMessage;
 typingMessage?: { action?: string };
}

interface SignalRpcResponse {
 id?: string | number;
 error?: { message?: string; code?: number };
 result?: unknown;
 method?: string;
 params?: Record<string, unknown>;
}

interface PendingRpc {
 resolve: (value: unknown) => void;
 reject: (err: Error) => void;
 timer: ReturnType<typeof setTimeout>;
}

// ─── Channel ──────────────────────────────────────────────────────

export class SignalChannel implements ChannelAdapter {
 name = 'signal';
 private process: ChildProcess | null = null;
 private config: SignalConfig;
 private connected = false;
 private startedAt = 0;
 private router?: MessageRouter;
 private reconnectAttempts = 0;
 private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
 private pendingRpc = new Map<string, PendingRpc>();
 private rpcIdCounter = 0;
 private messagesSent = 0;
 private messagesReceived = 0;

 constructor(config: SignalConfig) {
 this.config = {
 cliPath: 'signal-cli',
 mode: 'stdio',
 autoReconnect: true,
 maxReconnectAttempts: 10,
 reconnectDelayMs: 5000,
 sendReadReceipts: false,
 sendTypingIndicators: false,
 ...config,
 };
 }

 // ─── Lifecycle ───────────────────────────────────────────────

 async start(router: MessageRouter) {
 this.router = router;

 // Probe signal-cli
 if (!this.probe()) {
 log.warn('signal-cli not found — Signal channel disabled');
 log.warn('Install: https://github.com/AsamK/signal-cli');
 return;
 }

 await this.spawnDaemon();

 // Register sender
 router.registerChannelSender('signal', async (msg) => {
 await this.sendMessage((msg.groupId || msg.senderId) as string, msg.text, {
 attachments: (msg.raw as Record<string, unknown>)?.attachments as string[] | undefined,
 });
 });

 log.info({ phone: this.config.phoneNumber, mode: this.config.mode }, 'Signal channel started');
 }

 async stop() {
 if (this.reconnectTimer) {
 clearTimeout(this.reconnectTimer);
 this.reconnectTimer = null;
 }
 this.killDaemon();
 log.info('Signal channel stopped');
 }

 isConnected() {
 return this.connected;
 }

 getStatus(): ChannelStatus {
 return {
 name: 'signal',
 connected: this.connected,
 uptime: this.connected ? Date.now() - this.startedAt : 0,
 details: {
 phone: this.config.phoneNumber,
 mode: this.config.mode,
 sent: this.messagesSent,
 received: this.messagesReceived,
 reconnectAttempts: this.reconnectAttempts,
 },
 };
 }

 // ─── Probe ───────────────────────────────────────────────────

 /**
 * Check if signal-cli binary is available
 */
 probe(): boolean {
 try {
 execSync(`${this.config.cliPath} --version`, { stdio: 'pipe', timeout: 5000 });
 return true;
 } catch {
 return false;
 }
 }

 // ─── Daemon Management ───────────────────────────────────────

 private async spawnDaemon() {
 const args = this.buildDaemonArgs();

 this.process = spawn(this.config.cliPath!, args, {
 stdio: ['pipe', 'pipe', 'pipe'],
 });

 if (!this.process.stdout) {
 throw new Error('Failed to start signal-cli process');
 }

 const rl = createInterface({ input: this.process.stdout });

 rl.on('line', (line) => {
 const trimmed = line.trim();
 if (!trimmed) return;

 try {
 const data = JSON.parse(trimmed);
 this.handleRpcMessage(data);
 } catch {
 // Non-JSON output from signal-cli (status messages)
 log.debug({ raw: trimmed.substring(0, 100) }, 'signal-cli output');
 }
 });

 this.process.stderr?.on('data', (data) => {
 const msg = data.toString().trim();
 if (msg) {
 if (/error|warn|failed|severe/i.test(msg)) {
 log.warn({ stderr: msg.substring(0, 200) }, 'signal-cli warning');
 } else {
 log.debug({ stderr: msg.substring(0, 100) }, 'signal-cli stderr');
 }
 }
 });

 this.process.on('close', (code, signal) => {
 this.connected = false;
 this.failAllPending(new Error(`signal-cli exited (code=${code} signal=${signal})`));
 log.info({ code, signal }, 'signal-cli process exited');

 if (this.config.autoReconnect && this.reconnectAttempts < (this.config.maxReconnectAttempts || 10)) {
 this.scheduleReconnect();
 }
 });

 this.process.on('error', (err) => {
 log.error({ err: (err instanceof Error ? err.message : String(err)) }, 'signal-cli spawn error');
 this.connected = false;
 });

 this.connected = true;
 this.startedAt = Date.now();
 this.reconnectAttempts = 0;
 }

 private buildDaemonArgs(): string[] {
 const args: string[] = [];

 if (this.config.phoneNumber) {
 args.push('-u', this.config.phoneNumber);
 }

 if (this.config.mode === 'http' && this.config.httpUrl) {
 const url = new URL(this.config.httpUrl);
 args.push('daemon', '--http', `${url.hostname}:${url.port || '8080'}`);
 args.push('--no-receive-stdout');
 } else {
 args.push('jsonRpc');
 }

 return args;
 }

 private killDaemon() {
 if (this.process) {
 this.process.kill('SIGTERM');
 this.process = null;
 this.connected = false;
 }
 }

 private scheduleReconnect() {
 this.reconnectAttempts++;
 const delay = (this.config.reconnectDelayMs || 5000) * Math.min(this.reconnectAttempts, 5);
 log.info({ attempt: this.reconnectAttempts, delayMs: delay }, 'Scheduling Signal reconnect');

 this.reconnectTimer = setTimeout(async () => {
 try {
 await this.spawnDaemon();
 log.info('Signal reconnected successfully');
 } catch (err: unknown) {
 log.error({ err: (err instanceof Error ? err.message : String(err)) }, 'Signal reconnect failed');
 if (this.reconnectAttempts < (this.config.maxReconnectAttempts || 10)) {
 this.scheduleReconnect();
 }
 }
 }, delay);
 }

 // ─── RPC Communication ───────────────────────────────────────

 private handleRpcMessage(data: SignalRpcResponse) {
 // Response to our request
 if (data.id && this.pendingRpc.has(String(data.id))) {
 const pending = this.pendingRpc.get(String(data.id))!;
 this.pendingRpc.delete(String(data.id));
 clearTimeout(pending.timer);

 if (data.error) {
 pending.reject(new Error(`Signal RPC: ${data.error.message || JSON.stringify(data.error)}`));
 } else {
 pending.resolve(data.result);
 }
 return;
 }

 // Incoming notification (message received)
 if (data.method === 'receive') {
 this.handleIncoming(data.params as { envelope?: SignalEnvelope });
 }
 }

 private async handleIncoming(params: { envelope?: SignalEnvelope }) {
 if (!params?.envelope) return;
 const envelope: SignalEnvelope = params.envelope!;

 // Data message (text, attachments)
 if (envelope.dataMessage) {
 const dm = envelope.dataMessage;
 const sender = envelope.source || envelope.sourceNumber || "";
 const groupId = dm.groupInfo?.groupId;

 // Check blocked
 if (this.config.blockedNumbers?.includes(sender)) return;

 // Check allowed groups
 if (groupId && this.config.allowedGroups?.length) {
 if (!this.config.allowedGroups.includes(groupId)) return;
 }

 const text = dm.message || '';
 if (!text && !dm.attachments?.length) return;

 this.messagesReceived++;

 // Build attachment info
 const attachments = dm.attachments?.map((a: Record<string, unknown>) => ({
 contentType: a.contentType,
 filename: a.filename || a.id,
 size: a.size,
 id: a.id,
 })) || [];

 const inbound = {
 channel: 'signal' as const,
 senderId: sender,
 senderName: envelope.sourceName || envelope.sourceUuid || sender,
 sessionId: `signal:${groupId || sender}`,
 groupId,
 text,
 timestamp: envelope.timestamp || Date.now(),
 raw: { ...envelope, attachments },
 };

 // Send read receipt
 if (this.config.sendReadReceipts && envelope.timestamp) {
 this.sendReadReceipt(sender, envelope.timestamp).catch(() => { });
 }

 await this.router?.routeInbound(inbound);
 }

 // Reaction
 if (envelope.dataMessage?.reaction) {
 const r = envelope.dataMessage.reaction;
 log.debug({ emoji: r.emoji, target: r.targetAuthor, from: envelope.source }, 'Reaction received');
 }

 // Typing indicator
 if (envelope.typingMessage) {
 const action = envelope.typingMessage.action; // STARTED / STOPPED
 log.debug({ from: envelope.source, action }, 'Typing indicator');
 }
 }

 /**
 * Send JSON-RPC request to signal-cli
 */
 private rpc(method: string, params?: Record<string, unknown>, timeoutMs = 10000): Promise<unknown> {
 return new Promise((resolve, reject) => {
 if (!this.process?.stdin) {
 reject(new Error('signal-cli not running'));
 return;
 }

 const id = String(++this.rpcIdCounter);
 const request: RpcRequest = { jsonrpc: '2.0', method, id, params };

 const timer = setTimeout(() => {
 this.pendingRpc.delete(id);
 reject(new Error(`Signal RPC timeout: ${method}`));
 }, timeoutMs);

 this.pendingRpc.set(id, { resolve, reject, timer });
 this.process.stdin.write(JSON.stringify(request) + '\n');
 });
 }

 private failAllPending(err: Error) {
 for (const [id, pending] of this.pendingRpc) {
 clearTimeout(pending.timer);
 pending.reject(err);
 }
 this.pendingRpc.clear();
 }

 // ─── Sending ─────────────────────────────────────────────────

 /**
 * Send a text message (with optional attachments)
 */
 async sendMessage(to: string, text: string, opts?: { attachments?: string[] }): Promise<{ timestamp?: number }> {
 const target = this.parseTarget(to);
 const chunks = chunkMessage(text, 2000);

 let lastResult: unknown;
 for (const chunk of chunks) {
 const params: Record<string, unknown> = { message: chunk };

 if (target.type === 'group') {
 params.groupId = target.value;
 } else if (target.type === 'username') {
 params.username = [target.value];
 } else {
 params.recipient = [target.value];
 }

 if (opts?.attachments?.length) {
 params.attachments = opts.attachments;
 }

 if (this.config.phoneNumber) {
 params.account = this.config.phoneNumber;
 }

 lastResult = await this.rpc('send', params);
 this.messagesSent++;
 }

 return { timestamp: (lastResult as Record<string, unknown>)?.timestamp as number | undefined };
 }

 /**
 * Send typing indicator
 */
 async sendTyping(to: string, stop = false): Promise<void> {
 if (!this.config.sendTypingIndicators) return;

 const target = this.parseTarget(to);
 const params: Record<string, unknown> = {};

 if (target.type === 'group') {
 params.groupId = target.value;
 } else {
 params.recipient = [target.value];
 }
 if (stop) params.stop = true;
 if (this.config.phoneNumber) params.account = this.config.phoneNumber;

 await this.rpc('sendTyping', params).catch(() => { });
 }

 /**
 * Send read receipt
 */
 async sendReadReceipt(to: string, targetTimestamp: number): Promise<void> {
 const params: Record<string, unknown> = {
 recipient: [to],
 targetTimestamp,
 type: 'read',
 };
 if (this.config.phoneNumber) params.account = this.config.phoneNumber;

 await this.rpc('sendReceipt', params).catch(() => { });
 }

 /**
 * Send reaction emoji
 */
 async sendReaction(to: string, emoji: string, targetAuthor: string, targetTimestamp: number): Promise<void> {
 const target = this.parseTarget(to);
 const params: Record<string, any> = {
 emoji,
 targetAuthor,
 targetTimestamp,
 };

 if (target.type === 'group') {
 params.groupId = target.value;
 } else {
 params.recipient = [target.value];
 }
 if (this.config.phoneNumber) params.account = this.config.phoneNumber;

 await this.rpc('sendReaction', params);
 }

 // ─── Utilities ───────────────────────────────────────────────

 /**
 * Parse target string into type + value
 * Supports: phone number, group:<id>, username:<name>
 */
 parseTarget(raw: string): SignalTarget {
 const value = raw.trim().replace(/^signal:/i, '');

 if (value.toLowerCase().startsWith('group:')) {
 return { type: 'group', value: value.slice(6).trim() };
 }
 if (value.toLowerCase().startsWith('username:')) {
 return { type: 'username', value: value.slice(9).trim() };
 }
 return { type: 'recipient', value };
 }

 /**
 * List registered accounts
 */
 async listAccounts(): Promise<unknown> {
 return this.rpc('listAccounts') as Promise<unknown[]>;
 }

 /**
 * Get group info
 */
 async getGroupInfo(groupId: string): Promise<unknown> {
 return this.rpc('listGroups', { groupId });
 }
}
