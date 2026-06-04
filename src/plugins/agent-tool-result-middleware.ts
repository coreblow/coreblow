import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import { logDebug, logError } from "../logger.js";
import { getActivePluginRegistry } from "./runtime.js";
import type {
  AgentToolResultMiddlewareEvent,
  AgentToolResultMiddlewareRuntime,
} from "./types.js";

export type RunAgentToolResultMiddlewareParams = {
  runtime: AgentToolResultMiddlewareRuntime;
  toolName: string;
  args: unknown;
  result: AgentToolResult<unknown>;
  cwd?: string;
  isError?: boolean;
};

function normalizeArgs(args: unknown): Record<string, unknown> {
  return args && typeof args === "object" && !Array.isArray(args)
    ? (args as Record<string, unknown>)
    : {};
}

export async function runAgentToolResultMiddlewares(
  params: RunAgentToolResultMiddlewareParams,
): Promise<AgentToolResult<unknown>> {
  const registry = getActivePluginRegistry();
  const middlewares = registry?.agentToolResultMiddlewares ?? [];
  if (middlewares.length === 0) {
    return params.result;
  }

  let current = params.result;
  const eventBase: Omit<AgentToolResultMiddlewareEvent, "result"> = {
    runtime: params.runtime,
    toolName: params.toolName,
    args: normalizeArgs(params.args),
    ...(params.cwd ? { cwd: params.cwd } : {}),
    ...(params.isError !== undefined ? { isError: params.isError } : {}),
  };

  for (const registration of middlewares) {
    if (!registration.runtimes.includes(params.runtime)) {
      continue;
    }
    try {
      const next = await registration.middleware({
        ...eventBase,
        result: current,
      });
      if (next?.result) {
        current = next.result;
      }
    } catch (error) {
      logError(
        `[plugins] agent tool result middleware from ${registration.pluginId} failed: ${String(
          error,
        )}`,
      );
      logDebug(error instanceof Error && error.stack ? error.stack : String(error));
    }
  }
  return current;
}
