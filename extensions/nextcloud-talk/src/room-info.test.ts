import { describe, expect, it } from "vitest";
import { resolveNextcloudTalkRoomKind, testing } from "./room-info.js";

describe("nextcloud-talk room info", () => {
  it("skips lookup without API credentials and exposes cache reset", async () => {
    testing.resetRoomCache();
    await expect(resolveNextcloudTalkRoomKind({ account: { accountId: "default", enabled: true, baseUrl: "https://cloud.example", secret: "secret", secretSource: "config", config: {} }, roomToken: "room" })).resolves.toBeUndefined();
  });
});
