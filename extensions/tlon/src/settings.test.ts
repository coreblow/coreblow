import { describe, expect, it, vi } from "vitest";
import { createSettingsManager } from "./settings.js";
import type { UrbitSSEClient } from "./urbit/sse-client.js";

type SubscribeParams = Parameters<UrbitSSEClient["subscribe"]>[0];

function makeApi(params: {
  scryResult?: unknown;
  onSubscribe?: (params: SubscribeParams) => void;
}): UrbitSSEClient {
  return {
    scry: vi.fn(async () => params.scryResult ?? {}),
    subscribe: vi.fn(async (subscription: SubscribeParams) => {
      params.onSubscribe?.(subscription);
      return 1;
    }),
  } as unknown as UrbitSSEClient;
}

describe("tlon settings store", () => {
  it("loads settings from blowbot desk", async () => {
    const api = makeApi({
      scryResult: {
        all: {
          blowbot: { tlon: { dmAllowlist: ["~zod"] } },
        },
      },
    });

    const settings = await createSettingsManager(api).load();

    expect(settings.dmAllowlist).toEqual(["~zod"]);
  });

  it("returns empty settings when blowbot desk has no data", async () => {
    const api = makeApi({
      scryResult: { all: {} },
    });

    const settings = await createSettingsManager(api).load();

    expect(settings.dmAllowlist).toBeUndefined();
  });

  it("subscribes to blowbot settings desk", async () => {
    const handlers = new Map<string, NonNullable<SubscribeParams["event"]>>();
    const api = makeApi({
      onSubscribe: (subscription) => {
        if (subscription.event) {
          handlers.set(subscription.path, subscription.event);
        }
      },
    });
    const manager = createSettingsManager(api);
    const listener = vi.fn();
    manager.onChange(listener);

    await manager.startSubscription();

    expect(handlers.has("/desk/blowbot")).toBe(true);

    handlers.get("/desk/blowbot")?.({
      "put-entry": {
        desk: "blowbot",
        "bucket-key": "tlon",
        "entry-key": "dmAllowlist",
        value: ["~nec"],
      },
    });

    expect(manager.current.dmAllowlist).toEqual(["~nec"]);
    expect(listener).toHaveBeenCalledWith({ dmAllowlist: ["~nec"] });
  });
});
