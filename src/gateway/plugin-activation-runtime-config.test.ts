import { describe, expect, it } from "vitest";
import type { CoreBlowConfig } from "../config/types.coreblow.js";
import { mergeActivationSectionsIntoRuntimeConfig } from "./plugin-activation-runtime-config.js";

describe("mergeActivationSectionsIntoRuntimeConfig", () => {
  it("merges only channel enabled flags from activation config", () => {
    const runtimeConfig = {
      channels: {
        telegram: {
          enabled: true,
          accounts: { main: {} },
        },
      },
    } as CoreBlowConfig;
    const activationConfig = {
      channels: {
        telegram: {
          enabled: false,
          accounts: { ignored: {} },
        },
      },
    } as CoreBlowConfig;

    expect(mergeActivationSectionsIntoRuntimeConfig({ runtimeConfig, activationConfig })).toEqual({
      channels: {
        telegram: {
          enabled: false,
          accounts: { main: {} },
        },
      },
    });
  });

  it("merges plugin allow and entry enabled flags without clobbering runtime entry fields", () => {
    const runtimeConfig = {
      plugins: {
        allow: ["old"],
        entries: {
          alpha: {
            enabled: false,
            installPath: "/tmp/alpha",
          },
          beta: {
            installPath: "/tmp/beta",
          },
        },
      },
    } as CoreBlowConfig;
    const activationConfig = {
      plugins: {
        allow: ["alpha", "beta"],
        entries: {
          alpha: {
            enabled: true,
            installPath: "/tmp/ignored",
          },
          beta: {
            enabled: false,
          },
        },
      },
    } as CoreBlowConfig;

    expect(mergeActivationSectionsIntoRuntimeConfig({ runtimeConfig, activationConfig })).toEqual({
      plugins: {
        allow: ["alpha", "beta"],
        entries: {
          alpha: {
            enabled: true,
            installPath: "/tmp/alpha",
          },
          beta: {
            enabled: false,
            installPath: "/tmp/beta",
          },
        },
      },
    });
  });

  it("returns the original runtime config when activation has no relevant flags", () => {
    const runtimeConfig = {
      gateway: { enabled: true },
    } as CoreBlowConfig;
    const activationConfig = {
      channels: {
        telegram: {
          accounts: {},
        },
      },
      plugins: {
        entries: {
          alpha: {
            installPath: "/tmp/alpha",
          },
        },
      },
    } as CoreBlowConfig;

    expect(mergeActivationSectionsIntoRuntimeConfig({ runtimeConfig, activationConfig })).toBe(
      runtimeConfig,
    );
  });
});
