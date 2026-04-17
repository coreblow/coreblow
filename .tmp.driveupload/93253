/**
 * plugins/types.ts
 *
 * Central type hub for the CoreBlow plugin system.
 * Following CoreBlow's types.ts pattern (2,410 LOC) — consolidated type
 * definitions used by registry, loader, hooks, SDK, and all plugin subsystems.
 *
 * CoreBlow OOP pattern: single canonical export surface.
 */

// ─── Re-exports from turn-engine plugin types ────────────────────
import type {
    PluginId,
    PluginLogger,
    PluginFormat,
    PluginBundleFormat,
    PluginOrigin,
    PluginStatus,
    PluginRegistrationMode,
    PluginKind,
    PluginConfigUiHint,
    PluginConfigValidation,
    PluginConfigSchema,
    PluginDiagnostic,
    PluginRecord,
} from '../agents/turn-engine/plugins/types.base.js';

export type {
    PluginId,
    PluginLogger,
    PluginFormat,
    PluginBundleFormat,
    PluginOrigin,
    PluginStatus,
    PluginRegistrationMode,
    PluginKind,
    PluginConfigUiHint,
    PluginConfigValidation,
    PluginConfigSchema,
    PluginDiagnostic,
    PluginRecord,
};

export {
    toPluginId,
    createPluginRecord,
} from '../agents/turn-engine/plugins/types.base.js';

export type {
    HookName,
    HookHandler,
    HookRegistration,
    BlowPluginHookOptions,
} from '../agents/turn-engine/plugins/types.hooks.js';

export type {
    HttpRouteAuth,
    HttpRouteMatch,
    HttpRouteHandler,
    BlowPluginHttpRouteParams,
    BlowPluginService,
    ChannelPlugin,
    BlowPluginCliDescriptor,
    BlowPluginCliRegistrar,
    BlowPluginCommandDefinition,
    BlowPluginToolContext,
    AgentTool,
    BlowPluginToolFactory,
    BlowPluginToolOptions,
    BlowPluginApi,
} from '../agents/turn-engine/plugins/types.lifecycle.js';

export type {
    ProviderAuthKind,
    ProviderAuthResult,
    ProviderAuthMethod,
    ProviderCatalogResult,
    ProviderPlugin,
    SpeechProviderPlugin,
    ImageGenerationProviderPlugin,
    WebSearchProviderPlugin,
} from '../agents/turn-engine/plugins/types.provider.js';

// ─── Plugin Exports (SDK contract) ──────────────────────────────

/** Context provided to plugins during activation */
export interface PluginContext {
    pluginId: string;
    pluginDir: string;
    config: Record<string, unknown>;
    log: PluginContextLogger;
    events: PluginEventBus;
    api: PluginApiSurface;
}

/** Plugin logger within context */
export interface PluginContextLogger {
    info(msg: string, ...args: unknown[]): void;
    warn(msg: string, ...args: unknown[]): void;
    error(msg: string, ...args: unknown[]): void;
    debug(msg: string, ...args: unknown[]): void;
}

/** Plugin event bus for plugin ↔ core communication */
export interface PluginEventBus {
    emit(event: string, data?: unknown): void;
    on(event: string, handler: (data: unknown) => void): void;
    off(event: string, handler: (data: unknown) => void): void;
}

/** Plugin API surface — registration methods exposed to plugin activate() */
export interface PluginApiSurface {
    registerTool(tool: PluginTool): void;
    registerCommand(command: PluginCommand): void;
    registerHook(hook: PluginHook): void;
    registerProvider(provider: PluginProvider): void;
}

// ─── Plugin Definition Types (used by definePlugin SDK) ──────────

/** Plugin command — a slash command provided by a plugin */
export interface PluginCommand {
    name: string;
    description: string;
    handler: (args: string[]) => Promise<string>;
}

/** Plugin tool — an agent tool provided by a plugin */
export interface PluginTool {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    execute: (params: Record<string, unknown>) => Promise<unknown>;
}

/** Plugin hook — an event hook provided by a plugin */
export interface PluginHook {
    event: string;
    handler: (...args: unknown[]) => Promise<unknown>;
    priority: number;
}

/** Plugin provider — an LLM provider provided by a plugin */
export interface PluginProvider {
    name: string;
    models: string[];
    chat: (messages: unknown[], options: unknown) => Promise<unknown>;
}

/** Plugin exports — the object returned by definePlugin() */
export interface PluginExports {
    activate?: (ctx: PluginContext) => Promise<void>;
    deactivate?: () => Promise<void>;
    commands: PluginCommand[];
    hooks: PluginHook[];
    providers: PluginProvider[];
    tools: PluginTool[];
}

// ─── Plugin Module Resolution ────────────────────────────────────

/** Plugin module — what importing a plugin entry point yields */
export interface PluginModule {
    default?: PluginDefinition;
    register?: PluginDefinition['register'];
}

/** Plugin definition — the shape a plugin module can export */
export interface PluginDefinition {
    register?: (api: PluginApiSurface, ctx: PluginContext) => void | Promise<void>;
    activate?: (api: PluginApiSurface, ctx: PluginContext) => void | Promise<void>;
    deactivate?: () => void | Promise<void>;
}

// ─── Hook Event/Result Types (following CoreBlow's typed hooks) ──

