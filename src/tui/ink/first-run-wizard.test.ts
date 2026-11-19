import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { isProviderConfigured, saveProviderSetup } from "../../cli/setup-state.js";
import type { CoreBlowConfig } from "../../config/types.js";

describe("FirstRunWizard setup-state", () => {
  let tempDir: string;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-test-setup-"));
    process.env.COREBLOW_STATE_DIR = tempDir;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OLLAMA_HOST;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it("detects unconfigured state when no env, config, or pool keys exist", () => {
    const emptyConfig: CoreBlowConfig = {
      models: { providers: {} },
      agents: { defaults: { model: { primary: "coreblow/native" } } },
    } as any;

    expect(isProviderConfigured({}, emptyConfig)).toBe(false);
  });

  it("detects configured state when ANTHROPIC_API_KEY is present in env", () => {
    const env = { ANTHROPIC_API_KEY: "sk-ant-test-123" };
    expect(isProviderConfigured(env as any, {} as any)).toBe(true);
  });

  it("detects configured state when OPENAI_API_KEY is present in env", () => {
    const env = { OPENAI_API_KEY: "sk-proj-test-123" };
    expect(isProviderConfigured(env as any, {} as any)).toBe(true);
  });

  it("detects configured state when provider has apiKey in config", () => {
    const config: CoreBlowConfig = {
      models: {
        providers: {
          openai: { apiKey: "sk-test" },
        },
      },
    } as any;

    expect(isProviderConfigured({}, config)).toBe(true);
  });

  it("persists provider setup securely to .env with mode 0600", async () => {
    await saveProviderSetup({
      provider: "anthropic",
      apiKey: "sk-ant-persisted-secret",
      model: "anthropic/claude-3-7-sonnet",
      theme: "dark",
      mode: "pro",
    });

    const envFilePath = path.join(tempDir, ".env");
    expect(fs.existsSync(envFilePath)).toBe(true);

    const stats = fs.statSync(envFilePath);
    // 0o600 mode permissions check (rw-------)
    expect(stats.mode & 0o777).toBe(0o600);

    const content = fs.readFileSync(envFilePath, "utf8");
    expect(content).toContain("ANTHROPIC_API_KEY=sk-ant-persisted-secret");
    expect(content).toContain("COREBLOW_THEME=dark");
  });
});
