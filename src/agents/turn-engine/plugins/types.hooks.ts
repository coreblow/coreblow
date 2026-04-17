import type { PluginId } from "./types.base.js";

export type HookName =
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

export type HookHandler<TEvent = unknown, TResult = void> = (event: TEvent, ctx: Record<string, unknown>) => TResult | Promise<TResult>;

export type HookRegistration = {
    hookName: HookName;
    pluginId: PluginId;
    handler: HookHandler;
    priority?: number;
};

export type BlowPluginHookOptions = {
    name?: string;
    description?: string;
    priority?: number;
};
