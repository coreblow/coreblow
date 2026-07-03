import { describe, it, expect, vi } from "vitest";
import { resolveDiscordDmCommandAccess } from "./dm-command-auth.js";
import type { ResolvedChannelMessageIngress } from "coreblow/plugin-sdk/channel-ingress-runtime";

const sender = { id: "123", name: "Test", tag: "Test#1234" };

describe("resolveDiscordDmCommandAccess", () => {
  it("allows known sender with allowlist policy", async () => {
    const result = await resolveDiscordDmCommandAccess({
      accountId: "default",
      dmPolicy: "allowlist",
      configuredAllowFrom: ["discord:123"],
      sender,
      allowNameMatching: false,
      readStoreAllowFrom: async () => [],
    });

    expect(result.senderAccess.decision).toBe("allow");
    expect(result.commandAccess.authorized).toBe(true);
  });

  it("returns pairing decision and unauthorized command auth for unknown senders", async () => {
    const result = await resolveDiscordDmCommandAccess({
      accountId: "default",
      dmPolicy: "pairing",
      configuredAllowFrom: ["discord:456"],
      sender,
      allowNameMatching: false,
      readStoreAllowFrom: async () => [],
    });

    expect(result.senderAccess.decision).toBe("pairing");
    expect(result.commandAccess.authorized).toBe(false);
  });

  it("authorizes sender from pairing-store allowlist entries", async () => {
    const result = await resolveDiscordDmCommandAccess({
      accountId: "default",
      dmPolicy: "pairing",
      configuredAllowFrom: [],
      sender,
      allowNameMatching: false,
      readStoreAllowFrom: async () => ["discord:123"],
    });

    expect(result.senderAccess.decision).toBe("allow");
    expect(result.commandAccess.authorized).toBe(true);
  });

  it("keeps open DM command auth true when access groups are disabled", async () => {
    const result = await resolveDiscordDmCommandAccess({
      accountId: "default",
      dmPolicy: "open",
      configuredAllowFrom: [],
      sender,
      allowNameMatching: false,
      readStoreAllowFrom: async () => [],
    });

    expect(result.senderAccess.decision).toBe("allow");
    expect(result.commandAccess.authorized).toBe(true);
  });
});