/** Hook name union — all supported plugin hook points */
export type PluginHookName =
    | 'before_agent_start' | 'agent_end'
    | 'before_model_resolve' | 'before_prompt_build'
    | 'llm_input' | 'llm_output'
    | 'before_compaction' | 'after_compaction' | 'before_reset'
    | 'message_received' | 'message_sending' | 'message_sent'
    | 'before_dispatch' | 'inbound_claim'
    | 'before_tool_call' | 'after_tool_call' | 'tool_result_persist'
    | 'session_start' | 'session_end'
    | 'subagent_spawning' | 'subagent_spawned' | 'subagent_ended'
    | 'gateway_start' | 'gateway_stop'
    | 'before_message_write';

/** Check if a string is a valid plugin hook name */
export function isPluginHookName(name: string): name is PluginHookName {
    return PLUGIN_HOOK_NAMES.has(name as PluginHookName);
}

const PLUGIN_HOOK_NAMES = new Set<PluginHookName>([
    'before_agent_start', 'agent_end',
    'before_model_resolve', 'before_prompt_build',
    'llm_input', 'llm_output',
    'before_compaction', 'after_compaction', 'before_reset',
    'message_received', 'message_sending', 'message_sent',
    'before_dispatch', 'inbound_claim',
    'before_tool_call', 'after_tool_call', 'tool_result_persist',
    'session_start', 'session_end',
    'subagent_spawning', 'subagent_spawned', 'subagent_ended',
    'gateway_start', 'gateway_stop',
    'before_message_write',
]);

/** Typed hook registration — associates handler with specific hook */
export type PluginHookRegistration<K extends PluginHookName = PluginHookName> = {
    hookName: K;
    pluginId: string;
    handler: (event: unknown, ctx: Record<string, unknown>) => unknown | Promise<unknown>;
    priority?: number;
    source?: string;
};

/** Hook handler map — typed event/result pairs per hook name */
export type PluginHookHandlerMap = {
    [K in PluginHookName]: (event: unknown, ctx: Record<string, unknown>) => unknown | Promise<unknown>;
};

// ─── Registration Types (used by PluginRegistry) ─────────────────

/** Tool registration record */
export type PluginToolRegistration = {
    pluginId: string;
    pluginName?: string;
    tool: PluginTool;
    names: string[];
    optional: boolean;
    source: string;
    rootDir?: string;
};

/** Hook registration record (legacy string-based) */
export type PluginLegacyHookRegistration = {
    pluginId: string;
    events: string[];
    source: string;
    rootDir?: string;
};

/** Channel registration record */
export type PluginChannelRegistration = {
    pluginId: string;
    pluginName?: string;
    plugin: { id: string; name: string; [key: string]: unknown };
    source: string;
    rootDir?: string;
};

/** Provider registration record */
export type PluginProviderRegistration = {
    pluginId: string;
    pluginName?: string;
    provider: { id: string; name: string; [key: string]: unknown };
    source: string;
    rootDir?: string;
};

/** Service registration record */
export type PluginServiceRegistration = {
    pluginId: string;
    pluginName?: string;
    service: { id: string; name?: string; start?: () => Promise<void>; stop?: () => Promise<void>; healthCheck?: () => Promise<{ healthy: boolean; error?: string }> };
    source: string;
    rootDir?: string;
};

/** Command registration record */
export type PluginCommandRegistration = {
    pluginId: string;
    pluginName?: string;
    command: PluginCommand;
    source: string;
    rootDir?: string;
};

/** HTTP route registration record */
export type PluginHttpRouteRegistration = {
    pluginId?: string;
    path: string;
    handler: (req: unknown, res: unknown) => void | Promise<void>;
    auth: 'gateway' | 'plugin';
    match: 'exact' | 'prefix';
    source?: string;
};

// ─── Full Plugin Registry Shape ──────────────────────────────────

/**
 * PluginRegistryData — the data shape of a fully loaded plugin registry.
 * Mirrors CoreBlow's `PluginRegistry` type.
 */
export type PluginRegistryData = {
    plugins: PluginRecord[];
    tools: PluginToolRegistration[];
    hooks: PluginLegacyHookRegistration[];
    typedHooks: PluginHookRegistration[];
    channels: PluginChannelRegistration[];
    providers: PluginProviderRegistration[];
    services: PluginServiceRegistration[];
    commands: PluginCommandRegistration[];
    httpRoutes: PluginHttpRouteRegistration[];
    diagnostics: import('../agents/turn-engine/plugins/types.base.js').PluginDiagnostic[];
};

/** Create an empty PluginRegistryData */
export function createEmptyPluginRegistryData(): PluginRegistryData {
    return {
        plugins: [],
        tools: [],
        hooks: [],
        typedHooks: [],
        channels: [],
        providers: [],
        services: [],
        commands: [],
        httpRoutes: [],
        diagnostics: [],
    };
}

// ─── Plugin Install Types ────────────────────────────────────────

/** Plugin install record — persisted in config */
export type PluginInstallRecord = {
    pluginId: string;
    version?: string;
    source: 'npm' | 'git' | 'local' | 'marketplace';
    installPath?: string;
    sourcePath?: string;
    installedAt: number;
    updatedAt?: number;
};

// ─── Marketplace Types ───────────────────────────────────────────

/** Marketplace plugin listing */
export type MarketplacePlugin = {
    id: string;
    name: string;
    version: string;
    description: string;
    author?: string;
    homepage?: string;
    tags?: string[];
    downloads?: number;
    rating?: number;
    provides?: string[];
    permissions?: string[];
    verified?: boolean;
};

/** Marketplace search options */
export type MarketplaceSearchOptions = {
    query?: string;
    tags?: string[];
    author?: string;
    provides?: string[];
    limit?: number;
    offset?: number;
    sort?: 'relevance' | 'downloads' | 'newest' | 'rating';
};
