import { defaultRuntime } from "../../runtime.js";
import { createLazyImportLoader } from "../../shared/lazy-promise.js";
import {
  parseAgentsListRouteArgs,
  parseChannelsListRouteArgs,
  parseChannelsStatusRouteArgs,
  parseConfigGetRouteArgs,
  parseConfigUnsetRouteArgs,
  parseGatewayStatusRouteArgs,
  parseHealthRouteArgs,
  parseModelsListRouteArgs,
  parseModelsStatusRouteArgs,
  parsePluginsListRouteArgs,
  parseSessionsRouteArgs,
  parseStatusRouteArgs,
  parseTasksAuditRouteArgs,
  parseTasksListRouteArgs,
} from "./route-args.js";

type RouteArgParser<TArgs> = (argv: string[]) => TArgs | null;

type ParsedRouteArgs<TParse extends RouteArgParser<unknown>> = Exclude<ReturnType<TParse>, null>;
type ConfigCliModule = typeof import("../config-cli.js");
type ModelsModule = typeof import("../../commands/models.js");

export type RoutedCommandDefinition<TParse extends RouteArgParser<unknown>> = {
  parseArgs: TParse;
  runParsedArgs: (args: ParsedRouteArgs<TParse>) => Promise<void>;
};

export type AnyRoutedCommandDefinition = {
  parseArgs: RouteArgParser<unknown>;
  runParsedArgs: (args: never) => Promise<void>;
};

function defineRoutedCommand<TParse extends RouteArgParser<unknown>>(
  definition: RoutedCommandDefinition<TParse>,
): RoutedCommandDefinition<TParse> {
  return definition;
}

const configCliLoader = createLazyImportLoader<ConfigCliModule>(() => import("../config-cli.js"));
const modelsModuleLoader = createLazyImportLoader<ModelsModule>(() => import("../../commands/models.js"));

function loadConfigCli(): Promise<ConfigCliModule> {
  return configCliLoader.load();
}

function loadModelsListCommand(): Promise<ModelsModule> {
  return modelsModuleLoader.load();
}

function loadModelsStatusCommand(): Promise<ModelsModule> {
  return modelsModuleLoader.load();
}

export const routedCommandDefinitions = {
  health: defineRoutedCommand({
    parseArgs: parseHealthRouteArgs,
    runParsedArgs: async (args) => {
      const { healthCommand } = await import("../../commands/health.js");
      await healthCommand(args, defaultRuntime);
    },
  }),
  status: defineRoutedCommand({
    parseArgs: parseStatusRouteArgs,
    runParsedArgs: async (args) => {
      if (args.json) {
        const { statusJsonCommand } = await import("../../commands/status-json.js");
        await statusJsonCommand(
          {
            all: args.all,
            deep: args.deep,
            timeoutMs: args.timeoutMs,
            usage: args.usage,
          },
          defaultRuntime,
        );
        return;
      }
      const { statusCommand } = await import("../../commands/status.js");
      await statusCommand(args, defaultRuntime);
    },
  }),
  "gateway-status": defineRoutedCommand({
    parseArgs: parseGatewayStatusRouteArgs,
    runParsedArgs: async (args) => {
      const { runDaemonStatus } = await import("../daemon-cli/status.js");
      await runDaemonStatus(args);
    },
  }),
  sessions: defineRoutedCommand({
    parseArgs: parseSessionsRouteArgs,
    runParsedArgs: async (args) => {
      const { sessionsCommand } = await import("../../commands/sessions.js");
      await sessionsCommand(args, defaultRuntime);
    },
  }),
  "agents-list": defineRoutedCommand({
    parseArgs: parseAgentsListRouteArgs,
    runParsedArgs: async (args) => {
      const { agentsListCommand } = await import("../../commands/agents.js");
      await agentsListCommand(args, defaultRuntime);
    },
  }),
  "config-get": defineRoutedCommand({
    parseArgs: parseConfigGetRouteArgs,
    runParsedArgs: async (args) => {
      const { runConfigGet } = await loadConfigCli();
      await runConfigGet(args);
    },
  }),
  "config-unset": defineRoutedCommand({
    parseArgs: parseConfigUnsetRouteArgs,
    runParsedArgs: async (args) => {
      const { runConfigUnset } = await loadConfigCli();
      await runConfigUnset({ path: args.path });
    },
  }),
  "models-list": defineRoutedCommand({
    parseArgs: parseModelsListRouteArgs,
    runParsedArgs: async (args) => {
      const { modelsListCommand } = await loadModelsListCommand();
      await modelsListCommand(args, defaultRuntime);
    },
  }),
  "models-status": defineRoutedCommand({
    parseArgs: parseModelsStatusRouteArgs,
    runParsedArgs: async (args) => {
      const { modelsStatusCommand } = await loadModelsStatusCommand();
      await modelsStatusCommand(args, defaultRuntime);
    },
  }),
  "tasks-list": defineRoutedCommand({
    parseArgs: parseTasksListRouteArgs,
    runParsedArgs: async (args) => {
      const { tasksListJsonCommand } = await import("../../commands/tasks-json.js");
      await tasksListJsonCommand(args, defaultRuntime);
    },
  }),
  "tasks-audit": defineRoutedCommand({
    parseArgs: parseTasksAuditRouteArgs,
    runParsedArgs: async (args) => {
      const { tasksAuditJsonCommand } = await import("../../commands/tasks-json.js");
      await tasksAuditJsonCommand(args, defaultRuntime);
    },
  }),
  "channels-list": defineRoutedCommand({
    parseArgs: parseChannelsListRouteArgs,
    runParsedArgs: async (args) => {
      const { channelsListCommand } = await import("../../commands/channels.js");
      await channelsListCommand(args, defaultRuntime);
    },
  }),
  "channels-status": defineRoutedCommand({
    parseArgs: parseChannelsStatusRouteArgs,
    runParsedArgs: async (args) => {
      const { channelsStatusCommand } = await import("../../commands/channels.js");
      await channelsStatusCommand(args, defaultRuntime);
    },
  }),
  "plugins-list": defineRoutedCommand({
    parseArgs: parsePluginsListRouteArgs,
    runParsedArgs: async (args) => {
      const { runPluginsListCommand } = await import("../plugins-list-command.js");
      await runPluginsListCommand(args, defaultRuntime);
    },
  }),
} as const;
