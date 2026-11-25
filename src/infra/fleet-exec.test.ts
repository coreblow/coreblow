import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  findBinaryOnPath,
  resolveFleetTool,
  FLEET_TOOL_CONFIGS,
} from "../../scripts/fleet-exec.mjs";

describe("fleet-exec resolution", () => {
  it("defines all required fleet tools with valid configurations", () => {
    const requiredTools = [
      "corebar:build",
      "corebar:dev",
      "chat:go",
      "trust:eval",
      "rtt:probe",
      "bench:run",
      "corebox:run",
      "dolphin:run",
    ];

    for (const tool of requiredTools) {
      expect(FLEET_TOOL_CONFIGS[tool]).toBeDefined();
      expect(FLEET_TOOL_CONFIGS[tool].name).toBe(tool);
      expect(FLEET_TOOL_CONFIGS[tool].siblingDir).toBeTruthy();
      expect(FLEET_TOOL_CONFIGS[tool].installHint).toContain("http");
    }
  });

  it("returns unknown for unregistered tools", () => {
    const res = resolveFleetTool("nonexistent-tool", { pathEnv: "" });
    expect(res.status).toBe("unknown");
    expect(res.error).toContain("Unknown fleet tool");
  });

  it("prioritizes binary on PATH when present", () => {
    // We can simulate PATH containing a known executable (e.g. node)
    const nodeDir = path.dirname(process.execPath);
    const nodeName = path.basename(process.execPath).replace(/\.exe$/i, "");

    const found = findBinaryOnPath(nodeName, nodeDir);
    expect(found).toBeTruthy();
  });

  it("gracefully reports missing status when neither PATH nor sibling exists", () => {
    const res = resolveFleetTool("bench:run", {
      pathEnv: "",
      splitRoot: "/tmp/nonexistent-coreblow-split-root-test",
    });

    expect(res.status).toBe("missing");
    expect(res.onPath).toBeNull();
    expect(res.siblingPath).toBeNull();
    expect(res.installHint).toContain("corebench");
  });

  it("detects sibling directory when present", () => {
    // Current repo has ../coreblow-split
    const res = resolveFleetTool("trust:eval");
    // Either onPath or sibling should be detected in this dev workspace
    expect(["path", "sibling"]).toContain(res.status);
    if (res.status === "sibling") {
      expect(res.siblingPath).toContain("trust");
    }
  });

  it("enforces macOS guard on corebar:build if executed on non-darwin", () => {
    const config = FLEET_TOOL_CONFIGS["corebar:build"];
    const dummyResolution = {
      status: "sibling" as const,
      siblingPath: "/tmp/corebar",
      expectedSiblingPath: "/tmp/corebar",
      installHint: "corebar hint",
      onPath: null,
    };

    if (process.platform === "darwin") {
      const cmd = config.resolveCommand(dummyResolution, ["--verbose"]);
      expect(cmd).not.toBeNull();
      expect(cmd?.cmd).toBe("swift");
      expect(cmd?.args).toContain("build");
      expect(cmd?.args).toContain("--verbose");
    } else {
      expect(() => config.resolveCommand(dummyResolution, [])).toThrow(
        /requires macOS \(darwin\)/i,
      );
    }

    const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
    Object.defineProperty(process, "platform", { value: "linux", configurable: true });
    try {
      expect(() => config.resolveCommand(dummyResolution, [])).toThrow(
        /requires macOS \(darwin\)/i,
      );
    } finally {
      if (originalPlatform) {
        Object.defineProperty(process, "platform", originalPlatform);
      }
    }
  });

  it("forwards user arguments faithfully in command resolution", () => {
    const config = FLEET_TOOL_CONFIGS["trust:eval"];
    const resolution = {
      status: "path" as const,
      onPath: "/bin/coreblow-trust",
      siblingPath: null,
      expectedSiblingPath: "/tmp/trust",
      installHint: "trust hint",
    };

    const cmd = config.resolveCommand(resolution, ["payload-test", "--json"]);
    expect(cmd).not.toBeNull();
    expect(cmd?.cmd).toBe("/bin/coreblow-trust");
    expect(cmd?.args).toEqual(["payload-test", "--json"]);
  });
});
