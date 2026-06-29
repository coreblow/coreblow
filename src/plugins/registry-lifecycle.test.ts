import { describe, expect, it } from "vitest";
import type { PluginRegistry } from "./registry.js";
import {
  isPluginRegistryActivated,
  isPluginRegistryRetired,
  markPluginRegistryActive,
  markPluginRegistryRetired,
} from "./registry-lifecycle.js";

describe("markPluginRegistryRetired", () => {
  it("should handle null registry", () => {
    expect(() => markPluginRegistryRetired(null)).not.toThrow();
  });

  it("should handle undefined registry", () => {
    expect(() => markPluginRegistryRetired(undefined)).not.toThrow();
  });

  it("should mark registry as retired", () => {
    const registry = {} as PluginRegistry;
    markPluginRegistryRetired(registry);
    expect(isPluginRegistryRetired(registry)).toBe(true);
  });
});

describe("markPluginRegistryActive", () => {
  it("should handle null registry", () => {
    expect(() => markPluginRegistryActive(null)).not.toThrow();
  });

  it("should handle undefined registry", () => {
    expect(() => markPluginRegistryActive(undefined)).not.toThrow();
  });

  it("should mark registry as active", () => {
    const registry = {} as PluginRegistry;
    markPluginRegistryActive(registry);
    expect(isPluginRegistryActivated(registry)).toBe(true);
  });

  it("should remove retired status when marking as active", () => {
    const registry = {} as PluginRegistry;
    markPluginRegistryRetired(registry);
    expect(isPluginRegistryRetired(registry)).toBe(true);

    markPluginRegistryActive(registry);
    expect(isPluginRegistryActivated(registry)).toBe(true);
    expect(isPluginRegistryRetired(registry)).toBe(false);
  });
});

describe("isPluginRegistryActivated", () => {
  it("should return false for untracked registry", () => {
    const registry = {} as PluginRegistry;
    expect(isPluginRegistryActivated(registry)).toBe(false);
  });

  it("should return true after marking as active", () => {
    const registry = {} as PluginRegistry;
    markPluginRegistryActive(registry);
    expect(isPluginRegistryActivated(registry)).toBe(true);
  });
});

describe("isPluginRegistryRetired", () => {
  it("should return false for untracked registry", () => {
    const registry = {} as PluginRegistry;
    expect(isPluginRegistryRetired(registry)).toBe(false);
  });

  it("should return true after marking as retired", () => {
    const registry = {} as PluginRegistry;
    markPluginRegistryRetired(registry);
    expect(isPluginRegistryRetired(registry)).toBe(true);
  });
});

describe("registry lifecycle transitions", () => {
  it("should track independent registries separately", () => {
    const registry1 = {} as PluginRegistry;
    const registry2 = {} as PluginRegistry;

    markPluginRegistryActive(registry1);
    markPluginRegistryRetired(registry2);

    expect(isPluginRegistryActivated(registry1)).toBe(true);
    expect(isPluginRegistryRetired(registry1)).toBe(false);

    expect(isPluginRegistryActivated(registry2)).toBe(false);
    expect(isPluginRegistryRetired(registry2)).toBe(true);
  });
});
