/**
 * bundled/boot-md/handler.ts — Boot markdown hook.
 *
 * Fires on `agent:bootstrap` to inject workspace markdown files
 * (e.g., AGENTS.md, README.md) into the agent's bootstrap context.
 * Ensures the agent always has workspace-specific instructions loaded.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { HookContext } from "../../engine.js";

export const metadata = {
  events: ["agent:bootstrap"],
  priority: 10,
  emoji: "📄",
  always: true,
};

const BOOT_FILES = ["AGENTS.md", "COREBLOW.md", "README.md"];

export async function handler(ctx: HookContext): Promise<void> {
  const workspaceDir = ctx.payload.workspaceDir as string | undefined;
  if (!workspaceDir) return;

  const bootstrapFiles = ctx.payload.bootstrapFiles as Array<{ path: string; content: string }> | undefined;
  if (!bootstrapFiles) {
    ctx.payload.bootstrapFiles = [];
  }

  const files = ctx.payload.bootstrapFiles as Array<{ path: string; content: string }>;

  for (const fileName of BOOT_FILES) {
    const filePath = path.join(workspaceDir, fileName);
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        if (content.trim()) {
          // Avoid duplicates
          if (!files.some(f => f.path === filePath)) {
            files.push({ path: filePath, content });
          }
        }
      }
    } catch {
      // Skip unreadable files
    }
  }
}

export default handler;
