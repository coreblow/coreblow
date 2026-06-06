import { describe, expect, it } from "vitest";
import {
  listKnownChannelEnvVarNames,
  resolveShellEnvExpectedKeys,
} from "./shell-env-expected-keys.js";

describe("shell env expected keys", () => {
  it("includes CoreBlow gateway env keys", () => {
    expect(resolveShellEnvExpectedKeys({} as NodeJS.ProcessEnv)).toEqual(
      expect.arrayContaining(["COREBLOW_GATEWAY_TOKEN", "COREBLOW_GATEWAY_PASSWORD"]),
    );
  });

  it("includes configured channel env keys from the current environment", () => {
    const env = {
      DISCORD_BOT_TOKEN: "discord-token",
      TELEGRAM_BOT_TOKEN: "telegram-token",
      EMPTY_SLACK_TOKEN: "",
    } as NodeJS.ProcessEnv;

    expect(listKnownChannelEnvVarNames(env)).toEqual([
      "DISCORD_BOT_TOKEN",
      "TELEGRAM_BOT_TOKEN",
    ]);
    expect(resolveShellEnvExpectedKeys(env)).toEqual(
      expect.arrayContaining(["DISCORD_BOT_TOKEN", "TELEGRAM_BOT_TOKEN"]),
    );
  });
});
