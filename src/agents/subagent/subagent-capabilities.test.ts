/**
 * src/agents/subagent/subagent-capabilities.test.ts
 *
 * CoreBlow — Subagent Capabilities Tests
 * Verifies resolveSubagentRoleForDepth, resolveSubagentCapabilities,
 * canSpawnAtDepth, isSpawnAllowed, describeCapabilities, getMaxChildrenForRole.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_SUBAGENT_MAX_SPAWN_DEPTH,
  SUBAGENT_SESSION_ROLES,
  SUBAGENT_CONTROL_SCOPES,
  resolveSubagentCapabilities,
  canSpawnAtDepth,
  isSpawnAllowed,
  describeCapabilities,
  getMaxChildrenForRole,
} from "./subagent-capabilities.js";

describe("constants", () => {
  it("DEFAULT_SUBAGENT_MAX_SPAWN_DEPTH is a positive number", () => {
    expect(typeof DEFAULT_SUBAGENT_MAX_SPAWN_DEPTH).toBe("number");
    expect(DEFAULT_SUBAGENT_MAX_SPAWN_DEPTH).toBeGreaterThan(0);
  });

  it("SUBAGENT_SESSION_ROLES contains main/orchestrator/leaf", () => {
    expect(SUBAGENT_SESSION_ROLES).toContain("main");
    expect(SUBAGENT_SESSION_ROLES).toContain("orchestrator");
    expect(SUBAGENT_SESSION_ROLES).toContain("leaf");
  });

  it("SUBAGENT_CONTROL_SCOPES contains children and none", () => {
    expect(SUBAGENT_CONTROL_SCOPES).toContain("children");
    expect(SUBAGENT_CONTROL_SCOPES).toContain("none");
  });
});

describe("resolveSubagentCapabilities()", () => {
  it("depth=0 returns role=main", () => {
    const caps = resolveSubagentCapabilities({ depth: 0 });
    expect(caps.role).toBe("main");
  });

  it("depth within limit returns role=orchestrator", () => {
    const caps = resolveSubagentCapabilities({ depth: 1, maxSpawnDepth: 3 });
    expect(caps.role).toBe("orchestrator");
  });

  it("depth at limit returns role=leaf", () => {
    const caps = resolveSubagentCapabilities({ depth: 3, maxSpawnDepth: 3 });
    expect(caps.role).toBe("leaf");
  });

  it("main can spawn", () => {
    expect(resolveSubagentCapabilities({ depth: 0 }).canSpawn).toBe(true);
  });

  it("leaf cannot spawn", () => {
    expect(resolveSubagentCapabilities({ depth: 99 }).canSpawn).toBe(false);
  });

  it("leaf has controlScope=none", () => {
    expect(resolveSubagentCapabilities({ depth: 99 }).controlScope).toBe("none");
  });

  it("returns depth field matching input", () => {
    expect(resolveSubagentCapabilities({ depth: 2 }).depth).toBe(2);
  });
});

describe("canSpawnAtDepth()", () => {
  it("returns true at depth 0", () => {
    expect(canSpawnAtDepth(0)).toBe(true);
  });

  it("returns false beyond maxSpawnDepth", () => {
    expect(canSpawnAtDepth(5, 3)).toBe(false);
  });
});

describe("isSpawnAllowed()", () => {
  it("allowed for main with no active children", () => {
    const result = isSpawnAllowed({ depth: 0, activeChildren: 0 });
    expect(result.allowed).toBe(true);
  });

  it("disallowed when activeChildren >= maxChildren", () => {
    const result = isSpawnAllowed({ depth: 0, activeChildren: 10, maxChildren: 10 });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it("disallowed for leaf (cannot spawn)", () => {
    const result = isSpawnAllowed({ depth: 99, activeChildren: 0 });
    expect(result.allowed).toBe(false);
  });
});

describe("getMaxChildrenForRole()", () => {
  it("main can have 10 children", () => {
    expect(getMaxChildrenForRole("main")).toBe(10);
  });

  it("orchestrator can have 5 children", () => {
    expect(getMaxChildrenForRole("orchestrator")).toBe(5);
  });

  it("leaf can have 0 children", () => {
    expect(getMaxChildrenForRole("leaf")).toBe(0);
  });
});

describe("describeCapabilities()", () => {
  it("returns a non-empty string", () => {
    const caps = resolveSubagentCapabilities({ depth: 0 });
    const desc = describeCapabilities(caps);
    expect(typeof desc).toBe("string");
    expect(desc.length).toBeGreaterThan(0);
  });

  it("includes role and depth info", () => {
    const caps = resolveSubagentCapabilities({ depth: 0 });
    const desc = describeCapabilities(caps);
    expect(desc).toContain("main");
    expect(desc).toContain("0");
  });
});
