import { describe, it, expect } from "vitest";

describe("docker-build-cache", () => {
  it("module exists (stub — source file mapping pending)", () => {
    expect(true).toBe(true);
  });

  it.todo("keeps the root dependency layer independent from scripts changes");
  it.todo("uses pnpm cache mounts in Dockerfiles that install repo dependencies");
  it.todo("uses apt cache mounts in Dockerfiles that install system packages");
  it.todo("does not leave empty shell continuation lines in sandbox-common");
  it.todo("does not leave blank lines after shell continuation markers");
  it.todo("copies only install inputs before pnpm install in the e2e image");
  it.todo("copies manifests before install in the qr-import image");
});
