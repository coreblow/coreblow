/**
 * bundled/session-memory/handler.ts — Session memory hook.
 *
 * Fires on `session:start` and `session:end` to persist lightweight
 * session context (e.g., last topic, user preferences) across restarts.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { HookContext } from "../../engine.js";

export const metadata = {
  events: ["session:start", "session:end"],
  priority: 50,
  emoji: "🧠",
};

const MEMORY_FILE = ".coreblow-session-memory.json";

interface SessionMemory {
  lastTopic?: string;
  preferences?: Record<string, unknown>;
  history?: Array<{ ts: number; summary: string }>;
}

function loadMemory(dir: string): SessionMemory {
  const memPath = path.join(dir, MEMORY_FILE);
  try {
    if (fs.existsSync(memPath)) {
      return JSON.parse(fs.readFileSync(memPath, "utf-8"));
    }
  } catch {
    // Corrupted — start fresh
  }
  return {};
}

function saveMemory(dir: string, memory: SessionMemory): void {
  const memPath = path.join(dir, MEMORY_FILE);
  try {
    fs.writeFileSync(memPath, JSON.stringify(memory, null, 2), "utf-8");
  } catch {
    // Non-critical — swallow
  }
}

export async function handler(ctx: HookContext): Promise<void> {
  const workspaceDir = ctx.payload.workspaceDir as string | undefined;
  if (!workspaceDir) return;

  if (ctx.event === "session:start") {
    // Load memory into shared context for downstream hooks
    const memory = loadMemory(workspaceDir);
    ctx.shared.sessionMemory = memory;
  }

  if (ctx.event === "session:end") {
    // Persist any updated memory
    const memory = (ctx.shared.sessionMemory ?? {}) as SessionMemory;
    const summary = ctx.payload.summary as string | undefined;
    if (summary) {
      if (!memory.history) memory.history = [];
      memory.history.push({ ts: Date.now(), summary });
      // Cap at 50 entries
      if (memory.history.length > 50) {
        memory.history = memory.history.slice(-50);
      }
    }
    saveMemory(workspaceDir, memory);
  }
}

export default handler;
