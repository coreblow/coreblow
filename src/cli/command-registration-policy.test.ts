import { describe, expect, it } from "vitest";
import {
  shouldEagerRegisterSubcommands,
  shouldRegisterPrimaryCommandOnly,
  shouldRegisterPrimarySubcommandOnly,
  shouldSkipPluginCommandRegistration,
} from "./command-registration-policy.js";

describe("command-registration-policy", () => {
  it("matches primary command registration policy", () => {
    expect(shouldRegisterPrimaryCommandOnly(["node", "coreblow", "status"])).toBe(true);
    expect(shouldRegisterPrimaryCommandOnly(["node", "coreblow", "status", "--help"])).toBe(true);
    expect(shouldRegisterPrimaryCommandOnly(["node", "coreblow", "-V"])).toBe(false);
    expect(shouldRegisterPrimaryCommandOnly(["node", "coreblow", "acp", "-v"])).toBe(true);
  });

  it("matches plugin registration skip policy", () => {
    expect(
      shouldSkipPluginCommandRegistration({
        argv: ["node", "coreblow", "--help"],
        primary: null,
        hasBuiltinPrimary: false,
      }),
    ).toBe(true);
    expect(
      shouldSkipPluginCommandRegistration({
        argv: ["node", "coreblow", "config", "--help"],
        primary: "config",
        hasBuiltinPrimary: true,
      }),
    ).toBe(true);
    expect(
      shouldSkipPluginCommandRegistration({
        argv: ["node", "coreblow", "voicecall", "--help"],
        primary: "voicecall",
        hasBuiltinPrimary: false,
      }),
    ).toBe(true);
    expect(
      shouldSkipPluginCommandRegistration({
        argv: ["node", "coreblow", "help", "--help"],
        primary: "help",
        hasBuiltinPrimary: false,
      }),
    ).toBe(true);
    expect(
      shouldSkipPluginCommandRegistration({
        argv: ["node", "coreblow", "help", "voicecall"],
        primary: "help",
        hasBuiltinPrimary: false,
      }),
    ).toBe(false);
    expect(
      shouldSkipPluginCommandRegistration({
        argv: ["node", "coreblow", "auth", "login"],
        primary: "auth",
        hasBuiltinPrimary: false,
      }),
    ).toBe(true);
    expect(
      shouldSkipPluginCommandRegistration({
        argv: ["node", "coreblow", "tool", "image_generate"],
        primary: "tool",
        hasBuiltinPrimary: false,
      }),
    ).toBe(true);
    expect(
      shouldSkipPluginCommandRegistration({
        argv: ["node", "coreblow", "tools", "effective"],
        primary: "tools",
        hasBuiltinPrimary: false,
      }),
    ).toBe(true);
    expect(
      shouldSkipPluginCommandRegistration({
        argv: ["node", "coreblow", "googlemeet", "login"],
        primary: "googlemeet",
        hasBuiltinPrimary: false,
      }),
    ).toBe(false);
  });

  it("matches lazy subcommand registration policy", () => {
    expect(shouldEagerRegisterSubcommands({ COREBLOW_DISABLE_LAZY_SUBCOMMANDS: "1" })).toBe(true);
    expect(shouldEagerRegisterSubcommands({ COREBLOW_DISABLE_LAZY_SUBCOMMANDS: "0" })).toBe(false);
    expect(shouldRegisterPrimarySubcommandOnly(["node", "coreblow", "acp"], {})).toBe(true);
    expect(shouldRegisterPrimarySubcommandOnly(["node", "coreblow", "acp", "--help"], {})).toBe(
      true,
    );
    expect(
      shouldRegisterPrimarySubcommandOnly(["node", "coreblow", "acp"], {
        COREBLOW_DISABLE_LAZY_SUBCOMMANDS: "1",
      }),
    ).toBe(false);
  });
});
