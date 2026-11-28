import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "typebox";
import {
  CODE_EXECUTION_MAX_STDERR_BYTES,
  CODE_EXECUTION_MAX_STDOUT_BYTES,
  CODE_EXECUTION_MAX_TOOL_CALLS,
  CODE_EXECUTION_TIMEOUT_MS,
  createScopedCodeExecutionRpcHandler,
  truncateHeadTailBytes,
  writeSandboxSpillFile,
} from "./rpc-bridge.js";
import {
  assertExecuteCodeSandboxEligible,
  type SandboxEligibilityInput,
} from "./sandbox-gate.js";

const ExecuteCodeParamsSchema = Type.Object({
  code: Type.String({
    description: "Script source to execute inside the isolated sandbox against the scoped RPC tool bridge.",
  }),
  timeoutMs: Type.Optional(
    Type.Number({ description: "Execution timeout in ms (capped at 300000ms)." }),
  ),
});

export type CodeExecutionRunnerFn = (params: {
  code: string;
  timeoutMs: number;
  rpc: ReturnType<typeof createScopedCodeExecutionRpcHandler>;
  signal?: AbortSignal;
}) => Promise<{ stdout: string; stderr: string; exitCode: number }>;

export function createExecuteCodeTool(params: {
  getSessionTools: () => ReadonlyArray<AgentTool>;
  sandbox: SandboxEligibilityInput;
  sandboxSpillDir?: string;
  allowlist?: ReadonlyArray<string>;
  maxToolCalls?: number;
  runner?: CodeExecutionRunnerFn;
}): AgentTool<typeof ExecuteCodeParamsSchema> {
  return {
    name: "execute_code",
    label: "Execute Code (Sandboxed PTC)",
    description:
      "Execute a multi-step script inside an isolated sandbox over a scoped RPC tool bridge.",
    parameters: ExecuteCodeParamsSchema,
    execute: async (_toolCallId, args, signal) => {
      assertExecuteCodeSandboxEligible(params.sandbox);
      const code = typeof args.code === "string" ? args.code : "";
      if (!code.trim()) {
        throw new Error("execute_code requires non-empty code.");
      }
      const requestedTimeout =
        typeof args.timeoutMs === "number" && args.timeoutMs > 0
          ? args.timeoutMs
          : CODE_EXECUTION_TIMEOUT_MS;
      const timeoutMs = Math.min(CODE_EXECUTION_TIMEOUT_MS, Math.floor(requestedTimeout));
      const rpc = createScopedCodeExecutionRpcHandler({
        tools: params.getSessionTools(),
        allowlist: params.allowlist,
        maxToolCalls: params.maxToolCalls ?? CODE_EXECUTION_MAX_TOOL_CALLS,
      });

      if (!params.runner) {
        throw new Error("No sandboxed code execution runner configured for this backend.");
      }

      const timerPromise = new Promise<never>((_resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`execute_code timed out after ${timeoutMs}ms.`)),
          timeoutMs,
        );
        timer.unref?.();
      });

      const rawResult = await Promise.race([
        params.runner({ code, timeoutMs, rpc, signal }),
        timerPromise,
      ]);

      const stdout = truncateHeadTailBytes(rawResult.stdout ?? "", CODE_EXECUTION_MAX_STDOUT_BYTES);
      const stderr = truncateHeadTailBytes(rawResult.stderr ?? "", CODE_EXECUTION_MAX_STDERR_BYTES);
      if (stdout.truncated && params.sandboxSpillDir) {
        stdout.spillPath = writeSandboxSpillFile({
          text: rawResult.stdout ?? "",
          sandboxSpillDir: params.sandboxSpillDir,
        });
      }

      const payload = {
        exitCode: rawResult.exitCode,
        toolCalls: rpc.getCallCount(),
        stdout: stdout.text,
        stdoutTruncated: stdout.truncated,
        ...(stdout.spillPath ? { stdoutSpillPath: stdout.spillPath } : {}),
        stderr: stderr.text,
        stderrTruncated: stderr.truncated,
      };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
        details: payload,
      };
    },
  };
}
