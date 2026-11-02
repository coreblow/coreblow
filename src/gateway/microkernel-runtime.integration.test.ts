import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createMicrokernelServiceRegistry,
  NativeBrowserRuntimeService,
  NativeProviderRuntimeService,
  NativeRagRuntimeService,
  NativeToolRuntimeService,
  NativeVoiceRuntimeService,
} from "./microkernel-services.js";
import { ProviderRegistry } from "../providers/provider-registry.js";
import { RAGPipeline } from "../rag/rag-pipeline.js";
import { ToolRegistry } from "../tools/tool-registry.js";
import { TtsEngine } from "../tts/engine.js";
import { bootstrapRuntime } from "./provider-bootstrap.js";

describe("Gateway Microkernel Runtime Integration", () => {
  it("adapts real runtime dependencies and reflects live health", async () => {
    const tempDir = path.join(os.tmpdir(), `coreblow-mk-runtime-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      const providerRegistry = new ProviderRegistry();
      providerRegistry.register(
        { id: "openai", name: "OpenAI", chat: async () => ({} as any) },
        ["gpt-4o"],
        100,
      );

      const toolRegistry = new ToolRegistry();
      toolRegistry.register({
        name: "test_calc",
        description: "Test calculator",
        parameters: { type: "object", properties: {} },
        handler: async () => "42",
      });

      const activeSessions = ["sess-alpha-123", "sess-beta-456"];

      const microkernel = createMicrokernelServiceRegistry({
        stateDir: tempDir,
        coryDir: path.join(tempDir, "memory"),
        providerRegistry,
        activeProvider: "openai",
        activeModel: "gpt-4o",
        isProviderConfigured: true,
        toolRegistry,
        getActiveSessionKeys: () => activeSessions,
      });

      // 1. Verify that instances match the passed production runtimes
      expect(microkernel.provider.registry).toBe(providerRegistry);
      expect(microkernel.tool.registry).toBe(toolRegistry);
      expect(microkernel.browser.getTrackedSessionCount()).toBe(2);

      // 2. Before startup, health must report down
      expect(microkernel.provider.health().status).toBe("down");
      expect(microkernel.rag.health().status).toBe("down");
      expect(microkernel.tool.health().status).toBe("down");
      expect(microkernel.browser.health().status).toBe("down");
      expect(microkernel.voice.health().status).toBe("down");

      // 3. Topological startup
      const startResult = await microkernel.registry.startAll();
      expect(startResult.failed).toHaveLength(0);

      // Verify dependency order:
      // provider before rag, tool, cory
      const pIdx = startResult.started.indexOf("provider-runtime");
      const rIdx = startResult.started.indexOf("rag-runtime");
      const tIdx = startResult.started.indexOf("tool-runtime");
      const bIdx = startResult.started.indexOf("browser-runtime");
      const cIdx = startResult.started.indexOf("cory-memory");
      const tpIdx = startResult.started.indexOf("extension-tier-policy");
      const chIdx = startResult.started.indexOf("corehub-app-store");

      expect(pIdx).toBeLessThan(rIdx);
      expect(pIdx).toBeLessThan(tIdx);
      expect(pIdx).toBeLessThan(cIdx);
      expect(tIdx).toBeLessThan(bIdx);
      expect(tpIdx).toBeLessThan(chIdx);

      // 4. Healthy status after startup
      expect(microkernel.provider.health().status).toBe("healthy");
      expect(microkernel.provider.health().detail).toContain("1 of 1 providers active");
      expect(microkernel.rag.health().status).toBe("healthy");
      expect(microkernel.tool.health().status).toBe("healthy");
      expect(microkernel.tool.health().detail).toContain("1 tools registered");
      expect(microkernel.browser.health().status).toBe("healthy");
      expect(microkernel.voice.health().status).toBe("healthy");

      // 5. Degraded state reporting when capabilities become unavailable
      microkernel.rag.isOperational = false;
      expect(microkernel.rag.health().status).toBe("degraded");
      expect(microkernel.rag.health().detail).toContain("degraded");

      microkernel.tool.isOperational = false;
      expect(microkernel.tool.health().status).toBe("degraded");

      microkernel.browser.isOperational = false;
      expect(microkernel.browser.health().status).toBe("degraded");

      microkernel.voice.isOperational = false;
      expect(microkernel.voice.health().status).toBe("degraded");

      // 6. Direct session tracking and reverse-order shutdown cleans up active sessions
      microkernel.browser.trackSession("sess-gamma-789");
      expect(microkernel.browser.getTrackedSessionCount()).toBe(3);

      const stopResult = await microkernel.registry.stopAll();
      expect(stopResult.failed).toHaveLength(0);

      // Reverse dependency order check: browser-runtime before tool-runtime
      const browserIdx = stopResult.stopped.indexOf("browser-runtime");
      const toolIdx = stopResult.stopped.indexOf("tool-runtime");
      const providerIdx = stopResult.stopped.indexOf("provider-runtime");
      expect(browserIdx).toBeLessThan(toolIdx);
      expect(toolIdx).toBeLessThan(providerIdx);

      // Verify directly tracked session key was cleared on stop
      expect(microkernel.browser.getTrackedSessionCount()).toBe(2);

      // All report down after shutdown
      expect(microkernel.provider.health().status).toBe("down");
      expect(microkernel.rag.health().status).toBe("down");
      expect(microkernel.tool.health().status).toBe("down");
      expect(microkernel.browser.health().status).toBe("down");
      expect(microkernel.voice.health().status).toBe("down");
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("truthfully reports degraded provider health when unconfigured", async () => {
    const microkernel = createMicrokernelServiceRegistry({
      activeProvider: "anthropic",
      activeModel: "claude-3-opus",
      isProviderConfigured: false,
    });

    await microkernel.registry.start("provider-runtime");
    const health = microkernel.provider.health();
    expect(health.status).toBe("degraded");
    expect(health.detail).toContain('has no API key configured');
  });

  it("preserves Cory memory independence from CoreHub", () => {
    const microkernel = createMicrokernelServiceRegistry();
    const coryDeps = microkernel.registry.resolve("cory-memory");
    expect(coryDeps).toBeDefined();

    // Verify Cory depends ONLY on native kernel provider capability, never CoreHub
    const entry = (microkernel.registry as any).services.get("cory-memory");
    expect(entry.dependencies).toEqual(["provider-runtime"]);
    expect(entry.dependencies).not.toContain("corehub-app-store");
  });

  it("proves complete production runtime injection: exact object identity, real state transitions, and actual cleanup behavior with zero duplicate runtimes", async () => {
    const tempDir = path.join(os.tmpdir(), `coreblow-mk-prod-test-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      // 1. Authoritative production instances from bootstrapRuntime
      const {
        runtime,
        provider,
        model,
        configured,
        providerRegistry,
        ragPipeline,
        toolRegistry,
        toolExecutor,
        ttsEngine,
        browserTool,
      } = bootstrapRuntime();

      const activeSessionKeys = () => runtime.listSessions().map((s) => s.id);

      const microkernel = createMicrokernelServiceRegistry({
        stateDir: tempDir,
        coryDir: path.join(tempDir, "memory"),
        providerRegistry,
        activeProvider: provider,
        activeModel: model,
        isProviderConfigured: configured,
        ragPipeline,
        toolRegistry,
        toolExecutor,
        ttsEngine,
        browserTool,
        getActiveSessionKeys: activeSessionKeys,
      });

      // 2. Prove strict object identity: no duplicate isolated instances created
      expect(microkernel.provider.registry).toBe(providerRegistry);
      expect(microkernel.rag.pipeline).toBe(ragPipeline);
      expect(microkernel.tool.registry).toBe(toolRegistry);
      expect(microkernel.tool.executor).toBe(toolExecutor);
      expect(microkernel.voice.engine).toBe(ttsEngine);
      expect(microkernel.browser.tool).toBe(browserTool);

      // 3. Populate state in the production instances before startup
      await ragPipeline.ingestText("CoreBlow is a lightweight AI operating system.", "doc1");
      expect(ragPipeline.stats().totalChunks).toBeGreaterThan(0);

      const initialVoices = ttsEngine.listVoices();
      expect(initialVoices.length).toBeGreaterThan(0);
      await ttsEngine.synthesize({ text: "Hello world" });
      expect(ttsEngine.getStats().cacheSize).toBeGreaterThan(0);

      // Navigate page using real production BrowserTool
      await browserTool.navigate("https://coreblow.local/test");
      expect(browserTool.listPages().length).toBe(1);
      expect(microkernel.browser.tool.listPages().length).toBe(1);

      // 4. Start all microkernel services
      const startResult = await microkernel.registry.startAll();
      expect(startResult.failed).toHaveLength(0);

      // 5. Verify real state transitions affect reported health
      expect(microkernel.provider.health().status).toBe(configured ? "healthy" : "degraded");
      expect(microkernel.rag.health().status).toBe("healthy");
      expect(microkernel.tool.health().status).toBe("healthy");
      expect(microkernel.tool.health().detail).toContain(`${toolRegistry.listNames().length} tools registered`);
      expect(microkernel.voice.health().status).toBe("healthy");
      expect(microkernel.voice.health().detail).toContain(`${initialVoices.length} TTS voices active`);
      expect(microkernel.browser.health().status).toBe("healthy");
      expect(microkernel.browser.health().detail).toContain("1 open pages");

      // Inject state change into real instance and observe health change
      microkernel.voice.isOperational = false;
      expect(microkernel.voice.health().status).toBe("degraded");
      microkernel.voice.isOperational = true;
      expect(microkernel.voice.health().status).toBe("healthy");

      microkernel.browser.isOperational = false;
      expect(microkernel.browser.health().status).toBe("degraded");
      microkernel.browser.isOperational = true;
      expect(microkernel.browser.health().status).toBe("healthy");

      // 6. Stop all microkernel services and prove actual cleanup was executed
      const stopResult = await microkernel.registry.stopAll();
      expect(stopResult.failed).toHaveLength(0);

      // Verify actual service cleanup:
      // - RAG pipeline store was cleared and settled
      expect(ragPipeline.stats().totalChunks).toBe(0);
      // - Voice TTS cache was cleared
      expect(ttsEngine.getStats().cacheSize).toBe(0);
      // - BrowserTool open pages were closed during shutdown
      expect(browserTool.listPages().length).toBe(0);
      expect(microkernel.browser.tool.listPages().length).toBe(0);
      // - All services report down
      expect(microkernel.provider.health().status).toBe("down");
      expect(microkernel.rag.health().status).toBe("down");
      expect(microkernel.tool.health().status).toBe("down");
      expect(microkernel.browser.health().status).toBe("down");
      expect(microkernel.voice.health().status).toBe("down");
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
