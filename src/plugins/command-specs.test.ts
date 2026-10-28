import { describe, expect, it } from "vitest";
import { getPluginCommandSpecs, listProviderPluginCommandSpecs } from "./command-specs.js";
import { registerPluginCommand, clearPluginCommands } from "./command-registration.js";

describe("command-specs", () => {
  it("lists provider-filtered and global plugin command specs", () => {
    clearPluginCommands();
    registerPluginCommand("test-plugin", {
      name: "global-cmd",
      description: "Global command",
      handler: async () => ({ text: "ok" }),
    });
    registerPluginCommand("test-plugin-discord", {
      name: "discord-only",
      description: "Discord command",
      channels: ["discord"],
      handler: async () => ({ text: "ok" }),
    });

    const discordSpecs = listProviderPluginCommandSpecs("discord");
    expect(discordSpecs.some((s) => s.name === "global-cmd")).toBe(true);
    expect(discordSpecs.some((s) => s.name === "discord-only")).toBe(true);

    const telegramSpecs = listProviderPluginCommandSpecs("telegram");
    expect(telegramSpecs.some((s) => s.name === "global-cmd")).toBe(true);
    expect(telegramSpecs.some((s) => s.name === "discord-only")).toBe(false);

    clearPluginCommands();
  });

  it("handles native names and description localizations", () => {
    clearPluginCommands();
    registerPluginCommand("test-plugin-localized", {
      name: "localized-cmd",
      description: "English desc",
      descriptionLocalizations: { es: "Spanish desc" },
      nativeNames: {
        discord: "disc-cmd",
      },
      handler: async () => ({ text: "ok" }),
    });

    const discordSpecs = listProviderPluginCommandSpecs("discord");
    const foundDiscord = discordSpecs.find((s) => s.name === "disc-cmd");
    expect(foundDiscord).toBeDefined();
    expect(foundDiscord?.descriptionLocalizations?.es).toBe("Spanish desc");

    const defaultSpecs = listProviderPluginCommandSpecs();
    const foundDefault = defaultSpecs.find((s) => s.name === "localized-cmd");
    expect(foundDefault).toBeDefined();

    clearPluginCommands();
  });
});
