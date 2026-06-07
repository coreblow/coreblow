import { describe, expect, it } from "vitest";
import { channelSecrets, secretTargetRegistryEntries } from "./secret-contract.js";

describe("googlechat secret contract", () => {
  it("declares service account secret targets", () => {
    expect(secretTargetRegistryEntries[0]?.id).toBe("channels.googlechat.serviceAccount");
    expect(channelSecrets.secretTargetRegistryEntries).toBe(secretTargetRegistryEntries);
  });
});
