/** Seam boundary: auto-reply → agents (30 imports) */
import { describe, expect, it } from "vitest";

import * as mod_heartbeat from "../auto-reply/heartbeat.js";
import * as mod_reply_groups from "../auto-reply/reply/groups.js";
import * as mod_reply_inbound_meta from "../auto-reply/reply/inbound-meta.js";
import * as mod_reply_queue from "../auto-reply/reply/queue.js";
import * as mod_reply_reply_directives from "../auto-reply/reply/reply-directives.js";
import * as mod_reply_streaming_directives from "../auto-reply/reply/streaming-directives.js";

describe("seam: auto-reply → agents (30 imports)", () => {

  it("auto-reply/heartbeat → agents boundary", () => {
    expect(mod_heartbeat).toBeDefined();
    expect(typeof mod_heartbeat).toBe("object");
  });

  it("auto-reply/groups → agents boundary", () => {
    expect(mod_reply_groups).toBeDefined();
    expect(typeof mod_reply_groups).toBe("object");
  });

  it("auto-reply/inbound-meta → agents boundary", () => {
    expect(mod_reply_inbound_meta).toBeDefined();
    expect(typeof mod_reply_inbound_meta).toBe("object");
  });

  it("auto-reply/queue → agents boundary", () => {
    expect(mod_reply_queue).toBeDefined();
    expect(typeof mod_reply_queue).toBe("object");
  });

  it("auto-reply/reply-directives → agents boundary", () => {
    expect(mod_reply_reply_directives).toBeDefined();
    expect(typeof mod_reply_reply_directives).toBe("object");
  });

  it("auto-reply/streaming-directives → agents boundary", () => {
    expect(mod_reply_streaming_directives).toBeDefined();
    expect(typeof mod_reply_streaming_directives).toBe("object");
  });
});

