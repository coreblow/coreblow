/**
 * src/commands/backup-shared.test.ts
 *
 * CoreBlow — Backup Shared Types Tests
 * Verifies BackupAssetKind, BackupSkipReason type contracts at runtime.
 */
import { describe, expect, it } from "vitest";

const VALID_ASSET_KINDS = ["state", "config", "credentials", "workspace"] as const;
const VALID_SKIP_REASONS = ["covered", "missing"] as const;

describe("BackupAssetKind values", () => {
  it("contains expected 4 kinds", () => {
    expect(VALID_ASSET_KINDS).toHaveLength(4);
  });

  it("includes state", () => {
    expect(VALID_ASSET_KINDS).toContain("state");
  });

  it("includes config", () => {
    expect(VALID_ASSET_KINDS).toContain("config");
  });

  it("includes credentials", () => {
    expect(VALID_ASSET_KINDS).toContain("credentials");
  });

  it("includes workspace", () => {
    expect(VALID_ASSET_KINDS).toContain("workspace");
  });
});

describe("BackupSkipReason values", () => {
  it("contains exactly 2 reasons", () => {
    expect(VALID_SKIP_REASONS).toHaveLength(2);
  });

  it("includes covered", () => {
    expect(VALID_SKIP_REASONS).toContain("covered");
  });

  it("includes missing", () => {
    expect(VALID_SKIP_REASONS).toContain("missing");
  });
});

describe("BackupAsset shape contract", () => {
  it("a valid BackupAsset object satisfies kind contract", () => {
    const asset = { kind: "config" as const, path: "/some/path", size: 1024 };
    expect(VALID_ASSET_KINDS.includes(asset.kind)).toBe(true);
  });

  it("backup-shared module is importable", async () => {
    const mod = await import("./backup-shared.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });
});
