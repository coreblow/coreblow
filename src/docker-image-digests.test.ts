import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

function readRepoFile(file: string): string {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("docker-image-digests", () => {
  it("keeps Docker base images on the Node 22 runtime baseline", () => {
    const files = ["Dockerfile", "Dockerfile.sandbox-common", "Dockerfile.sandbox-browser"];
    const fromLines = files.flatMap((file) =>
      readRepoFile(file)
        .split("\n")
        .filter((line) => line.startsWith("FROM "))
        .map((line) => ({ file, line })),
    );

    expect(fromLines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ file: "Dockerfile.sandbox-common", line: "FROM node:22-bookworm-slim AS base" }),
      ]),
    );
    expect(fromLines.some(({ line }) => line.includes("node:20"))).toBe(false);
  });

  it("keeps Dependabot updates enabled for Docker-adjacent CI dependencies", () => {
    const dependabot = parse(readRepoFile(".github/dependabot.yml")) as {
      updates?: Array<{ "package-ecosystem"?: string; directory?: string }>;
    };

    expect(dependabot.updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ "package-ecosystem": "github-actions", directory: "/" }),
        expect.objectContaining({ "package-ecosystem": "npm", directory: "/" }),
      ]),
    );
  });

  it.todo("pins selected Dockerfile FROM lines to immutable sha256 digests");
});
