/**
 * dashboard/config-guard.test.ts
 * Tests for ConfigGuard — concurrency control via hash comparison.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { ConfigGuard } from "./config-guard.js";

describe("ConfigGuard", () => {
  let tmpDir: string;
  let configPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cb-guard-"));
    configPath = path.join(tmpDir, "config.json");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("loads config and returns hash", async () => {
    fs.writeFileSync(configPath, JSON.stringify({ key: "value" }));
    const guard = new ConfigGuard();
    const { config, hash } = await guard.load(configPath);
    expect(config).toEqual({ key: "value" });
    expect(hash).toMatch(/^[a-f0-9]{32}$/);
    expect(guard.getCurrentHash()).toBe(hash);
  });

  it("saves config when hashes match", async () => {
    fs.writeFileSync(configPath, JSON.stringify({ key: "old" }));
    const guard = new ConfigGuard();
    const { hash } = await guard.load(configPath);
    const result = await guard.save(configPath, { key: "new" }, hash);
    expect(result.ok).toBe(true);
    expect(result.hash).toBeDefined();
    const content = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    expect(content.key).toBe("new");
  });

  it("rejects save when config was modified externally", async () => {
    fs.writeFileSync(configPath, JSON.stringify({ key: "v1" }));
    const guard = new ConfigGuard();
    const { hash } = await guard.load(configPath);
    // External modification
    fs.writeFileSync(configPath, JSON.stringify({ key: "v2-external" }));
    const result = await guard.save(configPath, { key: "v3-attempt" }, hash);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("modified by another session");
  });

  it("allows first write when file does not exist", async () => {
    const guard = new ConfigGuard();
    const newPath = path.join(tmpDir, "new-config.json");
    const result = await guard.save(newPath, { fresh: true }, "any-hash");
    expect(result.ok).toBe(true);
    expect(fs.existsSync(newPath)).toBe(true);
  });

  it("creates backup before overwrite", async () => {
    fs.writeFileSync(configPath, JSON.stringify({ original: true }));
    const guard = new ConfigGuard();
    const { hash } = await guard.load(configPath);
    await guard.save(configPath, { updated: true }, hash);
    const backup = JSON.parse(fs.readFileSync(configPath + ".backup", "utf-8"));
    expect(backup.original).toBe(true);
  });

  it("getCurrentHash returns empty before load", () => {
    const guard = new ConfigGuard();
    expect(guard.getCurrentHash()).toBe("");
  });

  it("produces consistent hashes for same content", async () => {
    fs.writeFileSync(configPath, JSON.stringify({ test: 123 }));
    const g1 = new ConfigGuard();
    const g2 = new ConfigGuard();
    const r1 = await g1.load(configPath);
    const r2 = await g2.load(configPath);
    expect(r1.hash).toBe(r2.hash);
  });
});
