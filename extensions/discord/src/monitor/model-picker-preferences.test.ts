import { describe, expect, it } from "vitest";
import {
  buildDiscordModelPickerPreferenceKey,
} from "./model-picker-preferences.js";

describe("buildDiscordModelPickerPreferenceKey", () => {
  it("returns null for missing userId", () => {
    expect(buildDiscordModelPickerPreferenceKey({ userId: "" })).toBeNull();
    expect(buildDiscordModelPickerPreferenceKey({ userId: "   " })).toBeNull();
    expect(buildDiscordModelPickerPreferenceKey({ userId: undefined as any })).toBeNull();
  });

  it("builds DM key without guildId", () => {
    const key = buildDiscordModelPickerPreferenceKey({ userId: "U123" });
    expect(key).toBe("discord:default:dm:user:U123");
  });

  it("builds guild-scoped key when guildId is provided", () => {
    const key = buildDiscordModelPickerPreferenceKey({ userId: "U123", guildId: "G456" });
    expect(key).toBe("discord:default:guild:G456:user:U123");
  });

  it("includes accountId in key", () => {
    const key = buildDiscordModelPickerPreferenceKey({
      userId: "U123",
      accountId: "work",
    });
    expect(key).toBe("discord:work:dm:user:U123");
  });

  it("includes both accountId and guildId", () => {
    const key = buildDiscordModelPickerPreferenceKey({
      userId: "U123",
      accountId: "work",
      guildId: "G999",
    });
    expect(key).toBe("discord:work:guild:G999:user:U123");
  });

  it("ignores empty guildId", () => {
    const key = buildDiscordModelPickerPreferenceKey({ userId: "U123", guildId: "" });
    expect(key).toBe("discord:default:dm:user:U123");
  });
});
