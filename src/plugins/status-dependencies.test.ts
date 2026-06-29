import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildPluginDependencyStatus, normalizePluginDependencySpecs } from "./status-dependencies.js";
import { cleanupTrackedTempDirs, makeTrackedTempDir, mkdirSafeDir } from "./test-helpers/fs-fixtures.js";

const tempDirs: string[] = [];

function makeTempDir() {
  return makeTrackedTempDir("coreblow-plugin-deps", tempDirs);
}

function installFakePackage(rootDir: string, name: string) {
  const packageDir = path.join(rootDir, "node_modules", ...name.split("/"));
  mkdirSafeDir(packageDir);
  fs.writeFileSync(path.join(packageDir, "package.json"), JSON.stringify({ name }), "utf8");
}

afterEach(() => {
  cleanupTrackedTempDirs(tempDirs);
});

describe("normalizePluginDependencySpecs", () => {
  it("returns empty maps when given undefined input", () => {
    expect(normalizePluginDependencySpecs({})).toEqual({
      dependencies: {},
      optionalDependencies: {},
    });
  });

  it("trims names and specs and drops blank entries", () => {
    const result = normalizePluginDependencySpecs({
      dependencies: { " left-pad ": " ^1.0.0 ", "": "^1.0.0", blank: "   " },
    });
    expect(result.dependencies).toEqual({ "left-pad": "^1.0.0" });
  });

  it("ignores non-object or array input", () => {
    expect(normalizePluginDependencySpecs({ dependencies: ["a", "b"] }).dependencies).toEqual({});
    expect(normalizePluginDependencySpecs({ dependencies: "nope" }).dependencies).toEqual({});
    expect(normalizePluginDependencySpecs({ dependencies: null }).dependencies).toEqual({});
  });

  it("ignores entries with a non-string spec", () => {
    const result = normalizePluginDependencySpecs({
      dependencies: { "left-pad": 123 as unknown as string },
    });
    expect(result.dependencies).toEqual({});
  });
});

describe("buildPluginDependencyStatus", () => {
  it("reports hasDependencies=false when there are no dependencies at all", () => {
    const status = buildPluginDependencyStatus({});
    expect(status).toEqual({
      hasDependencies: false,
      installed: true,
      requiredInstalled: true,
      optionalInstalled: true,
      missing: [],
      missingOptional: [],
      dependencies: [],
      optionalDependencies: [],
    });
  });

  it("treats every dependency as not installed when no rootDir is given", () => {
    const status = buildPluginDependencyStatus({
      dependencies: { "left-pad": "^1.0.0" },
    });
    expect(status.missing).toEqual(["left-pad"]);
    expect(status.requiredInstalled).toBe(false);
    expect(status.dependencies[0]?.resolvedPath).toBeUndefined();
  });

  it("resolves a dependency installed directly under rootDir/node_modules", () => {
    const rootDir = makeTempDir();
    installFakePackage(rootDir, "left-pad");
    const status = buildPluginDependencyStatus({
      rootDir,
      dependencies: { "left-pad": "^1.0.0" },
    });
    expect(status.missing).toEqual([]);
    expect(status.requiredInstalled).toBe(true);
    expect(status.dependencies[0]?.installed).toBe(true);
    expect(status.dependencies[0]?.resolvedPath).toBe(
      path.join(rootDir, "node_modules", "left-pad"),
    );
  });

  it("resolves a scoped package name (@scope/name)", () => {
    const rootDir = makeTempDir();
    installFakePackage(rootDir, "@scope/widget");
    const status = buildPluginDependencyStatus({
      rootDir,
      dependencies: { "@scope/widget": "^2.0.0" },
    });
    expect(status.dependencies[0]?.installed).toBe(true);
  });

  it("walks up parent directories to find a hoisted node_modules", () => {
    const rootDir = makeTempDir();
    const nestedDir = path.join(rootDir, "extensions", "my-plugin");
    mkdirSafeDir(nestedDir);
    installFakePackage(rootDir, "left-pad");
    const status = buildPluginDependencyStatus({
      rootDir: nestedDir,
      dependencies: { "left-pad": "^1.0.0" },
    });
    expect(status.dependencies[0]?.installed).toBe(true);
  });

  it("lists missing optional dependencies separately without affecting requiredInstalled", () => {
    const rootDir = makeTempDir();
    installFakePackage(rootDir, "left-pad");
    const status = buildPluginDependencyStatus({
      rootDir,
      dependencies: { "left-pad": "^1.0.0" },
      optionalDependencies: { "right-pad": "^1.0.0" },
    });
    expect(status.requiredInstalled).toBe(true);
    expect(status.optionalInstalled).toBe(false);
    expect(status.missing).toEqual([]);
    expect(status.missingOptional).toEqual(["right-pad"]);
    expect(status.installed).toBe(true);
  });

  it("sorts dependency entries alphabetically", () => {
    const status = buildPluginDependencyStatus({
      dependencies: { zeta: "^1.0.0", alpha: "^1.0.0" },
    });
    expect(status.dependencies.map((entry) => entry.name)).toEqual(["alpha", "zeta"]);
  });
});
