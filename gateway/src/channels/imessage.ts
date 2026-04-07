/**
 * src/channels/imessage.ts
 * iMessage channel adapter — via imsg CLI (macOS only)
 * SUPERIOR: CoreBlow = 16 files; CoreBlow = 1 file with all features
 * Features: RPC client, monitoring, send, reply threading, service detection, macOS check
 */

import type { ChannelAdapter, ChannelStatus } from './interface.js';
import { chunkMessage } from './interface.js';
import type { MessageRouter } from '../gateway/router.js';
import { createChildLogger } from '../utils/logger.js';
import { spawn, type ChildProcess, execSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import os from 'node:os';

const log = createChildLogger('channel:imessage');

// ─── Types ────────────────────────────────────────────────────────

export interface IMessageConfig {
 /** Path to imsg binary — default: 'imsg' */
 cliPath?: string;
 /** Path to iMessage database (chat.db) */
 dbPath?: string;
 /** Default service: 'iMessage' or 'SMS' */
 service?: 'iMessage' | 'SMS' | 'auto';
 /** Region code for phone number parsing */
 region?: string;
 /** Auto-reconnect on crashes */
 autoReconnect?: boolean;
 /** Max reconnect attempts */
 maxReconnectAttempts?: number;
 /** Reconnect delay (ms) */
 reconnectDelayMs?: number;
 /** Allowed contacts (empty = all) */
 allowedContacts?: string[];
 /** Blocked contacts */
 blockedContacts?: string[];
 /** Poll interval for new messages (ms) — used if RPC notifications unavailable */
 pollIntervalMs?: number;
}

export interface IMessageTarget {
 type: 'phone' | 'email' | 'chat_id';
 value: string;
 service?: 'iMessage' | 'SMS';
}

interface RpcRequest {
 jsonrpc: '2.0';
 method: string;
 id: number;
 params: Record<string, unknown>;
}

interface ImsgNotificationParams {
 sender?: string;
 from?: string;
 text?: string;
 body?: string;
 chat_id?: string;
 chatId?: string;
 message_id?: string;
 id?: string;
 guid?: string;
 senderName?: string;
 date?: string;
}
interface ImsgRpcResponse {
 id?: number | null;
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

export class IMessageChannel implements ChannelAdapter {
 name = 'imessage';
 private process: ChildProcess | null = null;
 private config: IMessageConfig;
 private connected = false;
 private startedAt = 0;
 private router?: MessageRouter;
 private pendingRpc = new Map<string, PendingRpc>();
 private nextId = 1;
 private reconnectAttempts = 0;
 private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
 private messagesSent = 0;
 private messagesReceived = 0;
 private echoCache = new Set<string>(); // Prevent echo of our own messages
 private echoCacheMaxSize = 100;

 constructor(config: IMessageConfig = {}) {
 this.config = {
 cliPath: 'imsg',
 service: 'auto',
 region: 'US',
 autoReconnect: true,
 maxReconnectAttempts: 10,
 reconnectDelayMs: 5000,
 pollIntervalMs: 3000,
 ...config,
 };
 }

 // ─── Lifecycle ───────────────────────────────────────────────

 async start(router: MessageRouter) {
 this.router = router;

 // macOS check
 if (!this.isMacOS()) {
 log.warn('iMessage channel requires macOS — disabled on this platform');
 return;
 }

 // Probe imsg binary
 if (!this.probe()) {
 log.warn('imsg binary not found — iMessage channel disabled');
 log.warn('Install: brew install imsg (or build from source)');
 return;
 }

 await this.startRpcClient();

 // Register sender
 router.registerChannelSender('imessage', async (msg) => {
 await this.sendMessage(msg.senderId || msg.targetId, msg.text, {
 replyToId: (msg.raw as Record<string, unknown>)?.replyToId as string | undefined,
 });
 });

 log.info('iMessage channel started');
 }

 async stop() {
 if (this.reconnectTimer) {
 clearTimeout(this.reconnectTimer);
 this.reconnectTimer = null;
 }
 await this.stopRpcClient();
 log.info('iMessage channel stopped');
 }

 isConnected() {
 return this.connected;
 }

 getStatus(): ChannelStatus {
 return {
 name: 'imessage',
 connected: this.connected,
 uptime: this.connected ? Date.now() - this.startedAt : 0,
 details: {
 platform: os.platform(),
 service: this.config.service,
 sent: this.messagesSent,
 received: this.messagesReceived,
 reconnectAttempts: this.reconnectAttempts,
 },
 };
 }

 // ─── Platform Detection ──────────────────────────────────────

 /**
 * Check if running on macOS
 */
 isMacOS(): boolean {
 return os.platform() === 'darwin';
 }

 /**
 * Check if imsg binary is available
 */
 probe(): boolean {
 try {
 execSync(`${this.config.cliPath} --version`, { stdio: 'pipe', timeout: 5000 });
 return true;
 } catch {
 return false;
 }
 }

 // ─── RPC Client ──────────────────────────────────────────────

 private async startRpcClient() {
 const args = ['rpc'];
 if (this.config.dbPath) {
 args.push('--db', this.config.dbPath);
 }

 this.process = spawn(this.config.cliPath!, args, {
 stdio: ['pipe', 'pipe', 'pipe'],
 });

 if (!this.process.stdout || !this.process.stdin) {
 throw new Error('Failed to start imsg process');
 }

 const rl = createInterface({ input: this.process.stdout });

 rl.on('line', (line) => {
 const trimmed = line.trim();
 if (!trimmed) return;
 this.handleLine(trimmed);
 });

 this.process.stderr?.on('data', (data) => {
 const msg = data.toString().trim();
 if (msg) log.debug({ stderr: msg.substring(0, 200) }, 'imsg stderr');
 });

 this.process.on('close', (code, signal) => {
 this.connected = false;
 this.failAllPending(new Error(`imsg exited (code=${code} signal=${signal})`));
 log.info({ code, signal }, 'imsg process exited');

 if (this.config.autoReconnect && this.reconnectAttempts < (this.config.maxReconnectAttempts || 10)) {
 this.scheduleReconnect();
 }
 });

 this.process.on('error', (err) => {
 log.error({ err: (err instanceof Error ? err.message : String(err)) }, 'imsg spawn error');
 this.connected = false;
 });

 this.connected = true;
 this.startedAt = Date.now();
 this.reconnectAttempts = 0;
 }

 private async stopRpcClient() {
 if (!this.process) return;

 this.process.stdin?.end();

 // Wait briefly then force kill
 await new Promise<void>((resolve) => {
 const timer = setTimeout(() => {
 if (this.process && !this.process.killed) {
 this.process.kill('SIGTERM');
 }
 resolve();
 }, 500);

 this.process?.on('close', () => {
 clearTimeout(timer);
 resolve();
 });
 });

 this.process = null;
 this.connected = false;
 }

 private scheduleReconnect() {
 this.reconnectAttempts++;
 const delay = (this.config.reconnectDelayMs || 5000) * Math.min(this.reconnectAttempts, 5);
 log.info({ attempt: this.reconnectAttempts, delayMs: delay }, 'Scheduling iMessage reconnect');

 this.reconnectTimer = setTimeout(async () => {
 try {
 await this.startRpcClient();
 log.info('iMessage reconnected successfully');
 } catch (err: unknown) {
 log.error({ err: (err instanceof Error ? err.message : String(err)) }, 'iMessage reconnect failed');
 if (this.reconnectAttempts < (this.config.maxReconnectAttempts || 10)) {
 this.scheduleReconnect();
 }
 }
 }, delay);
 }

 // ─── RPC Protocol ────────────────────────────────────────────

 private handleLine(line: string) {
 let parsed: ImsgRpcResponse;
 try {
 parsed = JSON.parse(line);
 } catch {
 log.debug({ raw: line.substring(0, 100) }, 'Non-JSON from imsg');
 return;
 }

 // Response to our request
 if (parsed.id !== undefined && parsed.id !== null) {
 const key = String(parsed.id);
 const pending = this.pendingRpc.get(key);
 if (pending) {
 this.pendingRpc.delete(key);
 clearTimeout(pending.timer);

 if (parsed.error) {
 const msg = parsed.error?.message || 'imsg RPC error';
 const code = parsed.error?.code;
 pending.reject(new Error(code ? `${msg} (code=${code})` : msg));
 } else {
 pending.resolve(parsed.result);
 }
 return;
 }
 }

 // Notification (incoming message)
 if (parsed.method) {
 this.handleNotification(String(parsed.method), (parsed.params || {}) as ImsgNotificationParams);
 }
 }

 private async handleNotification(method: string, params: ImsgNotificationParams) {
 if (method === 'message_received' || method === 'newMessage') {
 const sender = params?.sender || params?.from;
 const text = params?.text || params?.body || '';
 const chatId = params?.chat_id || params?.chatId;
 const messageId = params?.message_id || params?.id || params?.guid;

 if (!sender || !text) return;

 // Check echo cache (skip our own messages)
 if (messageId && this.echoCache.has(String(messageId))) {
 this.echoCache.delete(String(messageId));
 return;
 }

 // Check blocked
 if (this.config.blockedContacts?.includes(sender)) return;

 // Check allowed
 if (this.config.allowedContacts?.length && !this.config.allowedContacts.includes(sender)) return;

 this.messagesReceived++;

 const inbound = {
 channel: 'imessage' as const,
 senderId: sender,
 senderName: params?.senderName || sender,
 sessionId: `imessage:${chatId || sender}`,
 text,
 timestamp: params?.date ? new Date(params.date).getTime() : Date.now(),
 raw: { ...params, messageId, chatId },
 };

 await this.router?.routeInbound(inbound);
 }
 }

 /**
 * Send JSON-RPC request to imsg
 */
 private rpc(method: string, params: Record<string, unknown> = {}, timeoutMs = 15000): Promise<unknown> {
 return new Promise((resolve, reject) => {
 if (!this.process?.stdin) {
 reject(new Error('imsg not running'));
 return;
 }

 const id = this.nextId++;
 const request: RpcRequest = { jsonrpc: '2.0', id, method, params };
 const key = String(id);

 const timer = setTimeout(() => {
 this.pendingRpc.delete(key);
 reject(new Error(`imsg RPC timeout: ${method}`));
 }, timeoutMs);

 this.pendingRpc.set(key, { resolve: resolve as (value: unknown) => void, reject, timer });
 this.process.stdin.write(JSON.stringify(request) + '\n');
 });
 }

 private failAllPending(err: Error) {
 for (const [, pending] of this.pendingRpc) {
 clearTimeout(pending.timer);
 pending.reject(err);
 }
 this.pendingRpc.clear();
 }

 // ─── Sending ─────────────────────────────────────────────────

 /**
 * Send a text message
 */
 async sendMessage(to: string, text: string, opts?: { replyToId?: string; filePath?: string }): Promise<{ messageId?: string }> {
 const target = this.parseTarget(to);
 const chunks = chunkMessage(text, 4000);

 let lastResult: unknown;
 for (const chunk of chunks) {
 let message = chunk;

 // Prepend reply tag if needed
 if (opts?.replyToId) {
 message = `[[reply_to:${this.sanitizeReplyId(opts.replyToId)}]] ${message}`;
 }

 const params: Record<string, unknown> = {
 text: message,
 service: this.config.service || 'auto',
 region: this.config.region || 'US',
 };

 if (target.type === 'chat_id') {
 params.chat_id = parseInt(target.value);
 } else {
 params.to = target.value;
 }

 if (opts?.filePath) {
 params.file = opts.filePath;
 }

 lastResult = await this.rpc('send', params);
 this.messagesSent++;

 // Cache message ID to prevent echo
 const msgId = (lastResult as Record<string, unknown>)?.messageId || (lastResult as Record<string, unknown>)?.message_id || (lastResult as Record<string, unknown>)?.id;
 if (msgId) {
 this.echoCache.add(String(msgId));
 if (this.echoCache.size > this.echoCacheMaxSize) {
 // Remove oldest
 const first = this.echoCache.values().next().value;
 if (first) this.echoCache.delete(first);
 }
 }
 }

 return { messageId: ((lastResult as Record<string, unknown>)?.messageId || (lastResult as Record<string, unknown>)?.id || 'ok') as string };
 }

 // ─── Utilities ───────────────────────────────────────────────

 /**
 * Parse target string — phone (+1234...), email (user@icloud.com), chat_id (12345)
 */
 parseTarget(raw: string): IMessageTarget {
 const value = raw.trim();

 // Chat ID (numeric)
 if (/^\d+$/.test(value)) {
 return { type: 'chat_id', value };
 }

 // Email
 if (value.includes('@')) {
 return { type: 'email', value, service: 'iMessage' };
 }

 // Phone number
 return { type: 'phone', value };
 }

 /**
 * Detect if target supports iMessage vs SMS
 */
 async detectService(to: string): Promise<'iMessage' | 'SMS' | 'unknown'> {
 try {
 const result = await this.rpc('checkService', { to }) as Record<string, unknown> | null;
 if (result?.service === 'iMessage') return 'iMessage';
 if (result?.service === 'SMS') return 'SMS';
 return 'unknown';
 } catch {
 return 'unknown';
 }
 }

 /**
 * Get recent conversations
 */
 async getConversations(limit = 20): Promise<unknown[]> {
 try {
 return (await this.rpc('listChats', { limit })) as unknown[];
 } catch {
 return [];
 }
 }

 private sanitizeReplyId(id: string): string {
 return id.replace(/[\[\]\n\r]/g, '').substring(0, 256);
 }
}
