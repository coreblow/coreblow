/**
 * CoreBlow Channel Framework — Unified Adapter Interface
 *
 * Defines the universal channel adapter contract that all messaging
 * integrations (Discord, Telegram, Slack, Signal, Line) implement.
 * Consolidates CoreBlow's 9 separate adapter types (Setup, Config,
 * Outbound, Gateway, Heartbeat, Directory, Security, etc.) into a
 * single clean interface with method groups.
 */

/** Supported channel identifiers */
export type ChannelId = 'discord' | 'telegram' | 'slack' | 'signal' | 'line' | 'whatsapp' | 'irc' | 'webchat' | 'teams' | 'matrix';

/** Normalized incoming message from any channel */
export interface ChannelMessage {
    /** Unique message ID from the platform */
    id: string;
    /** Source channel */
    channel: ChannelId;
    /** Sender identifier (platform-specific) */
    senderId: string;
    /** Sender display name */
    senderName?: string;
    /** Message text content */
    text: string;
    /** Chat context (DM or group identifier) */
    chatId: string;
    /** Whether this is a group/channel message */
    isGroup: boolean;
    /** Thread ID for threaded conversations */
    threadId?: string;
    /** Attachments */
    attachments?: ChannelAttachment[];
    /** ID of the message being replied to */
    replyToId?: string;
    /** Raw platform-specific message data */
    raw?: unknown;
    /** Timestamp */
    timestamp: number;
}

/** Attachment on an incoming message */
export interface ChannelAttachment {
    type: 'image' | 'audio' | 'video' | 'file';
    url?: string;
    fileName?: string;
    mimeType?: string;
    size?: number;
}

/** Outbound message to send through a channel */
export interface ChannelOutbound {
    /** Target chat/user ID */
    to: string;
    /** Message text (may contain markdown) */
    text: string;
    /** Reply to a specific message */
    replyToId?: string;
    /** Send in a thread */
    threadId?: string;
    /** Attachments to send */
    attachments?: Array<{
        type: 'image' | 'file';
        url?: string;
        buffer?: Buffer;
        fileName?: string;
    }>;
    /** Whether to send silently (no notification) */
    silent?: boolean;
    /** Platform-specific options */
    extra?: Record<string, unknown>;
}

/** Delivery result after sending */
export interface DeliveryResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

/** Health check result */
export interface ChannelHealth {
    connected: boolean;
    latencyMs?: number;
    accountName?: string;
    error?: string;
}

/** Channel adapter configuration */
export interface ChannelConfig {
    enabled: boolean;
    token?: string;
    apiKey?: string;
    accountId?: string;
    webhookUrl?: string;
    allowFrom?: string[];
    /** Owner user IDs for admin commands */
    ownerIds?: string[];
    /** DM access policy */
    dmPolicy?: 'open' | 'allowlist' | 'pairing' | 'closed';
    /** Default outbound target */
    defaultTo?: string;
    /** Group-specific tool policies */
    groupPolicies?: Record<string, { allowedTools?: string[]; blockedTools?: string[]; requireMention?: boolean }>;
    [key: string]: unknown;
}

/**
 * Unified Channel Adapter — every messaging channel implements this.
 */
export interface ChannelAdapter {
    /** Channel identifier */
    readonly id: ChannelId;
    /** Human-readable channel name */
    readonly name: string;

    // === Lifecycle ===

    /** Connect to the messaging platform */
    connect(config: ChannelConfig): Promise<void>;
    /** Disconnect cleanly */
    disconnect(): Promise<void>;
    /** Check connection health */
    health(): Promise<ChannelHealth>;

    // === Messaging ===

    /** Send an outbound message */
    send(outbound: ChannelOutbound): Promise<DeliveryResult>;
    /** Register a handler for incoming messages */
    onMessage(handler: (msg: ChannelMessage) => void): void;

    // === Optional ===

    /** Format markdown text for the platform (e.g. Slack uses mrkdwn) */
    formatText?(text: string): string;
    /** Get maximum message length for the platform */
    maxMessageLength?(): number;
    /** Chunk text to fit platform limits */
    chunkText?(text: string): string[];
}

// ============================================================
// Multi-Account Mixin — optional interface for multi-account channels
// ============================================================

/** Account snapshot for dashboard/status display */
export interface AccountSnapshot {
    accountId: string;
    channelId: ChannelId;
    enabled: boolean;
    configured: boolean;
    connected: boolean;
    displayName?: string;
    avatarUrl?: string;
    lastActivity?: number;
    error?: string;
    extra?: Record<string, unknown>;
}

/**
 * Multi-account capable adapter — channels implement this for multi-bot support.
 */
export interface AccountAwareAdapter extends ChannelAdapter {
    /** List all configured account IDs */
    listAccounts(): string[];
    /** Resolve account config by ID */
    resolveAccount(accountId: string): ChannelConfig | null;
    /** Enable or disable an account */
    setAccountEnabled(accountId: string, enabled: boolean): void;
    /** Remove an account entirely */
    deleteAccount(accountId: string): boolean;
    /** Get snapshot for dashboard display */
    getAccountSnapshot(accountId: string): AccountSnapshot | null;
}

/** Type guard to check if an adapter supports multi-account */
export function isAccountAware(adapter: ChannelAdapter): adapter is AccountAwareAdapter {
    return 'listAccounts' in adapter && typeof (adapter as AccountAwareAdapter).listAccounts === 'function';
}

// ============================================================
// QR Login Mixin — optional interface for QR-code-based auth
// ============================================================

/** QR login start result */
export interface QrLoginStartResult {
    qrDataUrl?: string;
    message: string;
}

/** QR login wait result */
export interface QrLoginWaitResult {
    connected: boolean;
    message: string;
}

/**
 * QR login capable adapter — channels implement for QR code authentication.
 */
export interface QrLoginAdapter extends ChannelAdapter {
    /** Start QR login flow, returns QR code data URL */
    loginWithQrStart(opts?: { accountId?: string; force?: boolean; timeoutMs?: number }): Promise<QrLoginStartResult>;
    /** Wait for QR scan completion */
    loginWithQrWait(opts?: { accountId?: string; timeoutMs?: number }): Promise<QrLoginWaitResult>;
    /** Logout and clear session */
    logout(accountId?: string): Promise<{ cleared: boolean; loggedOut?: boolean }>;
}

/** Type guard to check if an adapter supports QR login */
export function isQrLoginCapable(adapter: ChannelAdapter): adapter is QrLoginAdapter {
    return 'loginWithQrStart' in adapter && typeof (adapter as QrLoginAdapter).loginWithQrStart === 'function';
}

// ============================================================
// Adapter Registry
// ============================================================

/** Channel adapter registry */
const adapterRegistry = new Map<ChannelId, ChannelAdapter>();

/**
 * Register a channel adapter.
 */
export function registerAdapter(adapter: ChannelAdapter): void {
    adapterRegistry.set(adapter.id, adapter);
}

/**
 * Get a registered adapter by ID.
 */
export function getAdapter(id: ChannelId): ChannelAdapter | null {
    return adapterRegistry.get(id) ?? null;
}

/**
 * List all registered adapters.
 */
export function listAdapters(): ChannelAdapter[] {
    return Array.from(adapterRegistry.values());
}

/**
 * Clear all registered adapters (for testing).
 */
export function clearAdapters(): void {
    adapterRegistry.clear();
}
