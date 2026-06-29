import { afterEach, describe, expect, it } from "vitest";
import {
  clearCompactionProviders,
  getCompactionProvider,
  getRegisteredCompactionProvider,
  listCompactionProviderIds,
  listRegisteredCompactionProviders,
  registerCompactionProvider,
  restoreRegisteredCompactionProviders,
  type CompactionProvider,
} from "./compaction-provider.js";

function makeProvider(id: string): CompactionProvider {
  return {
    id,
    label: id,
    summarize: async () => `summary-from-${id}`,
  };
}

describe("compaction provider registry", () => {
  afterEach(() => {
    clearCompactionProviders();
  });

  it("registers and looks up a provider by id", () => {
    const provider = makeProvider("demo");
    registerCompactionProvider(provider, { ownerPluginId: "demo-plugin" });

    expect(getCompactionProvider("demo")).toBe(provider);
    expect(getRegisteredCompactionProvider("demo")).toEqual({
      provider,
      ownerPluginId: "demo-plugin",
    });
  });

  it("lists registered provider ids and entries", () => {
    registerCompactionProvider(makeProvider("a"));
    registerCompactionProvider(makeProvider("b"), { ownerPluginId: "plugin-b" });

    expect(listCompactionProviderIds().toSorted()).toEqual(["a", "b"]);
    expect(listRegisteredCompactionProviders()).toHaveLength(2);
  });

  it("clears all registered providers", () => {
    registerCompactionProvider(makeProvider("demo"));
    clearCompactionProviders();
    expect(listCompactionProviderIds()).toEqual([]);
  });

  it("restores a snapshot, replacing all current entries", () => {
    registerCompactionProvider(makeProvider("stale"));

    const snapshot = listRegisteredCompactionProviders();
    registerCompactionProvider(makeProvider("fresh"));
    restoreRegisteredCompactionProviders(snapshot);

    expect(listCompactionProviderIds()).toEqual(["stale"]);
  });

  it("returns undefined for an unregistered provider id", () => {
    expect(getCompactionProvider("missing")).toBeUndefined();
    expect(getRegisteredCompactionProvider("missing")).toBeUndefined();
  });
});
