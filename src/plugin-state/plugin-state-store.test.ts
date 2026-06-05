import { describe, expect, it } from "vitest";
import {
  createCorePluginStateKeyedStore,
  createPluginStateKeyedStore,
  PluginStateStoreError,
} from "./plugin-state-store.js";

describe("plugin state keyed store", () => {
  it("validates plugin ids, namespaces, keys, and max entries", () => {
    expect(() =>
      createPluginStateKeyedStore("discord", { namespace: "components", maxEntries: 10 }),
    ).not.toThrow();
    expect(() =>
      createCorePluginStateKeyedStore({
        ownerId: "core:test",
        namespace: "../escape",
        maxEntries: 10,
      }),
    ).toThrow(PluginStateStoreError);
    expect(() =>
      createCorePluginStateKeyedStore({ ownerId: "core:test", namespace: "ok", maxEntries: 0 }),
    ).toThrow(PluginStateStoreError);
  });

  it("exposes keyed store methods", () => {
    const store = createCorePluginStateKeyedStore<{ value: number }>({
      ownerId: "core:test",
      namespace: "components",
      maxEntries: 10,
    });

    expect(typeof store.register).toBe("function");
    expect(typeof store.registerIfAbsent).toBe("function");
    expect(typeof store.lookup).toBe("function");
    expect(typeof store.consume).toBe("function");
    expect(typeof store.delete).toBe("function");
    expect(typeof store.entries).toBe("function");
    expect(typeof store.clear).toBe("function");
  });
});
