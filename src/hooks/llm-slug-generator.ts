/**
 * LLM-based slug generator for session memory filenames
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  resolveDefaultAgentId,
  resolveAgentWorkspaceDir,
  resolveAgentDir,
} from "../agents/agent-scope.js";
import { resolveDefaultModelForAgent } from "../agents/model-selection.js";
import { runEmbeddedPiAgent } from "../agents/pi-embedded.js";
import { resolveAgentTimeoutMs } from "../agents/timeout.js";
import type { CoreBlowConfig } from "../config/config.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("llm-slug-generator");
const DEFAULT_SLUG_GENERATOR_TIMEOUT_MS = 15_000;

type CoreBlowConfigWithAgentTimeout = CoreBlowConfig & {
  agents?: {
    defaults?: {
      timeoutSeconds?: number;
    };
  };
};

function resolveSlugGeneratorTimeoutMs(cfg: CoreBlowConfig): number {
  const configuredTimeoutSeconds = (cfg as CoreBlowConfigWithAgentTimeout).agents?.defaults
    ?.timeoutSeconds;
  if (typeof configuredTimeoutSeconds !== "number" || !Number.isFinite(configuredTimeoutSeconds)) {
    return DEFAULT_SLUG_GENERATOR_TIMEOUT_MS;
  }
  return resolveAgentTimeoutMs({ cfg });
}

function inferUniqueConfiguredModelProvider(cfg: CoreBlowConfig, model: string): string | undefined {
  const normalizedModel = model.trim().toLowerCase();
  if (!normalizedModel) {
    return undefined;
  }
  const providers = new Set<string>();
  for (const [providerId, provider] of Object.entries(cfg.models?.providers ?? {})) {
    if (
      provider.models.some((entry) => entry.id === model || entry.id.toLowerCase() === normalizedModel)
    ) {
      providers.add(providerId);
      if (providers.size > 1) {
        return undefined;
      }
    }
  }
  return providers.size === 1 ? providers.values().next().value : undefined;
}

/**
 * Generate a short 1-2 word filename slug from session content using LLM
 */
export async function generateSlugViaLLM(params: {
  sessionContent: string;
  cfg: CoreBlowConfig;
}): Promise<string | null> {
  let tempSessionFile: string | null = null;

  try {
    const agentId = resolveDefaultAgentId(params.cfg);
    const workspaceDir = resolveAgentWorkspaceDir(params.cfg, agentId);
    const agentDir = resolveAgentDir(params.cfg, agentId);

    // Create a temporary session file for this one-off LLM call
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "coreblow-slug-"));
    tempSessionFile = path.join(tempDir, "session.jsonl");

    const prompt = `Based on this conversation, generate a short 1-2 word filename slug (lowercase, hyphen-separated, no file extension).

Conversation summary:
${params.sessionContent.slice(0, 2000)}

Reply with ONLY the slug, nothing else. Examples: "vendor-pitch", "api-design", "bug-fix"`;

    const resolvedModel = resolveDefaultModelForAgent({
      cfg: params.cfg,
      agentId,
    });
    const provider =
      inferUniqueConfiguredModelProvider(params.cfg, resolvedModel.model) ?? resolvedModel.provider;
    const model = resolvedModel.model;
    const timeoutMs = resolveSlugGeneratorTimeoutMs(params.cfg);

    const result = await runEmbeddedPiAgent({
      sessionId: `slug-generator-${Date.now()}`,
      sessionKey: "temp:slug-generator",
      agentId,
      sessionFile: tempSessionFile,
      workspaceDir,
      agentDir,
      config: params.cfg,
      prompt,
      provider,
      model,
      timeoutMs,
      runId: `slug-gen-${Date.now()}`,
    });

    // Extract text from payloads
    if (result.payloads && result.payloads.length > 0) {
      const text = result.payloads[0]?.text;
      if (text) {
        // Clean up the response - extract just the slug
        const slug = text
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 30); // Max 30 chars

        return slug || null;
      }
    }

    return null;
  } catch (err) {
    const message = err instanceof Error ? (err.stack ?? err.message) : String(err);
    log.error(`Failed to generate slug: ${message}`);
    return null;
  } finally {
    // Clean up temporary session file
    if (tempSessionFile) {
      try {
        await fs.rm(path.dirname(tempSessionFile), { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
