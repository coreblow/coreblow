
import type { HookName, HookHandler, BlowPluginHookOptions } from "./types.hooks.js";
import type { ProviderPlugin, SpeechProviderPlugin, ImageGenerationProviderPlugin, WebSearchProviderPlugin } from "./types.provider.js";
import type { PluginLogger } from "./types.base.js";

export type HttpRouteAuth = 'gateway' | 'plugin';
export type HttpRouteMatch = 'exact' | 'prefix';

export type HttpRouteHandler = (req: unknown, res: unknown) => void | Promise<void>;

export type BlowPluginHttpRouteParams = {
    path: string;
    handler: HttpRouteHandler;
    auth: HttpRouteAuth;
    match?: HttpRouteMatch;
    replaceExisting?: boolean;
};

export type BlowPluginService = {
    id: string;
    name?: string;
    start?: () => Promise<void>;
    stop?: () => Promise<void>;
    healthCheck?: () => Promise<{ healthy: boolean; error?: string }>;
};

export type ChannelPlugin = {
    id: string;
    name: string;
    description?: string;
    setup?: (ctx: Record<string, unknown>) => Promise<void>;
    handleMessage?: (msg: unknown) => Promise<unknown>;
};

export type BlowPluginCliDescriptor = {
    name: string;
    description: string;
    hasSubcommands?: boolean;
};

export type BlowPluginCliRegistrar = (program: unknown) => void;

export type BlowPluginCommandDefinition = {
    name: string;
    description: string;
    handler: (args: Record<string, unknown>) => Promise<unknown>;
    parameters?: Record<string, unknown>;
};

export type BlowPluginToolContext = {
    config?: Record<string, unknown>;
    workspaceDir?: string;
    agentId?: string;
    sessionKey?: string;
    sessionId?: string;
    sandboxed?: boolean;
    browser?: { sandboxBridgeUrl?: string; allowHostControl?: boolean };
};

export type AgentTool = {
    name: string;
    description: string;
    parameters?: Record<string, unknown>;
    execute: (params: Record<string, unknown>, ctx?: BlowPluginToolContext) => Promise<unknown>;
};

export type BlowPluginToolFactory = (ctx: BlowPluginToolContext) => AgentTool | AgentTool[] | null | undefined;

export type BlowPluginToolOptions = {
    name?: string;
    names?: string[];
    optional?: boolean;
};

export type BlowPluginApi = {
    registerTool: (tool: AgentTool | BlowPluginToolFactory, opts?: BlowPluginToolOptions) => void;
    registerHook: <K extends HookName>(hookName: K, handler: HookHandler, opts?: BlowPluginHookOptions) => void;
    registerProvider: (provider: ProviderPlugin) => void;
    registerChannel: (channel: ChannelPlugin) => void;
    registerHttpRoute: (params: BlowPluginHttpRouteParams) => void;
    registerService: (service: BlowPluginService) => void;
    registerCli: (registrar: BlowPluginCliRegistrar, opts?: { descriptors?: BlowPluginCliDescriptor[] }) => void;
    registerCommand: (command: BlowPluginCommandDefinition) => void;
    registerSpeechProvider: (provider: SpeechProviderPlugin) => void;
    registerImageGenerationProvider: (provider: ImageGenerationProviderPlugin) => void;
    registerWebSearchProvider: (provider: WebSearchProviderPlugin) => void;
    registerGatewayMethod: (method: string, handler: HttpRouteHandler) => void;
    config: Record<string, unknown>;
    logger: PluginLogger;
};
