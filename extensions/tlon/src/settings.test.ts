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
  it("prefers the rebranded blowbot settings desk", async () => {
    const api = makeApi({
      scryResult: {
        all: {
          blowbot: { tlon: { dmAllowlist: ["~zod"] } },
          moltbot: { tlon: { dmAllowlist: ["~nec"] } },
        },
      },
    });

    const settings = await createSettingsManager(api).load();

    expect(settings.dmAllowlist).toEqual(["~zod"]);
  });

  it("loads the legacy moltbot settings desk for compatibility", async () => {
    const api = makeApi({
      scryResult: {
        all: {
          moltbot: { tlon: { dmAllowlist: ["~nec"] } },
        },
      },
    });

    const settings = await createSettingsManager(api).load();

    expect(settings.dmAllowlist).toEqual(["~nec"]);
  });

  it("subscribes to both rebranded and legacy settings desks", async () => {
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
    expect(handlers.has("/desk/moltbot")).toBe(true);

    handlers.get("/desk/moltbot")?.({
      "put-entry": {
        desk: "moltbot",
        "bucket-key": "tlon",
        "entry-key": "dmAllowlist",
        value: ["~nec"],
      },
    });

    expect(manager.current.dmAllowlist).toEqual(["~nec"]);
    expect(listener).toHaveBeenCalledWith({ dmAllowlist: ["~nec"] });
  });
});
