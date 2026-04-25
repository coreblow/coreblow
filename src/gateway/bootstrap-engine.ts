// @ts-nocheck
/**
 * gateway/bootstrap-engine.ts
 * Initialize AgentEngine during server startup.
 */
import { AgentEngine } from '../agents/agent-engine.js';
import { AgentStreamBridge } from '../agents/agent-stream-bridge.js';
import { registerBuiltinTools } from '../agents/tool-definitions.js';
import { setAgentEngine, setStreamBridge, setBroadcast } from './server-methods/chat.js';
import type { WsHandler } from './ws-handler.js';

export interface BootstrapOptions {
    defaultModel?: string;
    defaultProvider?: string;
    sandboxBaseDir?: string;
    wsHandler?: WsHandler;
}

/**
 * Bootstrap the AgentEngine + wire it to the gateway.
 */
export function bootstrapEngine(opts: BootstrapOptions = {}): AgentEngine {
    const engine = new AgentEngine({
        defaultModel: opts.defaultModel ?? process.env.COREBLOW_DEFAULT_MODEL ?? 'claude-sonnet-4-20250514',
        defaultProvider: opts.defaultProvider ?? process.env.COREBLOW_DEFAULT_PROVIDER ?? 'anthropic',
        sandboxBaseDir: opts.sandboxBaseDir ?? process.env.COREBLOW_SANDBOX_DIR ?? '/tmp/coreblow-sandbox',
    });

    // Register built-in tools
    registerBuiltinTools(engine);

    // Wire to gateway
    const bridge = new AgentStreamBridge();
    setAgentEngine(engine);
    setStreamBridge(bridge);

    // Wire broadcast to WsHandler if available
    if (opts.wsHandler) {
        setBroadcast((event: string, data: unknown) => {
            opts.wsHandler!.broadcast(event, data);
        });
    }

    return engine;
}
