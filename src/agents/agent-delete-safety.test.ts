import path from "node:path";
import { describe, expect, it } from "vitest";
import type { CoreBlowConfig } from "../config/types.coreblow.js";
import { findOverlappingWorkspaceAgentIds } from "./agent-delete-safety.js";

describe("findOverlappingWorkspaceAgentIds", () => {
  it("returns overlapping agent ids when workspaces share a directory", () => {
    const cfg: CoreBlowConfig = {
      agents: {
        list: [
          { id: "agent-a", workspace: "/tmp/workspaces/shared" },
          { id: "agent-b", workspace: "/tmp/workspaces/shared" },
          { id: "agent-c", workspace: "/tmp/workspaces/other" },
        ],
      },
    };

    const overlapping = findOverlappingWorkspaceAgentIds(
      cfg,
      "agent-a",
      "/tmp/workspaces/shared",
    );
    expect(overlapping).toEqual(["agent-b"]);
  });

  it("detects nested workspace directory overlaps", () => {
    const cfg: CoreBlowConfig = {
      agents: {
        list: [
          { id: "parent", workspace: "/tmp/workspaces/project" },
          { id: "child", workspace: "/tmp/workspaces/project/submodule" },
          { id: "sibling", workspace: "/tmp/workspaces/sibling" },
        ],
      },
    };

    const parentOverlap = findOverlappingWorkspaceAgentIds(
      cfg,
      "parent",
      "/tmp/workspaces/project",
    );
    expect(parentOverlap).toEqual(["child"]);

    const childOverlap = findOverlappingWorkspaceAgentIds(
      cfg,
      "child",
      "/tmp/workspaces/project/submodule",
    );
    expect(childOverlap).toEqual(["parent"]);
  });

  it("returns empty array when no workspaces overlap", () => {
    const cfg: CoreBlowConfig = {
      agents: {
        list: [
          { id: "alpha", workspace: "/tmp/workspaces/alpha" },
          { id: "beta", workspace: "/tmp/workspaces/beta" },
        ],
      },
    };

    const overlapping = findOverlappingWorkspaceAgentIds(
      cfg,
      "alpha",
      "/tmp/workspaces/alpha",
    );
    expect(overlapping).toEqual([]);
  });

  it("ignores the agent itself when checking for overlap", () => {
    const cfg: CoreBlowConfig = {
      agents: {
        list: [{ id: "solo", workspace: "/tmp/workspaces/solo" }],
      },
    };

    const overlapping = findOverlappingWorkspaceAgentIds(
      cfg,
      "solo",
      "/tmp/workspaces/solo",
    );
    expect(overlapping).toEqual([]);
  });
});
