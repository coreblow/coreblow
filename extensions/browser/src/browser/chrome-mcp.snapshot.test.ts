/**
 * extensions/browser/src/browser/chrome-mcp.snapshot.test.ts
 *
 * CoreBlow — Browser Extension: Chrome-mcp Snapshot Tests
 * Verifies Chrome MCP page snapshot capture.
 */
import { describe, expect, it } from "vitest";
import {
  buildAiSnapshotFromChromeMcpSnapshot,
  flattenChromeMcpSnapshotToAriaNodes,
} from "./chrome-mcp.snapshot.js";

const snapshot = {
  id: "root",
  role: "document",
  name: "Example",
  children: [
    {
      id: "btn-1",
      role: "button",
      name: "Continue",
    },
    {
      id: "txt-1",
      role: "textbox",
      name: "Email",
      value: "peter@example.com",
    },
  ],
};

describe("chrome MCP snapshot conversion", () => {
  it("flattens structured snapshots into aria-style nodes", () => {
    const nodes = flattenChromeMcpSnapshotToAriaNodes(snapshot, 10);
    expect(nodes).toEqual([
      {
        ref: "root",
        role: "document",
        name: "Example",
        value: undefined,
        description: undefined,
        depth: 0,
      },
      {
        ref: "btn-1",
        role: "button",
        name: "Continue",
        value: undefined,
        description: undefined,
        depth: 1,
      },
      {
        ref: "txt-1",
        role: "textbox",
        name: "Email",
        value: "peter@example.com",
        description: undefined,
        depth: 1,
      },
    ]);
  });

  it("builds AI snapshots that preserve Chrome MCP uids as refs", () => {
    const result = buildAiSnapshotFromChromeMcpSnapshot({ root: snapshot });
    expect(result.snapshot).toContain('- button "Continue" [ref=btn-1]');
  });

  it("respects max depth limit", () => {
    const nested = {
      id: "root",
      role: "document",
      name: "Root",
      children: [
        {
          id: "level1",
          role: "region",
          name: "L1",
          children: [
            {
              id: "level2",
              role: "button",
              name: "Deep Button",
            },
          ],
        },
      ],
    };
    const nodesDepth1 = flattenChromeMcpSnapshotToAriaNodes(nested, 1);
    expect(nodesDepth1.map((n) => n.ref)).not.toContain("level2");
  });

  it("handles node with no children", () => {
    const solo = { id: "solo", role: "button", name: "Only" };
    const nodes = flattenChromeMcpSnapshotToAriaNodes(solo, 10);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].ref).toBe("solo");
  });

  it("normalizes missing role to 'generic'", () => {
    const noRole = { id: "x", name: "No Role" };
    const nodes = flattenChromeMcpSnapshotToAriaNodes(noRole, 10);
    expect(nodes[0].role).toBe("generic");
  });

  it("handles boolean and number values", () => {
    const withBool = { id: "chk", role: "checkbox", name: "Accept", value: true };
    const nodes = flattenChromeMcpSnapshotToAriaNodes(withBool, 10);
    expect(nodes[0].value).toBe("true");
  });
});
