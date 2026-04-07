/**
 * bundled/command-logger/handler.ts — Command logger hook.
 *
 * Fires on `command:*` events to log all user commands to a structured
 * audit log. Useful for debugging, analytics, and compliance.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { HookContext } from "../../engine.js";

export const metadata = {
  events: ["command:*"],
  priority: 90,
  emoji: "📝",
  fireAndForget: true,
};

interface CommandLogEntry {
  ts: number;
  event: string;
  sessionKey?: string;
  command?: string;
  args?: string;
}

const MAX_LOG_ENTRIES = 1000;
const LOG_FILE = ".coreblow-command-log.jsonl";

export async function handler(ctx: HookContext): Promise<void> {
  const workspaceDir = ctx.payload.workspaceDir as string | undefined;
  if (!workspaceDir) return;

  const entry: CommandLogEntry = {
    ts: ctx.timestamp,
    event: ctx.event,
    sessionKey: ctx.payload.sessionKey as string | undefined,
    command: ctx.payload.command as string | undefined,
    args: ctx.payload.args as string | undefined,
  };

  const logPath = path.join(workspaceDir, LOG_FILE);

  try {
    const line = JSON.stringify(entry) + "\n";
    fs.appendFileSync(logPath, line, "utf-8");

    // Rotate: cap at MAX_LOG_ENTRIES
    try {
      const content = fs.readFileSync(logPath, "utf-8");
      const lines = content.trim().split("\n");
      if (lines.length > MAX_LOG_ENTRIES) {
        const trimmed = lines.slice(-MAX_LOG_ENTRIES).join("\n") + "\n";
        fs.writeFileSync(logPath, trimmed, "utf-8");
      }
    } catch {
      // Rotation failure is non-critical
    }
  } catch {
    // Logging failure is non-critical
  }
}

export default handler;
