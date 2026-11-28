import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import {
  DEFAULT_EXECUTE_CODE_RPC_ALLOWLIST,
  isRpcToolAllowedForExecuteCode,
} from "./sandbox-gate.js";

export const CODE_EXECUTION_TIMEOUT_MS = 300_000;
export const CODE_EXECUTION_MAX_TOOL_CALLS = 50;
export const CODE_EXECUTION_MAX_STDOUT_BYTES = 50 * 1024;
export const CODE_EXECUTION_MAX_STDERR_BYTES = 10 * 1024;
export const CODE_EXECUTION_MAX_SPILL_BYTES = 5 * 1024 * 1024;

export type TruncatedOutputResult = {
  text: string;
  truncated: boolean;
  bytesCaptured: number;
  bytesTotal: number;
  spillPath?: string;
};

/**
 * Truncates output by UTF-8 bytes using a 40% head / 60% tail split.
 */
export function truncateHeadTailBytes(text: string, maxBytes: number): TruncatedOutputResult {
  const buf = Buffer.from(text, "utf8");
  if (buf.byteLength <= maxBytes) {
    return {
      text,
      truncated: false,
      bytesCaptured: buf.byteLength,
      bytesTotal: buf.byteLength,
    };
  }
  const headBudget = Math.floor(maxBytes * 0.4);
  const tailBudget = Math.max(0, maxBytes - headBudget);
  const head = buf.subarray(0, headBudget).toString("utf8");
  const tail = buf.subarray(buf.byteLength - tailBudget).toString("utf8");
  const omitted = buf.byteLength - headBudget - tailBudget;
  return {
    text: `${head}\n...[truncated ${omitted} of ${buf.byteLength} bytes]...\n${tail}`,
    truncated: true,
    bytesCaptured: headBudget + tailBudget,
    bytesTotal: buf.byteLength,
  };
}

/**
 * Spills oversized stdout strictly inside `sandboxSpillDir` (never to host outside sandbox),
 * capped at `CODE_EXECUTION_MAX_SPILL_BYTES` (5 MB).
 */
export function writeSandboxSpillFile(params: {
  text: string;
  sandboxSpillDir?: string;
}): string | undefined {
  const dir = params.sandboxSpillDir?.trim();
  if (!dir) {
    return undefined;
  }
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const filePath = path.join(dir, `execute-code-${crypto.randomBytes(4).toString("hex")}.log`);
  const buf = Buffer.from(params.text, "utf8");
  const capped = buf.byteLength > CODE_EXECUTION_MAX_SPILL_BYTES
    ? buf.subarray(0, CODE_EXECUTION_MAX_SPILL_BYTES)
    : buf;
  fs.writeFileSync(filePath, capped, { mode: 0o600 });
  return filePath;
}

export function createScopedCodeExecutionRpcHandler(params: {
  tools: ReadonlyArray<AgentTool>;
  allowlist?: ReadonlyArray<string>;
  maxToolCalls?: number;
}): {
  invoke: (toolName: string, args: Record<string, unknown>, signal?: AbortSignal) => Promise<unknown>;
  getCallCount: () => number;
} {
  const allowlist = params.allowlist ?? DEFAULT_EXECUTE_CODE_RPC_ALLOWLIST;
  const maxToolCalls = params.maxToolCalls ?? CODE_EXECUTION_MAX_TOOL_CALLS;
  const byName = new Map(params.tools.map((tool) => [tool.name, tool]));
  let callCount = 0;

  return {
    getCallCount: () => callCount,
    invoke: async (toolName, args, signal) => {
      if (!isRpcToolAllowedForExecuteCode(toolName, allowlist)) {
        throw new Error(`RPC tool "${toolName}" is disallowed for execute_code.`);
      }
      if (callCount >= maxToolCalls) {
        throw new Error(
          `execute_code exceeded maxToolCalls (${maxToolCalls}). Reduce programmatic tool calls.`,
        );
      }
      const tool = byName.get(toolName);
      if (!tool) {
        throw new Error(`RPC tool "${toolName}" is not available in this session.`);
      }
      callCount += 1;
      return await tool.execute(`rpc-${callCount}`, args as never, signal);
    },
  };
}
