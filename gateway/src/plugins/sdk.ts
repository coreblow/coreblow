/**
 * src/plugins/sdk.ts
 * CoreBlow Plugin SDK — Extension interface & types
 *
 * Every extension implements CoreBlowExtension.
 * Extensions can provide: channels, tools, skills, providers, or hooks.
 */

import type { ToolHandler } from '../tools/types.js';

/**
 * Extension metadata
 */
export interface ExtensionMeta {
    name: string;
    version: string;
    description: string;
    author?: string;
    homepage?: string;
    license?: string;
    tags?: string[];
}

/**
 * Channel adapter interface (for plugin channels)
 */
export interface PluginChannel {
    name: string;
    start(context: ExtensionContext): Promise<void>;
    stop(): Promise<void>;
    isConnected(): boolean;
    send?(target: string, text: string): Promise<void>;
}

/**
 * Extension config schema (declarative config UI)
 */
export interface ConfigField {
    key: string;
    label: string;
    type: 'string' | 'number' | 'boolean' | 'select' | 'password';
    required?: boolean;
    default?: unknown;
    options?: string[];  // for select type
    description?: string;
}

/**
 * Lifecycle hooks
 */
export interface ExtensionHooks {
    onMessage?(message: unknown): Promise<void>;         // intercept inbound
    onResponse?(response: unknown): Promise<void>;       // intercept outbound
    onToolCall?(toolName: string, args: unknown): Promise<unknown>;  // intercept tool
    onSessionStart?(sessionId: string): Promise<void>;
    onSessionEnd?(sessionId: string): Promise<void>;
    onConfigChange?(config: unknown): Promise<void>;
}

/**
 * Context passed to extensions during initialization
 */
export interface ExtensionContext {
    config: Record<string, unknown>;        // extension config from config.json
    homeDir: string;                     // ~/.coreblow/
    dataDir: string;                     // ~/.coreblow/extensions/<name>/
    logger: { info(msg: string): void; warn(msg: string): void; error(msg: string): void; debug(msg: string): void };
    gateway: {
        port: number;
        host: string;
        sendMessage(channel: string, target: string, text: string): Promise<void>;
        registerTool(tool: ToolHandler): void;
        registerChannelSender(channel: string, sender: Function): void;
    };
}

/**
 * The main extension interface — implement this to create an extension
 */
export interface CoreBlowExtension {
    /** Extension metadata */
    meta: ExtensionMeta;

    /** Optional: channel adapter */
    channel?: PluginChannel;

    /** Optional: tools provided by this extension */
    tools?: ToolHandler[];

    /** Optional: config schema for dashboard/CLI */
    configSchema?: ConfigField[];

    /** Optional: lifecycle hooks */
    hooks?: ExtensionHooks;

    /**
     * Initialize the extension
     * Called once when the extension is loaded
     */
    init(context: ExtensionContext): Promise<void>;

    /**
     * Start the extension (connect channels, start services)
     */
    start?(): Promise<void>;

    /**
     * Stop the extension (disconnect, cleanup)
     */
    stop?(): Promise<void>;

    /**
     * Health check
     */
    healthCheck?(): Promise<{ ok: boolean; details?: string }>;
}

/**
 * Loaded extension (used by registry)
 */
export interface LoadedExtension {
    extension: CoreBlowExtension;
    enabled: boolean;
    dataDir: string;
}

/**
 * Helper: create a simple extension
 */
export function defineExtension(ext: CoreBlowExtension): CoreBlowExtension {
    return ext;
}
