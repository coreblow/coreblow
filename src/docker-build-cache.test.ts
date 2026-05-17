import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

function readRepoFile(file: string): string {
  return fs.readFileSync(path.join(repoRoot, file), "utf8");
}

function dockerfiles(): Array<[string, string]> {
  return ["Dockerfile", "Dockerfile.sandbox-common", "Dockerfile.sandbox-browser"].map((file) => [
    file,
    readRepoFile(file),
  ]);
}

describe("docker-build-cache", () => {
  it("keeps the root dependency layer independent from source changes", () => {
    const dockerfile = readRepoFile("Dockerfile");
    const installIndex = dockerfile.indexOf("pnpm install --frozen-lockfile");
    expect(installIndex).toBeGreaterThan(0);
    expect(dockerfile.indexOf("COPY package.json pnpm-lock.yaml pnpm-workspace.yaml")).toBeLessThan(
      installIndex,
    );
    expect(dockerfile.indexOf("COPY . .")).toBeGreaterThan(installIndex);
  });

  it("uses pnpm cache mounts in Dockerfiles that install repo dependencies", () => {
    for (const [file, content] of dockerfiles()) {
      if (!content.includes("pnpm install")) {
        continue;
      }
      expect(content, file).toMatch(/--mount=type=cache[^\n]+pnpm|pnpm install/s);
    }
    expect(readRepoFile("Dockerfile")).toContain("id=coreblow-pnpm-store");
  });

  it("uses apt cache mounts in the production Dockerfile for system packages", () => {
    const dockerfile = readRepoFile("Dockerfile");
    expect(dockerfile).toContain("id=coreblow-apt-cache");
    expect(dockerfile).toContain("id=coreblow-apt-lists");
  });

  it("does not leave blank lines after shell continuation markers", () => {
    for (const [file, content] of dockerfiles()) {
      expect(content, file).not.toMatch(/\\\n\s*\n/);
    }
  });

  it.todo("does not leave empty shell continuation lines in sandbox-common");
  it.todo("copies only install inputs before pnpm install in the e2e image");
  it.todo("copies manifests before install in the qr-import image");
});
