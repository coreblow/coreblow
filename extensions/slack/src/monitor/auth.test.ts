import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SlackMonitorContext } from "./context.js";

const readChannelIngressStoreAllowFromForDmPolicyMock = vi.hoisted(() => vi.fn());
let clearSlackAllowFromCacheForTest: typeof import("./auth.js").clearSlackAllowFromCacheForTest;
let resolveSlackEffectiveAllowFrom: typeof import("./auth.js").resolveSlackEffectiveAllowFrom;

vi.mock("coreblow/plugin-sdk/channel-ingress-runtime", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("coreblow/plugin-sdk/channel-ingress-runtime")>();
  return {
    ...actual,
    readChannelIngressStoreAllowFromForDmPolicy: (...args: unknown[]) =>
      readChannelIngressStoreAllowFromForDmPolicyMock(...args),
  };
});

function makeSlackCtx(allowFrom: string[]): SlackMonitorContext {
  return {
    allowFrom,
    accountId: "main",
    dmPolicy: "pairing",
  } as unknown as SlackMonitorContext;
}

describe("resolveSlackEffectiveAllowFrom", () => {
  const prevTtl = process.env.COREBLOW_SLACK_PAIRING_ALLOWFROM_CACHE_TTL_MS;

  beforeEach(async () => {
    vi.resetModules();
    ({ clearSlackAllowFromCacheForTest, resolveSlackEffectiveAllowFrom } =
      await import("./auth.js"));
    readChannelIngressStoreAllowFromForDmPolicyMock.mockReset();
    clearSlackAllowFromCacheForTest();
    if (prevTtl === undefined) {
      delete process.env.COREBLOW_SLACK_PAIRING_ALLOWFROM_CACHE_TTL_MS;
    } else {
      process.env.COREBLOW_SLACK_PAIRING_ALLOWFROM_CACHE_TTL_MS = prevTtl;
    }
  });

  it("falls back to channel config allowFrom when pairing store throws", async () => {
    readChannelIngressStoreAllowFromForDmPolicyMock.mockRejectedValueOnce(new Error("boom"));

    const effective = await resolveSlackEffectiveAllowFrom(makeSlackCtx(["u1"]), {
      includePairingStore: true,
    });

    expect(effective).toEqual(["u1"]);
  });

  it("treats malformed non-array pairing-store responses as empty", async () => {
    readChannelIngressStoreAllowFromForDmPolicyMock.mockReturnValueOnce(undefined);

    const effective = await resolveSlackEffectiveAllowFrom(makeSlackCtx(["u1"]), {
      includePairingStore: true,
    });

    expect(effective).toEqual(["u1"]);
  });

  it("reads pairing-store allowFrom when requested", async () => {
    readChannelIngressStoreAllowFromForDmPolicyMock.mockResolvedValue(["u2"]);
    const ctx = makeSlackCtx(["u1"]);

    const effective = await resolveSlackEffectiveAllowFrom(ctx, { includePairingStore: true });

    expect(effective).toEqual(["u1", "u2"]);
    expect(readChannelIngressStoreAllowFromForDmPolicyMock).toHaveBeenCalledTimes(1);
  });

  it("does not read pairing-store allowFrom unless requested", async () => {
    readChannelIngressStoreAllowFromForDmPolicyMock.mockResolvedValue(["u2"]);

    const effective = await resolveSlackEffectiveAllowFrom(makeSlackCtx(["u1"]));

    expect(effective).toEqual(["u1"]);
    expect(readChannelIngressStoreAllowFromForDmPolicyMock).not.toHaveBeenCalled();
  });
});
