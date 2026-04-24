/**
 * discord/adapter.test.ts
 * Tests for the Discord adapter — CoreBlow channel bridge.
 */
import { describe, expect, it } from "vitest";
import { DiscordAdapter } from "./adapter.js";
import type { DiscordAdapterConfig } from "./adapter.js";

describe("DiscordAdapter", () => {
  it("constructs with config and starts disconnected", () => {
    const config: DiscordAdapterConfig = { token: "test-token", guildId: "guild-1" };
    const adapter = new DiscordAdapter(config);
    expect(adapter.isConnected()).toBe(false);
  });

  it("returns a defensive copy of config", () => {
    const config: DiscordAdapterConfig = { token: "secret", guildId: "g1", intents: ["GUILDS"] };
    const adapter = new DiscordAdapter(config);
    const retrieved = adapter.getConfig();
    expect(retrieved).toEqual(config);
    expect(retrieved).not.toBe(config); // must be a copy
    retrieved.token = "mutated";
    expect(adapter.getConfig().token).toBe("secret"); // original unchanged
  });

  it("connects successfully when token is provided", async () => {
    const adapter = new DiscordAdapter({ token: "bot-token" });
    await adapter.connect();
    expect(adapter.isConnected()).toBe(true);
  });

  it("throws when connecting without a token", async () => {
    const adapter = new DiscordAdapter({});
    await expect(adapter.connect()).rejects.toThrow("Discord token required");
    expect(adapter.isConnected()).toBe(false);
  });

  it("disconnects cleanly", async () => {
    const adapter = new DiscordAdapter({ token: "bot-token" });
    await adapter.connect();
    expect(adapter.isConnected()).toBe(true);
    await adapter.disconnect();
    expect(adapter.isConnected()).toBe(false);
  });

  it("handles connect → disconnect → reconnect lifecycle", async () => {
    const adapter = new DiscordAdapter({ token: "t1", guildId: "g1" });
    await adapter.connect();
    expect(adapter.isConnected()).toBe(true);
    await adapter.disconnect();
    expect(adapter.isConnected()).toBe(false);
    await adapter.connect();
    expect(adapter.isConnected()).toBe(true);
  });

  it("accepts optional intents array", () => {
    const adapter = new DiscordAdapter({
      token: "t",
      intents: ["GUILDS", "GUILD_MESSAGES", "MESSAGE_CONTENT"],
    });
    const config = adapter.getConfig();
    expect(config.intents).toEqual(["GUILDS", "GUILD_MESSAGES", "MESSAGE_CONTENT"]);
    expect(config.intents).toHaveLength(3);
  });
});
