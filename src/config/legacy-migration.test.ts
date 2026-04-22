import { describe, expect, it, beforeEach } from "vitest";
import {
  clearMigrationRules,
  detectLegacyConfig,
  getMigrationRules,
  getMigrationSummary,
  migrateConfig,
  needsMigration,
  registerMigrationRule,
} from "./legacy-migration.js";

beforeEach(() => {
  clearMigrationRules();
});

describe("clearMigrationRules / getMigrationRules", () => {
  it("getMigrationRules returns empty array after clear", () => {
    expect(getMigrationRules()).toEqual([]);
  });

  it("registerMigrationRule adds a rule", () => {
    registerMigrationRule({
      id: "test-rule",
      description: "Test rule",
      priority: 0,
      detect: () => false,
      migrate: (cfg) => cfg,
    });
    expect(getMigrationRules().length).toBe(1);
  });

  it("clear removes all registered rules", () => {
    registerMigrationRule({
      id: "rule-1",
      description: "R1",
      priority: 0,
      detect: () => false,
      migrate: (cfg) => cfg,
    });
    clearMigrationRules();
    expect(getMigrationRules()).toEqual([]);
  });
});

describe("needsMigration", () => {
  it("returns false for empty config with no rules", () => {
    expect(needsMigration({})).toBe(false);
  });

  it("returns false when no rules match", () => {
    registerMigrationRule({
      id: "no-match",
      description: "Never matches",
      priority: 0,
      detect: () => false,
      migrate: (cfg) => cfg,
    });
    expect(needsMigration({ foo: "bar" })).toBe(false);
  });

  it("returns true when a rule matches", () => {
    registerMigrationRule({
      id: "always-match",
      description: "Always matches",
      priority: 0,
      detect: () => true,
      migrate: (cfg) => cfg,
    });
    expect(needsMigration({})).toBe(true);
  });
});

describe("detectLegacyConfig", () => {
  it("returns empty array when no rules match", () => {
    expect(detectLegacyConfig({})).toEqual([]);
  });

  it("returns matching rules", () => {
    registerMigrationRule({
      id: "match-rule",
      description: "Matches",
      priority: 0,
      detect: () => true,
      migrate: (cfg) => cfg,
    });
    const detected = detectLegacyConfig({});
    expect(detected.length).toBe(1);
    expect(detected[0]?.id).toBe("match-rule");
  });
});

describe("migrateConfig", () => {
  it("returns config unchanged when no rules", () => {
    const cfg = { key: "value" };
    const result = migrateConfig(cfg);
    expect(result.config).toEqual(cfg);
  });

  it("result has config and migrations fields", () => {
    const result = migrateConfig({});
    expect("config" in result).toBe(true);
    expect("changes" in result || "migrationsApplied" in result).toBe(true);
  });
});

describe("getMigrationSummary", () => {
  it("returns array of strings", () => {
    const summary = getMigrationSummary({});
    expect(Array.isArray(summary)).toBe(true);
  });

  it("returns empty array when no rules match", () => {
    expect(getMigrationSummary({})).toEqual([]);
  });
});
