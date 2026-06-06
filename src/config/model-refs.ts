import { normalizeProviderId } from "../agents/provider-id.js";
import { isPlainObject } from "../infra/plain-object.js";

export type ConfiguredModelRef = {
  path: string;
  value: string;
};

export const AGENT_MODEL_CONFIG_KEYS = [
  "model",
  "imageModel",
  "imageGenerationModel",
  "videoGenerationModel",
  "musicGenerationModel",
  "pdfModel",
] as const;

function pushModelRef(refs: ConfiguredModelRef[], path: string, value: unknown): void {
  if (typeof value === "string" && value.trim()) {
    refs.push({ path, value: value.trim() });
  }
}

function collectModelConfig(refs: ConfiguredModelRef[], path: string, value: unknown): void {
  if (typeof value === "string") {
    pushModelRef(refs, path, value);
    return;
  }
  if (!isPlainObject(value)) {
    return;
  }
  pushModelRef(refs, `${path}.primary`, value.primary);
  if (Array.isArray(value.fallbacks)) {
    for (const [index, entry] of value.fallbacks.entries()) {
      pushModelRef(refs, `${path}.fallbacks.${index}`, entry);
    }
  }
}

function collectFromAgent(refs: ConfiguredModelRef[], path: string, agent: unknown): void {
  if (!isPlainObject(agent)) {
    return;
  }
  for (const key of AGENT_MODEL_CONFIG_KEYS) {
    collectModelConfig(refs, `${path}.${key}`, agent[key]);
  }
  pushModelRef(
    refs,
    `${path}.heartbeat.model`,
    isPlainObject(agent.heartbeat) ? agent.heartbeat.model : undefined,
  );
  collectModelConfig(
    refs,
    `${path}.subagents.model`,
    isPlainObject(agent.subagents) ? agent.subagents.model : undefined,
  );
  if (isPlainObject(agent.compaction)) {
    pushModelRef(refs, `${path}.compaction.model`, agent.compaction.model);
    pushModelRef(
      refs,
      `${path}.compaction.memoryFlush.model`,
      isPlainObject(agent.compaction.memoryFlush) ? agent.compaction.memoryFlush.model : undefined,
    );
  }
  if (isPlainObject(agent.models)) {
    for (const modelRef of Object.keys(agent.models)) {
      pushModelRef(refs, `${path}.models.${modelRef}`, modelRef);
    }
  }
}

export function collectConfiguredModelRefs(
  config: unknown,
  options: { includeChannelModelOverrides?: boolean } = {},
): ConfiguredModelRef[] {
  const refs: ConfiguredModelRef[] = [];
  const root = isPlainObject(config) ? config : {};
  const agents = isPlainObject(root.agents) ? root.agents : {};

  collectFromAgent(refs, "agents.defaults", agents.defaults);
  if (Array.isArray(agents.list)) {
    for (const [index, entry] of agents.list.entries()) {
      collectFromAgent(refs, `agents.list.${index}`, entry);
    }
  }

  if (options.includeChannelModelOverrides !== false) {
    const channels = isPlainObject(root.channels) ? root.channels : {};
    const modelByChannel = isPlainObject(channels.modelByChannel) ? channels.modelByChannel : {};
    for (const [channelId, channelMap] of Object.entries(modelByChannel)) {
      if (!isPlainObject(channelMap)) {
        continue;
      }
      for (const [targetId, modelRef] of Object.entries(channelMap)) {
        pushModelRef(refs, `channels.modelByChannel.${channelId}.${targetId}`, modelRef);
      }
    }
  }

  const hooks = isPlainObject(root.hooks) ? root.hooks : {};
  if (Array.isArray(hooks.mappings)) {
    for (const [index, mapping] of hooks.mappings.entries()) {
      pushModelRef(
        refs,
        `hooks.mappings.${index}.model`,
        isPlainObject(mapping) ? mapping.model : undefined,
      );
    }
  }
  pushModelRef(refs, "hooks.gmail.model", isPlainObject(hooks.gmail) ? hooks.gmail.model : undefined);

  const messages = isPlainObject(root.messages) ? root.messages : {};
  pushModelRef(
    refs,
    "messages.tts.summaryModel",
    isPlainObject(messages.tts) ? messages.tts.summaryModel : undefined,
  );

  const channels = isPlainObject(root.channels) ? root.channels : {};
  const discord = isPlainObject(channels.discord) ? channels.discord : {};
  pushModelRef(
    refs,
    "channels.discord.voice.model",
    isPlainObject(discord.voice) ? discord.voice.model : undefined,
  );
  return refs;
}

export function collectConfiguredModelRefValues(
  config: unknown,
  options?: { includeChannelModelOverrides?: boolean },
): string[] {
  return collectConfiguredModelRefs(config, options).map((ref) => ref.value);
}

export function extractProviderFromModelRef(value: string): string | null {
  const trimmed = value.trim();
  const slash = trimmed.indexOf("/");
  if (slash <= 0) {
    return null;
  }
  return normalizeProviderId(trimmed.slice(0, slash));
}
