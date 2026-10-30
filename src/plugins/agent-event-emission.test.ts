import { describe, expect, it, vi, beforeEach } from "vitest";
import { emitPluginAgentEvent } from "./agent-event-emission.js";
import type { PluginAgentEventEmitParams } from "./host-hooks.js";
import * as agentEvents from "../infra/agent-events.js";

vi.mock("../infra/agent-events.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../infra/agent-events.js")>();
  return {
    ...actual,
    emitAgentEvent: vi.fn(),
  };
});

describe("emitPluginAgentEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emits event for bundled plugin with host-owned stream", () => {
    const event: PluginAgentEventEmitParams = {
      runId: "run-123",
      stream: "lifecycle",
      data: { status: "started" },
    };

    const result = emitPluginAgentEvent({
      pluginId: "test-plugin",
      origin: "bundled",
      event,
    });

    expect(result).toEqual({ emitted: true, stream: "lifecycle" });
    expect(agentEvents.emitAgentEvent).toHaveBeenCalledWith({
      runId: "run-123",
      stream: "lifecycle",
      data: {
        status: "started",
        pluginId: "test-plugin",
      },
    });
  });

  it("blocks non-bundled plugin from using host-owned stream", () => {
    const event: PluginAgentEventEmitParams = {
      runId: "run-123",
      stream: "tool",
      data: { value: "test" },
    };

    const result = emitPluginAgentEvent({
      pluginId: "user-plugin",
      origin: "workspace",
      event,
    });

    expect(result).toEqual({
      emitted: false,
      reason: "stream tool is reserved for bundled plugins",
    });
    expect(agentEvents.emitAgentEvent).not.toHaveBeenCalled();
  });

  it("allows non-bundled plugin to use plugin-scoped stream", () => {
    const event: PluginAgentEventEmitParams = {
      runId: "run-456",
      stream: "my-plugin.custom",
      data: { custom: "data" },
    };

    const result = emitPluginAgentEvent({
      pluginId: "my-plugin",
      pluginName: "My Plugin",
      origin: "workspace",
      event,
    });

    expect(result).toEqual({ emitted: true, stream: "my-plugin.custom" });
    expect(agentEvents.emitAgentEvent).toHaveBeenCalledWith({
      runId: "run-456",
      stream: "my-plugin.custom",
      data: {
        custom: "data",
        pluginId: "my-plugin",
        pluginName: "My Plugin",
      },
    });
  });

  it("blocks non-bundled plugin from using unscoped stream", () => {
    const event: PluginAgentEventEmitParams = {
      runId: "run-789",
      stream: "other-plugin.event",
      data: { value: "test" },
    };

    const result = emitPluginAgentEvent({
      pluginId: "my-plugin",
      origin: "workspace",
      event,
    });

    expect(result).toEqual({
      emitted: false,
      reason: "stream other-plugin.event must be scoped to plugin my-plugin",
    });
    expect(agentEvents.emitAgentEvent).not.toHaveBeenCalled();
  });

  it("returns error when runId is missing", () => {
    const event: PluginAgentEventEmitParams = {
      runId: "",
      stream: "test.event",
      data: { value: "test" },
    };

    const result = emitPluginAgentEvent({
      pluginId: "test-plugin",
      origin: "bundled",
      event,
    });

    expect(result).toEqual({
      emitted: false,
      reason: "runId and stream are required",
    });
    expect(agentEvents.emitAgentEvent).not.toHaveBeenCalled();
  });

  it("returns error when stream is missing", () => {
    const event: PluginAgentEventEmitParams = {
      runId: "run-123",
      stream: "",
      data: { value: "test" },
    };

    const result = emitPluginAgentEvent({
      pluginId: "test-plugin",
      origin: "bundled",
      event,
    });

    expect(result).toEqual({
      emitted: false,
      reason: "runId and stream are required",
    });
    expect(agentEvents.emitAgentEvent).not.toHaveBeenCalled();
  });

  it("wraps non-object data in value field", () => {
    const event: PluginAgentEventEmitParams = {
      runId: "run-123",
      stream: "test-plugin.event",
      data: "string-value",
    };

    const result = emitPluginAgentEvent({
      pluginId: "test-plugin",
      origin: "bundled",
      event,
    });

    expect(result).toEqual({ emitted: true, stream: "test-plugin.event" });
    expect(agentEvents.emitAgentEvent).toHaveBeenCalledWith({
      runId: "run-123",
      stream: "test-plugin.event",
      data: {
        value: "string-value",
        pluginId: "test-plugin",
      },
    });
  });

  it("includes sessionKey when provided", () => {
    const event: PluginAgentEventEmitParams = {
      runId: "run-123",
      stream: "lifecycle",
      sessionKey: "session-456",
      data: { status: "active" },
    };

    const result = emitPluginAgentEvent({
      pluginId: "test-plugin",
      origin: "bundled",
      event,
    });

    expect(result).toEqual({ emitted: true, stream: "lifecycle" });
    expect(agentEvents.emitAgentEvent).toHaveBeenCalledWith({
      runId: "run-123",
      stream: "lifecycle",
      sessionKey: "session-456",
      data: {
        status: "active",
        pluginId: "test-plugin",
      },
    });
  });

  it("allows plugin to use exact plugin ID as stream name", () => {
    const event: PluginAgentEventEmitParams = {
      runId: "run-123",
      stream: "my-plugin",
      data: { value: "test" },
    };

    const result = emitPluginAgentEvent({
      pluginId: "my-plugin",
      origin: "workspace",
      event,
    });

    expect(result).toEqual({ emitted: true, stream: "my-plugin" });
    expect(agentEvents.emitAgentEvent).toHaveBeenCalled();
  });
});
