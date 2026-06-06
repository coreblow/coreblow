import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CoreBlowConfig } from "../config/config.js";
import type { HookNpmIntegrityDriftParams } from "./install.js";

const installHooksFromNpmSpecMock = vi.fn();

vi.mock("./install.js", () => ({
  installHooksFromNpmSpec: (...args: unknown[]) => installHooksFromNpmSpecMock(...args),
  resolveHookInstallDir: (hookId: string) => `/tmp/hooks/${hookId}`,
}));

const { updateNpmInstalledHookPacks } = await import("./update.js");

function createHookInstallConfig(params: {
  hookId: string;
  spec: string;
  integrity?: string;
}): CoreBlowConfig {
  return {
    hooks: {
      internal: {
        installs: {
          [params.hookId]: {
            source: "npm",
            spec: params.spec,
            installPath: `/tmp/hooks/${params.hookId}`,
            ...(params.integrity ? { integrity: params.integrity } : {}),
          },
        },
      },
    },
  };
}

describe("updateNpmInstalledHookPacks", () => {
  beforeEach(() => {
    installHooksFromNpmSpecMock.mockReset();
  });

  it("aborts exact pinned hook pack updates on integrity drift when requested", async () => {
    const warn = vi.fn();
    installHooksFromNpmSpecMock.mockImplementation(
      async (params: {
        spec: string;
        onIntegrityDrift?: (drift: HookNpmIntegrityDriftParams) => boolean | Promise<boolean>;
      }) => {
        const proceed = await params.onIntegrityDrift?.({
          spec: params.spec,
          expectedIntegrity: "sha512-old",
          actualIntegrity: "sha512-new",
          resolution: {
            integrity: "sha512-new",
            resolvedSpec: "@coreblow/demo-hooks@1.0.0",
            version: "1.0.0",
          },
        });
        if (proceed === false) {
          return {
            ok: false,
            error: "aborted: npm package integrity drift detected for @coreblow/demo-hooks@1.0.0",
          };
        }
        return {
          ok: true,
          hookPackId: "demo-hooks",
          hooks: ["demo"],
          targetDir: "/tmp/hooks/demo-hooks",
          version: "1.0.0",
        };
      },
    );

    const config = createHookInstallConfig({
      hookId: "demo-hooks",
      spec: "@coreblow/demo-hooks@1.0.0",
      integrity: "sha512-old",
    });
    const result = await updateNpmInstalledHookPacks({
      config,
      hookIds: ["demo-hooks"],
      logger: { warn },
      onIntegrityDrift: () => false,
    });

    expect(warn).not.toHaveBeenCalled();
    expect(result.changed).toBe(false);
    expect(result.config).toBe(config);
    expect(result.outcomes).toEqual([
      {
        hookId: "demo-hooks",
        status: "error",
        message:
          'Failed to update hook pack "demo-hooks": aborted: npm package integrity drift detected for @coreblow/demo-hooks@1.0.0',
      },
    ]);
  });
});
