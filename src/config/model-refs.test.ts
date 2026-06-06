import { describe, expect, it } from "vitest";
import {
  collectConfiguredModelRefValues,
  collectConfiguredModelRefs,
  extractProviderFromModelRef,
} from "./model-refs.js";

describe("configured model refs", () => {
  it("collects agent, channel, hook, message, and voice model refs", () => {
    const refs = collectConfiguredModelRefs({
      agents: {
        defaults: {
          model: { primary: "openai/gpt-5", fallbacks: ["anthropic/claude"] },
          heartbeat: { model: "groq/llama" },
          compaction: { memoryFlush: { model: "google/gemini" } },
          models: { "openrouter/model": {} },
        },
        list: [{ id: "ops", imageModel: "fal/image" }],
      },
      channels: {
        modelByChannel: { telegram: { "chat-1": "openai/gpt-5-mini" } },
        discord: { voice: { model: "deepgram/nova" } },
      },
      hooks: { mappings: [{ model: "ollama/llama" }], gmail: { model: "openai/gpt-4o" } },
      messages: { tts: { summaryModel: "openai/gpt-5-nano" } },
    });

    expect(refs).toEqual(
      expect.arrayContaining([
        { path: "agents.defaults.model.primary", value: "openai/gpt-5" },
        { path: "agents.defaults.model.fallbacks.0", value: "anthropic/claude" },
        { path: "agents.defaults.heartbeat.model", value: "groq/llama" },
        { path: "agents.defaults.compaction.memoryFlush.model", value: "google/gemini" },
        { path: "agents.defaults.models.openrouter/model", value: "openrouter/model" },
        { path: "agents.list.0.imageModel", value: "fal/image" },
        { path: "channels.modelByChannel.telegram.chat-1", value: "openai/gpt-5-mini" },
        { path: "hooks.mappings.0.model", value: "ollama/llama" },
        { path: "hooks.gmail.model", value: "openai/gpt-4o" },
        { path: "messages.tts.summaryModel", value: "openai/gpt-5-nano" },
        { path: "channels.discord.voice.model", value: "deepgram/nova" },
      ]),
    );
  });

  it("can skip channel model overrides and extract providers", () => {
    const values = collectConfiguredModelRefValues(
      { channels: { modelByChannel: { telegram: { "chat-1": "openai/gpt-5" } } } },
      { includeChannelModelOverrides: false },
    );

    expect(values).toEqual([]);
    expect(extractProviderFromModelRef(" OpenAI/gpt-5 ")).toBe("openai");
    expect(extractProviderFromModelRef("gpt-5")).toBeNull();
  });
});
