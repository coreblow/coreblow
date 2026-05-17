import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readRepoFile(file: string): string {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("dockerfile", () => {
  it("uses shared multi-arch base image refs for root Node stages", () => {
    const dockerfile = readRepoFile("Dockerfile");

    expect(dockerfile).toContain('ARG COREBLOW_NODE_BOOKWORM_IMAGE="node:22-bookworm"');
    expect(dockerfile).toContain('ARG COREBLOW_NODE_BOOKWORM_SLIM_IMAGE="node:22-bookworm-slim"');
    expect(dockerfile).toContain("FROM ${COREBLOW_NODE_BOOKWORM_IMAGE} AS deps");
    expect(dockerfile).toContain("FROM ${COREBLOW_NODE_BOOKWORM_SLIM_IMAGE} AS base-slim");
  });

  it("prunes runtime dependencies after the build stage", () => {
    const dockerfile = readRepoFile("Dockerfile");

    expect(dockerfile.indexOf("FROM build AS runtime-assets")).toBeGreaterThan(
      dockerfile.indexOf("FROM deps AS build"),
    );
    expect(dockerfile).toContain("pnpm prune --prod");
  });

  it("pins bundled plugin discovery to copied source extensions in runtime images", () => {
    const dockerfile = readRepoFile("Dockerfile");

    expect(dockerfile).toContain("COPY --from=runtime-assets --chown=node:node /app/extensions ./extensions");
    expect(dockerfile).toContain("ENV COREBLOW_BUNDLED_PLUGINS_DIR=/app/extensions");
  });

  it("keeps runtime pnpm available", () => {
    const dockerfile = readRepoFile("Dockerfile");

    expect(dockerfile).toContain("ENV COREPACK_HOME=/usr/local/share/corepack");
    expect(dockerfile).toContain("corepack enable");
  });

  it.todo("installs optional browser dependencies after pnpm install");
  it.todo("normalizes plugin and agent paths permissions in image layers");
  it.todo("Docker GPG fingerprint awk uses correct quoting for COREBLOW_SANDBOX=1 build");
});
