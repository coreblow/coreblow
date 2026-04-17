/**
 * plugin-sdk/sdk.ts
 * Public SDK for plugin authors: definePlugin(), defineCommand(), defineTool()
 */

import type { PluginExports, PluginCommand, PluginHook, PluginProvider, PluginTool, PluginContext } from '../plugins/types.js';

/** Plugin definition builder. */
export interface PluginDefinition {
    activate?: (ctx: PluginContext) => Promise<void>;
    deactivate?: () => Promise<void>;
    commands?: PluginCommand[];
    hooks?: PluginHook[];
    providers?: PluginProvider[];
    tools?: PluginTool[];
}

/** Define a plugin — main SDK entry point for plugin authors. */
export function definePlugin(definition: PluginDefinition): PluginExports {
    return {
        activate: definition.activate,
        deactivate: definition.deactivate,
        commands: definition.commands ?? [],
        hooks: definition.hooks ?? [],
        providers: definition.providers ?? [],
        tools: definition.tools ?? [],
    };
}

/** Define a command for use in a plugin. */
export function defineCommand(
    name: string,
    description: string,
    handler: (args: string[]) => Promise<string>,
): PluginCommand {
    return { name, description, handler };
}

/** Define a tool for use in a plugin. */
export function defineTool(
    name: string,
    description: string,
    parameters: Record<string, unknown>,
    execute: (params: Record<string, unknown>) => Promise<unknown>,
): PluginTool {
    return { name, description, parameters, execute };
}

/** Define a hook for use in a plugin. */
export function defineHook(
    event: string,
    handler: (...args: unknown[]) => Promise<unknown>,
    priority = 50,
): PluginHook {
    return { event, handler, priority };
}

/** Define a provider for use in a plugin. */
export function defineProvider(
    name: string,
    models: string[],
    chat: (messages: unknown[], options: unknown) => Promise<unknown>,
): PluginProvider {
    return { name, models, chat };
}
