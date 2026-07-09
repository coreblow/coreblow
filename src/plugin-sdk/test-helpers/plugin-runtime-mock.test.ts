import { describe, expect, it, vi } from "vitest";
import {
  createPluginRuntimeMock,
  createPluginRuntimeMediaMock,
  createProxySurface,
  typedMock,
} from "./plugin-runtime-mock.js";

describe("plugin-runtime-mock", () => {
  it("creates a stable proxy surface that returns callables", () => {
    // We can define a generic interface to test proxy behavior safely
    type TestSurface = {
      someRandomMethod: () => void;
      deep: { nested: { method: () => void } };
    };
    const proxy = createProxySurface<TestSurface>();
    expect(typeof proxy.someRandomMethod).toBe("function");
    expect(typeof proxy.deep.nested.method).toBe("function");

    // Stable
    expect(proxy.someRandomMethod).toBe(proxy.someRandomMethod);
    expect(proxy.deep.nested).toBe(proxy.deep.nested);
  });

  it("creates a media mock", async () => {
    const mock = createPluginRuntimeMediaMock();
    expect(typeof mock.fetchRemoteMedia).toBe("function");

    // Pass a valid buffer input structurally
    const result = await mock.saveMediaBuffer(Buffer.alloc(4));
    expect(result.path).toBe("/tmp/test-media.jpg");
  });

  it("creates a complete plugin runtime mock with typedMock helpers", () => {
    const mock = createPluginRuntimeMock();
    expect(mock.version).toBe("0.0.0-test");
    expect(typeof mock.config.loadConfig).toBe("function");
    expect(mock.config.loadConfig()).toEqual({});

    // Stable deep proxy channel surfaces
    expect(typeof mock.channel.discord.messageActions).toBe("function");
  });

  it("supports deep overrides without losing proxy surfaces", () => {
    const mock = createPluginRuntimeMock({
      version: "1.0.0",
      channel: {
        discord: {
          // Provide a properly typed stub override
          auditChannelPermissions: typedMock(() => Promise.resolve({ ok: true, checkedChannels: 0, unresolvedChannels: 0, channels: [], elapsedMs: 0 })),
        },
      },
    });

    expect(mock.version).toBe("1.0.0");
    // We expect mergeDeep to mix it in
    expect(typeof mock.channel.discord.auditChannelPermissions).toBe("function");
    // Other properties should still be proxied
    expect(typeof mock.channel.discord.messageActions).toBe("function");
  });

  it("exports a typedMock helper that returns vi.fn", () => {
    const fn = typedMock(() => "test");
    expect(fn()).toBe("test");
    expect(vi.isMockFunction(fn)).toBe(true);
  });
});
