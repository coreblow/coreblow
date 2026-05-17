import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { describe, expect, it } from "vitest";
import { defaultSlotIdForKey } from "../plugins/slots.js";
import {
  getContextEngineFactory,
  listContextEngineIds,
  registerContextEngine,
  registerContextEngineForOwner,
  resolveContextEngine,
  type ContextEngineFactory,
} from "./registry.js";
import type { AssembleResult, ContextEngine, IngestResult } from "./types.js";

function uniqueEngineId(name: string): string {
  return `test-${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

class MockContextEngine implements ContextEngine {
  readonly info = {
    id: "mock",
    name: "Mock Engine",
    version: "0.0.1",
  };

  async ingest(_params: { sessionId: string; message: AgentMessage }): Promise<IngestResult> {
    return { ingested: true };
  }

  async assemble(params: {
    sessionId: string;
    messages: AgentMessage[];
  }): Promise<AssembleResult> {
    return {
      messages: params.messages,
      estimatedTokens: 42,
      systemPromptAddition: "mock system addition",
    };
  }
}

function mockFactory(): ContextEngineFactory {
  return () => new MockContextEngine();
}

describe("context-engine", () => {
  it("registers and resolves a CoreBlow-owned mock engine", async () => {
    const engineId = uniqueEngineId("registered");

    expect(registerContextEngineForOwner(engineId, mockFactory(), "core")).toEqual({ ok: true });

    const resolved = await resolveContextEngine({
      plugins: { slots: { contextEngine: engineId } },
    });
    expect(resolved.info.name).toBe("Mock Engine");
  });

  it("stores retrievable factories and lists registered engine ids", () => {
    const engineId = uniqueEngineId("factory");
    const factory = mockFactory();

    expect(registerContextEngine(engineId, factory)).toEqual({ ok: true });

    expect(getContextEngineFactory(engineId)).toBe(factory);
    expect(listContextEngineIds()).toContain(engineId);
  });

  it("allows same-owner refresh only when explicitly requested", () => {
    const engineId = uniqueEngineId("refresh");
    const firstFactory = mockFactory();
    const secondFactory = mockFactory();

    expect(registerContextEngineForOwner(engineId, firstFactory, "core")).toEqual({ ok: true });
    expect(registerContextEngineForOwner(engineId, secondFactory, "core")).toEqual({
      ok: false,
      existingOwner: "core",
    });
    expect(
      registerContextEngineForOwner(engineId, secondFactory, "core", {
        allowSameOwnerRefresh: true,
      }),
    ).toEqual({ ok: true });
    expect(getContextEngineFactory(engineId)).toBe(secondFactory);
  });

  it("rejects cross-owner refresh and public spoofing of the default legacy id", () => {
    const engineId = uniqueEngineId("owner");
    expect(registerContextEngineForOwner(engineId, mockFactory(), "core")).toEqual({ ok: true });

    expect(registerContextEngineForOwner(engineId, mockFactory(), "other-plugin")).toEqual({
      ok: false,
      existingOwner: "core",
    });
    expect(registerContextEngine(defaultSlotIdForKey("contextEngine"), mockFactory())).toEqual({
      ok: false,
      existingOwner: "core",
    });
  });

  it("throws a useful error when a configured engine is missing", async () => {
    const engineId = uniqueEngineId("missing");

    await expect(
      resolveContextEngine({ plugins: { slots: { contextEngine: engineId } } }),
    ).rejects.toThrow(`Context engine "${engineId}" is not registered.`);
  });

  it.todo("legacy compact preserves runtimeContext currentTokenCount when top-level value is absent");
  it.todo("delegateCompactionToRuntime reuses the legacy runtime bridge");
  it.todo("shares registered engines across duplicate module copies");
  it.todo("memoizes legacy mode after the first strict compatibility retry");
  it.todo("retries strict ingest once and ingests each message only once");
  it.todo("retries strict maintain once and memoizes legacy mode there too");
  it.todo("does not retry non-compat runtime errors");
  it.todo("does not treat unrelated sessionKey runtime errors as strict schema rejection");
});
