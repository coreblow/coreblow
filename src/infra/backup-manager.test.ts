import { describe, expect, it, beforeEach } from "vitest";
import { BackupManager } from "./backup-manager.js";

describe("BackupManager", () => {
  let manager: BackupManager;

  beforeEach(() => {
    manager = new BackupManager();
  });

  it("creates and retrieves a backup", () => {
    const backup = manager.create("test-backup", "config", { key: "value" });
    expect(backup.id).toMatch(/^bk-/);
    expect(backup.name).toBe("test-backup");
    expect(backup.type).toBe("config");
    expect(backup.data).toEqual({ key: "value" });
    expect(backup.size).toBeGreaterThan(0);

    const retrieved = manager.get(backup.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.name).toBe("test-backup");
  });

  it("restores from a valid backup", () => {
    const backup = manager.create("restore-test", "full", { a: 1, b: 2 });
    const result = manager.restore(backup.id);

    expect(result.success).toBe(true);
    expect(result.backupId).toBe(backup.id);
    expect(result.restoredKeys).toEqual(["a", "b"]);
  });

  it("returns failure when restoring from a non-existent backup", () => {
    const result = manager.restore("bk-nonexistent");
    expect(result.success).toBe(false);
    expect(result.restoredKeys).toEqual([]);
  });

  it("deletes a backup", () => {
    const backup = manager.create("delete-me", "config", {});
    expect(manager.delete(backup.id)).toBe(true);
    expect(manager.get(backup.id)).toBeNull();
    expect(manager.delete(backup.id)).toBe(false);
  });

  it("lists backups filtered by type", () => {
    manager.create("cfg-1", "config", {});
    manager.create("conv-1", "conversations", {});
    manager.create("cfg-2", "config", {});

    const configs = manager.list("config");
    expect(configs).toHaveLength(2);
    expect(configs.every((b) => b.type === "config")).toBe(true);

    const all = manager.list();
    expect(all).toHaveLength(3);
  });

  it("tracks count and total size", () => {
    manager.create("a", "config", { x: "hello" });
    manager.create("b", "config", { y: "world" });
    expect(manager.count()).toBe(2);
    expect(manager.getTotalSize()).toBeGreaterThan(0);
  });
});
