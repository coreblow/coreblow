import { describe, expect, it } from "vitest";
import { parsePostedPayload } from "./monitor-websocket.js";

describe("mattermost inbound posted event parsing", () => {
  it("keeps regular user posts in the posted-event lane", () => {
    const parsed = parsePostedPayload({
      event: "posted",
      data: {
        channel_id: "chan-1",
        sender_name: "alice",
        post: JSON.stringify({
          id: "post-1",
          channel_id: "chan-1",
          user_id: "user-1",
          message: "hello from mattermost",
          create_at: 1_714_000_000_000,
        }),
      },
      broadcast: {
        channel_id: "chan-1",
        user_id: "user-1",
      },
    });

    expect(parsed).not.toBeNull();
    expect(parsed?.post.type).toBeUndefined();
    expect(parsed?.post.message).toBe("hello from mattermost");
    expect(parsed?.payload.broadcast?.user_id).toBe("user-1");
  });
});
