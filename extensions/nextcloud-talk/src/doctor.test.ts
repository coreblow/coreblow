import { describe, expect, it } from "vitest";
import { normalizeCompatibilityConfig } from "./doctor-contract.js";

describe("nextcloud-talk doctor", () => {
  it("migrates private-network compatibility flags for root and accounts", () => {
    const result = normalizeCompatibilityConfig({ cfg: { channels: { "nextcloud-talk": { allowPrivateNetwork: true, accounts: { work: { allowPrivateNetwork: false } } } } } });
    const channel = result.config.channels?.["nextcloud-talk"] as {
      network: { dangerouslyAllowPrivateNetwork: boolean };
      accounts: { work: { network: { dangerouslyAllowPrivateNetwork: boolean } } };
    };
    expect(result.changed).toBe(true);
    expect(channel.network.dangerouslyAllowPrivateNetwork).toBe(true);
    expect(channel.accounts.work.network.dangerouslyAllowPrivateNetwork).toBe(false);
  });
});
