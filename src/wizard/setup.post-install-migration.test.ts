import { describe, expect, it, vi } from "vitest";
import { offerPostInstallMigrations } from "./setup.post-install-migration.js";

describe("offerPostInstallMigrations", () => {
  it("returns early when no plugins were installed in this onboarding step", async () => {
    const config = { plugins: { entries: { codex: { enabled: true } } } };
    const runtime = { log: vi.fn() };
    const result = await offerPostInstallMigrations({
      config,
      runtime: runtime as never,
      installedPluginIds: [],
    });

    expect(result.config).toBe(config);
    expect(runtime.log).not.toHaveBeenCalled();
  });
});
