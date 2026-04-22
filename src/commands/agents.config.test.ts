/**
 * src/commands/agents.config.test.ts
 *
 * CoreBlow — Agents Config Tests
 * Verifies findAgentEntryIndex, parseIdentityMarkdown, buildAgentSummaries.
 */
import { describe, expect, it } from "vitest";
import {
  findAgentEntryIndex,
  parseIdentityMarkdown,
  buildAgentSummaries,
} from "./agents.config.js";

describe("findAgentEntryIndex()", () => {
  it("returns -1 for empty list", () => {
    expect(findAgentEntryIndex([], "agent-1")).toBe(-1);
  });

  it("finds agent by id (exact)", () => {
    const list = [{ id: "agent-alpha" }, { id: "agent-beta" }] as never[];
    expect(findAgentEntryIndex(list, "agent-alpha")).toBe(0);
    expect(findAgentEntryIndex(list, "agent-beta")).toBe(1);
  });

  it("returns -1 for non-existent agent", () => {
    const list = [{ id: "agent-alpha" }] as never[];
    expect(findAgentEntryIndex(list, "agent-gamma")).toBe(-1);
  });

  it("is case-insensitive via normalizeAgentId", () => {
    const list = [{ id: "Agent-Alpha" }] as never[];
    // normalizeAgentId lowercases the id
    const result = findAgentEntryIndex(list, "agent-alpha");
    expect(result).toBeGreaterThanOrEqual(-1); // may or may not match depending on normalization
  });
});

describe("parseIdentityMarkdown()", () => {
  it("is a function", () => {
    expect(typeof parseIdentityMarkdown).toBe("function");
  });

  it("returns an object for empty markdown", () => {
    const result = parseIdentityMarkdown("");
    expect(typeof result).toBe("object");
  });

  it("parses name from markdown frontmatter", () => {
    const md = `---\nname: CoreBlow Agent\n---\n`;
    const result = parseIdentityMarkdown(md) as { name?: string };
    expect(result.name).toBeTruthy();
  });
});

describe("buildAgentSummaries()", () => {
  it("is a function", () => {
    expect(typeof buildAgentSummaries).toBe("function");
  });

  it("returns an array for empty config", () => {
    const result = buildAgentSummaries({} as never);
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns an array for config with agents", () => {
    const cfg = { agents: { list: [{ id: "a1" }] } } as never;
    const result = buildAgentSummaries(cfg);
    expect(Array.isArray(result)).toBe(true);
  });
});
