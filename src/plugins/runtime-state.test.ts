import { describe, expect, it } from "vitest";
import type { PluginRegistry } from "./registry.js";
import {
  getActivePluginChannelRegistryFromState,
  getActivePluginRegistryWorkspaceDirFromState,
  getPluginRegistryState,
  PLUGIN_REGISTRY_STATE,
  type RegistryState,
} from "./runtime-state.js";

describe("PLUGIN_REGISTRY_STATE", () => {
  it("should be a symbol with expected description", () => {
    expect(PLUGIN_REGISTRY_STATE.toString()).toBe("Symbol(coreblow.pluginRegistryState)");
  });
});

describe("getPluginRegistryState", () => {
  it("should return undefined when no state is set", () => {
    const prevState = (globalThis as any)[PLUGIN_REGISTRY_STATE];
    delete (globalThis as any)[PLUGIN_REGISTRY_STATE];

    expect(getPluginRegistryState()).toBeUndefined();

    if (prevState !== undefined) {
      (globalThis as any)[PLUGIN_REGISTRY_STATE] = prevState;
    }
  });

  it("should return the global registry state when set", () => {
    const prevState = (globalThis as any)[PLUGIN_REGISTRY_STATE];
    const mockState: RegistryState = {
      activeRegistry: {} as PluginRegistry,
      activeVersion: 1,
      httpRoute: { registry: null, pinned: false, version: 0 },
      channel: { registry: null, pinned: false, version: 0 },
      key: "test-key",
      workspaceDir: "/test/workspace",
      runtimeSubagentMode: "default",
      importedPluginIds: new Set(),
    };

    (globalThis as any)[PLUGIN_REGISTRY_STATE] = mockState;

    expect(getPluginRegistryState()).toBe(mockState);

    if (prevState !== undefined) {
      (globalThis as any)[PLUGIN_REGISTRY_STATE] = prevState;
    } else {
      delete (globalThis as any)[PLUGIN_REGISTRY_STATE];
    }
  });
});

describe("getActivePluginChannelRegistryFromState", () => {
  it("should return null when no state exists", () => {
    const prevState = (globalThis as any)[PLUGIN_REGISTRY_STATE];
    delete (globalThis as any)[PLUGIN_REGISTRY_STATE];

    expect(getActivePluginChannelRegistryFromState()).toBeNull();

    if (prevState !== undefined) {
      (globalThis as any)[PLUGIN_REGISTRY_STATE] = prevState;
    }
  });

  it("should return channel registry when set", () => {
    const prevState = (globalThis as any)[PLUGIN_REGISTRY_STATE];
    const channelRegistry = {} as PluginRegistry;
    const mockState: RegistryState = {
      activeRegistry: null,
      activeVersion: 1,
      httpRoute: { registry: null, pinned: false, version: 0 },
      channel: { registry: channelRegistry, pinned: false, version: 1 },
      key: null,
      workspaceDir: null,
      runtimeSubagentMode: "default",
      importedPluginIds: new Set(),
    };

    (globalThis as any)[PLUGIN_REGISTRY_STATE] = mockState;

    expect(getActivePluginChannelRegistryFromState()).toBe(channelRegistry);

    if (prevState !== undefined) {
      (globalThis as any)[PLUGIN_REGISTRY_STATE] = prevState;
    } else {
      delete (globalThis as any)[PLUGIN_REGISTRY_STATE];
    }
  });

  it("should fall back to activeRegistry when channel registry is null", () => {
    const prevState = (globalThis as any)[PLUGIN_REGISTRY_STATE];
    const activeRegistry = {} as PluginRegistry;
    const mockState: RegistryState = {
      activeRegistry,
      activeVersion: 1,
      httpRoute: { registry: null, pinned: false, version: 0 },
      channel: { registry: null, pinned: false, version: 0 },
      key: null,
      workspaceDir: null,
      runtimeSubagentMode: "default",
      importedPluginIds: new Set(),
    };

    (globalThis as any)[PLUGIN_REGISTRY_STATE] = mockState;

    expect(getActivePluginChannelRegistryFromState()).toBe(activeRegistry);

    if (prevState !== undefined) {
      (globalThis as any)[PLUGIN_REGISTRY_STATE] = prevState;
    } else {
      delete (globalThis as any)[PLUGIN_REGISTRY_STATE];
    }
  });
});

describe("getActivePluginRegistryWorkspaceDirFromState", () => {
  it("should return undefined when no state exists", () => {
    const prevState = (globalThis as any)[PLUGIN_REGISTRY_STATE];
    delete (globalThis as any)[PLUGIN_REGISTRY_STATE];

    expect(getActivePluginRegistryWorkspaceDirFromState()).toBeUndefined();

    if (prevState !== undefined) {
      (globalThis as any)[PLUGIN_REGISTRY_STATE] = prevState;
    }
  });

  it("should return workspaceDir from state", () => {
    const prevState = (globalThis as any)[PLUGIN_REGISTRY_STATE];
    const mockState: RegistryState = {
      activeRegistry: null,
      activeVersion: 1,
      httpRoute: { registry: null, pinned: false, version: 0 },
      channel: { registry: null, pinned: false, version: 0 },
      key: null,
      workspaceDir: "/test/workspace",
      runtimeSubagentMode: "default",
      importedPluginIds: new Set(),
    };

    (globalThis as any)[PLUGIN_REGISTRY_STATE] = mockState;

    expect(getActivePluginRegistryWorkspaceDirFromState()).toBe("/test/workspace");

    if (prevState !== undefined) {
      (globalThis as any)[PLUGIN_REGISTRY_STATE] = prevState;
    } else {
      delete (globalThis as any)[PLUGIN_REGISTRY_STATE];
    }
  });

  it("should return undefined when workspaceDir is null", () => {
    const prevState = (globalThis as any)[PLUGIN_REGISTRY_STATE];
    const mockState: RegistryState = {
      activeRegistry: null,
      activeVersion: 1,
      httpRoute: { registry: null, pinned: false, version: 0 },
      channel: { registry: null, pinned: false, version: 0 },
      key: null,
      workspaceDir: null,
      runtimeSubagentMode: "default",
      importedPluginIds: new Set(),
    };

    (globalThis as any)[PLUGIN_REGISTRY_STATE] = mockState;

    expect(getActivePluginRegistryWorkspaceDirFromState()).toBeUndefined();

    if (prevState !== undefined) {
      (globalThis as any)[PLUGIN_REGISTRY_STATE] = prevState;
    } else {
      delete (globalThis as any)[PLUGIN_REGISTRY_STATE];
    }
  });
});
