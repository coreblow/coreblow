/**
 * extensions/discord/src/monitor/presence.test.ts
 *
 * CoreBlow — Discord Extension: Presence Tests
 * Verifies Bot presence status management.
 */
import { describe, expect, it } from "vitest";
import { resolveDiscordPresenceUpdate } from "./presence.js";

describe("resolveDiscordPresenceUpdate", () => {
  it("returns online presence when no config is provided", () => {
    const result = resolveDiscordPresenceUpdate({});
    expect(result).not.toBeNull();
    expect(result!.status).toBe("online");
    expect(result!.activities).toEqual([]);
  });

  it("uses configured status", () => {
    const result = resolveDiscordPresenceUpdate({ status: "dnd" });
    expect(result!.status).toBe("dnd");
  });

  it("includes activity when configured", () => {
    const result = resolveDiscordPresenceUpdate({ activity: "Helping humans" });
    expect(result!.status).toBe("online");
    expect(result!.activities).toHaveLength(1);
    expect(result!.activities[0].state).toBe("Helping humans");
  });

  it("uses custom activity type (4) by default", () => {
    const result = resolveDiscordPresenceUpdate({ activity: "test" });
    expect(result!.activities[0].type).toBe(4);
    expect(result!.activities[0].name).toBe("Custom Status");
  });

  it("respects explicit activityType", () => {
    const result = resolveDiscordPresenceUpdate({ activity: "test", activityType: 3 });
    expect(result!.activities[0].type).toBe(3);
    expect(result!.activities[0].name).toBe("test");
  });

  it("sets streaming URL for type 1", () => {
    const result = resolveDiscordPresenceUpdate({
      activity: "Live",
      activityType: 1,
      activityUrl: "https://twitch.tv/test",
    });
    expect(result!.activities[0].url).toBe("https://twitch.tv/test");
  });

  it("returns online status with empty activities by default", () => {
    const result = resolveDiscordPresenceUpdate({ status: "idle" });
    expect(result).not.toBeNull();
    expect(result!.status).toBe("idle");
  });
});
