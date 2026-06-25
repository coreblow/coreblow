import { describe, expect, it } from "vitest";
import {
  resolveChannelMessageIngress,
  type ChannelIngressIdentityDescriptor,
} from "./channel-ingress-runtime.js";

const identity = {
  primary: { normalize: (value) => value.trim().toLowerCase(), sensitivity: "pii" },
} satisfies ChannelIngressIdentityDescriptor;

describe("channel ingress runtime", () => {
  it("resolves sender admission through the shared ingress kernel", async () => {
    const result = await resolveChannelMessageIngress({
      channelId: "runtime-test",
      accountId: "default",
      identity,
      subject: { stableId: "Owner" },
      conversation: { kind: "direct", id: "dm-1" },
      event: { kind: "message", authMode: "inbound", mayPair: true },
      policy: { dmPolicy: "allowlist", groupPolicy: "disabled" },
      allowFrom: ["owner"],
    });
    expect(result.ingress.admission).toBe("dispatch");
    expect(result.senderAccess.decision).toBe("allow");
  });
});
