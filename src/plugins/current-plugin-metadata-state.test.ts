import { afterEach, describe, expect, it } from "vitest";
import {
  clearCurrentPluginMetadataSnapshotState,
  getCurrentPluginMetadataSnapshotState,
  setCurrentPluginMetadataSnapshotState,
} from "./current-plugin-metadata-state.js";

describe("current plugin metadata snapshot state", () => {
  afterEach(() => {
    clearCurrentPluginMetadataSnapshotState();
  });

  it("starts cleared with all fields undefined", () => {
    expect(getCurrentPluginMetadataSnapshotState()).toEqual({
      snapshot: undefined,
      configFingerprint: undefined,
      compatiblePolicyHashes: undefined,
      compatibleConfigFingerprints: undefined,
    });
  });

  it("stores the snapshot and associated metadata", () => {
    const snapshot = { pluginId: "demo" };
    setCurrentPluginMetadataSnapshotState(snapshot, "fp-1", ["hash-a"], ["fp-1", "fp-2"]);

    expect(getCurrentPluginMetadataSnapshotState()).toEqual({
      snapshot,
      configFingerprint: "fp-1",
      compatiblePolicyHashes: ["hash-a"],
      compatibleConfigFingerprints: ["fp-1", "fp-2"],
    });
  });

  it("discards fingerprint/hash fields when snapshot is falsy", () => {
    setCurrentPluginMetadataSnapshotState(undefined, "fp-1", ["hash-a"], ["fp-1"]);

    expect(getCurrentPluginMetadataSnapshotState()).toEqual({
      snapshot: undefined,
      configFingerprint: undefined,
      compatiblePolicyHashes: undefined,
      compatibleConfigFingerprints: undefined,
    });
  });

  it("clears all state back to the initial shape", () => {
    setCurrentPluginMetadataSnapshotState({ pluginId: "demo" }, "fp-1", ["hash-a"], ["fp-1"]);
    clearCurrentPluginMetadataSnapshotState();

    expect(getCurrentPluginMetadataSnapshotState()).toEqual({
      snapshot: undefined,
      configFingerprint: undefined,
      compatiblePolicyHashes: undefined,
      compatibleConfigFingerprints: undefined,
    });
  });
});
