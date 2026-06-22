import { afterEach, describe, expect, it } from "vitest";
import { listNextcloudTalkAccountIds, resolveNextcloudTalkAccount } from "./accounts.js";

afterEach(() => delete process.env.NEXTCLOUD_TALK_BOT_SECRET);

describe("nextcloud-talk accounts", () => {
  it("resolves named accounts and normalizes their base URL", () => {
    const cfg = { channels: { "nextcloud-talk": { accounts: { work: { baseUrl: "https://cloud.example/", botSecret: "secret" } } } } };
    expect(listNextcloudTalkAccountIds(cfg)).toEqual(["work"]);
    expect(resolveNextcloudTalkAccount({ cfg, accountId: "work" })).toMatchObject({
      accountId: "work",
      baseUrl: "https://cloud.example",
      secretSource: "config",
    });
  });
});
