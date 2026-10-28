import { describe, expect, it } from "vitest";
import { resolveOpenAIStrictToolSetting } from "./openai-strict-tool-setting.js";

describe("resolveOpenAIStrictToolSetting", () => {
  it("resolves true for native OpenAI route", () => {
    const model = { provider: "openai", id: "gpt-5.5" };
    expect(resolveOpenAIStrictToolSetting(model)).toBe(true);
  });

  it("resolves true for native openai-codex route", () => {
    const model = { provider: "openai-codex", id: "gpt-5.1-codex-max" };
    expect(resolveOpenAIStrictToolSetting(model)).toBe(true);
  });

  it("resolves true for azure-openai native route", () => {
    const model = {
      provider: "azure-openai",
      id: "gpt-5.5",
      baseUrl: "https://my-resource.openai.azure.com",
    };
    expect(resolveOpenAIStrictToolSetting(model)).toBe(true);
  });

  it("returns false when supportsStrictMode is true on non-native provider", () => {
    const model = { provider: "deepseek", id: "deepseek-chat" };
    expect(resolveOpenAIStrictToolSetting(model, { supportsStrictMode: true })).toBe(false);
  });

  it("returns undefined when supportsStrictMode is omitted on non-native provider", () => {
    const model = { provider: "deepseek", id: "deepseek-chat" };
    expect(resolveOpenAIStrictToolSetting(model)).toBeUndefined();
  });

  it("returns undefined for custom proxy endpoint when supportsStrictMode is false", () => {
    const model = {
      provider: "openai",
      id: "gpt-5.5",
      baseUrl: "https://proxy.example.com/v1",
    };
    expect(resolveOpenAIStrictToolSetting(model, { supportsStrictMode: false })).toBeUndefined();
  });

  it("returns false for custom proxy endpoint when supportsStrictMode is true", () => {
    const model = {
      provider: "openai",
      id: "gpt-5.5",
      baseUrl: "https://proxy.example.com/v1",
    };
    expect(resolveOpenAIStrictToolSetting(model, { supportsStrictMode: true })).toBe(false);
  });
});
