import type { StreamFn } from "@mariozechner/pi-agent-core";
import type { Api, Model } from "@mariozechner/pi-ai";
import type { CoreBlowConfig } from "../config/config.js";
import { resolveProviderStreamFn } from "../plugins/provider-runtime.js";
import { ensureCustomApiRegistered } from "./custom-api-registry.js";

export function registerProviderStreamForModel<TApi extends Api>(params: {
  model: Model<TApi>;
  cfg?: CoreBlowConfig;
  agentDir?: string;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
}): StreamFn | undefined {
  const streamFn = resolveProviderStreamFn({
    provider: params.model.provider,
    config: params.cfg,
    workspaceDir: params.workspaceDir,
    env: params.env,
    context: {
      config: params.cfg,
      agentDir: params.agentDir,
      workspaceDir: params.workspaceDir,
      provider: params.model.provider,
      modelId: params.model.id,
      model: params.model,
    },
  });
  if (!streamFn) {
    return undefined;
  }
  ensureCustomApiRegistered(params.model.api, streamFn);
  return streamFn;
}

// Stub types + class — used by agent-engine.ts OOP facade
export type StreamChunk = { type: string; content?: string; toolUse?: { id: string; name: string; input: unknown }; usage?: unknown; [key: string]: unknown };
export type StreamHandler = (chunk: StreamChunk) => void;
export class StreamAccumulator {
  private chunks: StreamChunk[] = [];
  add(chunk: StreamChunk): void { this.chunks.push(chunk); }
  getText(): string { return this.chunks.filter(c => c.type === 'text').map(c => c.content ?? '').join(''); }
}
