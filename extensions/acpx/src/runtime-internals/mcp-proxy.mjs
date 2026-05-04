#!/usr/bin/env node

// ─────────────────────────────────────────────────────────────────────────────
// CoreBlow ACPX — MCP Server Injection Proxy
//
// Sits between an MCP client and a target agent subprocess, transparently
// augmenting session-init JSONRPC calls with pre-configured MCP server entries.
// ─────────────────────────────────────────────────────────────────────────────

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

// ── Section: CLI argument extraction ─────────────────────────────────────────

/** JSONRPC methods that carry session bootstrap params eligible for injection. */
const SESSION_INIT_METHODS = new Set(["session/new", "session/load", "session/fork"]);

/**
 * Tokenize a command string into an argv-style array.
 * Handles single/double quoting and backslash escapes.
 */
function tokenizeShellArgs(input) {
  const tokens = [];
  let buf = "";
  let activeQuote = null;
  let escaped = false;

  for (const c of input) {
    if (escaped) {
      buf += c;
      escaped = false;
      continue;
    }
    if (c === "\\") {
      escaped = true;
      continue;
    }
    if (c === activeQuote) {
      activeQuote = null;
      continue;
    }
    if (activeQuote === null && (c === '"' || c === "'")) {
      activeQuote = c;
      continue;
    }
    if (activeQuote === null && c === " ") {
      if (buf) {
        tokens.push(buf);
        buf = "";
      }
      continue;
    }
    buf += c;
  }
  if (buf) tokens.push(buf);
  return tokens;
}

/**
 * Extract and decode the `--payload <base64url>` argument from argv.
 * Returns the parsed command string and optional MCP server list.
 */
function extractEncodedConfig(cliArgs) {
  const flagPos = cliArgs.indexOf("--payload");
  if (flagPos === -1 || flagPos + 1 >= cliArgs.length) {
    throw new Error("CoreBlow MCP proxy: --payload argument is required");
  }
  const decoded = Buffer.from(cliArgs[flagPos + 1], "base64url").toString("utf8");
  const config = JSON.parse(decoded);
  return {
    command: String(config.targetCommand ?? ""),
    servers: Array.isArray(config.mcpServers) ? config.mcpServers : [],
  };
}

// ── Section: JSONRPC message augmentation ────────────────────────────────────

/**
 * Inspect a single JSONRPC line and, if it represents a session-init call,
 * graft the configured MCP servers into `params.mcpServers`.
 * Non-matching or unparsable lines are returned verbatim.
 */
function augmentIfSessionInit(rawLine, serverList) {
  if (serverList.length === 0) return rawLine;

  try {
    const envelope = JSON.parse(rawLine);
    if (
      envelope &&
      typeof envelope === "object" &&
      typeof envelope.method === "string" &&
      SESSION_INIT_METHODS.has(envelope.method)
    ) {
      const existingParams =
        envelope.params && typeof envelope.params === "object" ? envelope.params : {};
      return JSON.stringify({
        ...envelope,
        params: { ...existingParams, mcpServers: serverList },
      });
    }
  } catch {
    // Malformed JSON — forward unchanged
  }
  return rawLine;
}

// ── Section: Process orchestration ───────────────────────────────────────────

const { command, servers } = extractEncodedConfig(process.argv.slice(2));
const [bin, ...argv] = tokenizeShellArgs(command);

const subprocess = spawn(bin, argv, {
  stdio: ["pipe", "pipe", "inherit"],
  cwd: process.cwd(),
});

// Forward child stdout directly to our stdout
subprocess.stdout.pipe(process.stdout);

// Intercept stdin lines, augment session-init calls, relay to child
const stdinReader = createInterface({ input: process.stdin });
stdinReader.on("line", (line) => {
  subprocess.stdin.write(`${augmentIfSessionInit(line, servers)}\n`);
});
stdinReader.on("close", () => {
  subprocess.stdin.end();
});

// Propagate child exit status
subprocess.on("error", (err) => {
  process.stderr.write(`CoreBlow MCP proxy: subprocess error — ${err.message}\n`);
  process.exit(1);
});

subprocess.once("close", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exitCode = code ?? 1;
  }
});
