import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import { logDebug, logError } from "../logger.js";
import type {
  AgentToolResultMiddleware,
  AgentToolResultMiddlewareOptions,
  AgentToolResultMiddlewareRuntime,
} from "./agent-tool-result-middleware-types.js";
import { getActivePluginRegistry } from "./runtime.js";

export const AGENT_TOOL_RESULT_MIDDLEWARE_RUNTIMES = [
  "pi",
  "codex",
] as const satisfies AgentToolResultMiddlewareRuntime[];

const AGENT_TOOL_RESULT_MIDDLEWARE_RUNTIME_SET = new Set<string>(
  AGENT_TOOL_RESULT_MIDDLEWARE_RUNTIMES,
);

function normalizeAgentToolResultMiddlewareRuntime(
  runtime: string,
): AgentToolResultMiddlewareRuntime | undefined {
  const normalized = runtime.trim().toLowerCase();
  if (normalized === "codex-app-server") {
    return "codex";
  }
  return AGENT_TOOL_RESULT_MIDDLEWARE_RUNTIME_SET.has(normalized)
    ? (normalized as AgentToolResultMiddlewareRuntime)
    : undefined;
}

export function normalizeAgentToolResultMiddlewareRuntimes(
  options?: AgentToolResultMiddlewareOptions,
): AgentToolResultMiddlewareRuntime[] {
  const requested = options?.runtimes ?? options?.harnesses;
  if (!requested) {
    return [...AGENT_TOOL_RESULT_MIDDLEWARE_RUNTIMES];
  }
  const normalized: AgentToolResultMiddlewareRuntime[] = [];
  for (const runtime of requested) {
    const value = normalizeAgentToolResultMiddlewareRuntime(runtime);
    if (!value) {
      continue;
    }
    if (!normalized.includes(value)) {
      normalized.push(value);
    }
  }
  return normalized;
}

/** @deprecated Use normalizeAgentToolResultMiddlewareRuntimes. */
export const normalizeAgentToolResultMiddlewareHarnesses =
  normalizeAgentToolResultMiddlewareRuntimes;

export function normalizeAgentToolResultMiddlewareRuntimeIds(
  runtimes: readonly string[] | undefined,
): AgentToolResultMiddlewareRuntime[] {
  const normalized: AgentToolResultMiddlewareRuntime[] = [];
  for (const runtime of runtimes ?? []) {
    const value = normalizeAgentToolResultMiddlewareRuntime(runtime);
    if (value && !normalized.includes(value)) {
      normalized.push(value);
    }
  }
  return normalized;
}

export function listAgentToolResultMiddlewares(
  runtime: AgentToolResultMiddlewareRuntime,
): AgentToolResultMiddleware[] {
  return (
    getActivePluginRegistry()
      ?.agentToolResultMiddlewares?.filter((entry) => entry.runtimes.includes(runtime))
      .map((entry) => entry.middleware ?? entry.handler!) ?? []
  );
}

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
  const eventBase = {
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
      const handler = registration.middleware ?? registration.handler;
      if (!handler) {
        continue;
      }
      const next = await handler(
        {
          ...eventBase,
          toolCallId: "",
          result: current,
        },
        {
          runtime: params.runtime,
        },
      );
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
