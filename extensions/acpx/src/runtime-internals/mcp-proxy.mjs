#!/usr/bin/env node

/**
 * MCP Proxy for CoreBlow ACPX Runtime
 *
 * Spawns a target ACP process and intercepts JSONRPC requests on stdin.
 * For session bootstrap methods (session/new, session/load, session/fork),
 * injects configured MCP server definitions into the request params.
 * All other requests and all stdout from the child are passed through unchanged.
 */

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

/**
 * Split a shell-like command string into argv tokens, respecting quotes.
 */
function splitCommandLine(value) {
  const parts = [];
  let current = "";
  let quote = null;
  let escaping = false;

  for (const ch of value) {
    if (escaping) {
      current += ch;
      escaping = false;
      continue;
    }
    if (ch === "\\") {
      escaping = true;
      continue;
    }
    if (ch === quote) {
      quote = null;
      continue;
    }
    if (!quote && (ch === '"' || ch === "'")) {
      quote = ch;
      continue;
    }
    if (!quote && ch === " ") {
      if (current.length > 0) {
        parts.push(current);
        current = "";
      }
      continue;
    }
    current += ch;
  }
  if (current.length > 0) {
    parts.push(current);
  }
  return parts;
}

/**
 * Decode the base64url-encoded --payload CLI argument.
 * Returns { targetCommand, mcpServers }.
 */
function decodePayload(argv) {
  const payloadIndex = argv.indexOf("--payload");
  if (payloadIndex < 0 || payloadIndex + 1 >= argv.length) {
    throw new Error("Missing --payload");
  }
  const raw = Buffer.from(argv[payloadIndex + 1], "base64url").toString("utf8");
  const parsed = JSON.parse(raw);
  const targetCommand = String(parsed.targetCommand ?? "");
  const mcpServers = Array.isArray(parsed.mcpServers) ? parsed.mcpServers : [];
  return {
    targetCommand,
    mcpServers,
  };
}

/**
 * Methods whose params.mcpServers should be rewritten.
 */
function shouldInject(method) {
  return method === "session/new" || method === "session/load" || method === "session/fork";
}

/**
 * Parse a JSONRPC line, inject mcpServers if applicable, and return the
 * (possibly rewritten) line string.
 */
function rewriteLine(line, mcpServers) {
  if (mcpServers.length === 0) {
    return line;
  }
  try {
    const msg = JSON.parse(line);
    if (
      msg &&
      typeof msg === "object" &&
      typeof msg.method === "string" &&
      shouldInject(msg.method)
    ) {
      const params = msg.params && typeof msg.params === "object" ? msg.params : {};
      return JSON.stringify({
        ...msg,
        params: {
          ...params,
          mcpServers,
        },
      });
    }
  } catch {
    // Not valid JSON — pass through as-is
  }
  return line;
}

// ── Main ──

const { targetCommand, mcpServers } = decodePayload(process.argv.slice(2));
const [cmd, ...args] = splitCommandLine(targetCommand);

const child = spawn(cmd, args, {
  stdio: ["pipe", "pipe", "inherit"],
  cwd: process.cwd(),
});

child.stdout.pipe(process.stdout);

const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  child.stdin.write(`${rewriteLine(line, mcpServers)}\n`);
});
rl.on("close", () => {
  child.stdin.end();
});

child.once("close", (code) => {
  process.exitCode = code ?? 1;
});
