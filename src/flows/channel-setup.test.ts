import { describe, expect, it, vi } from "vitest";
import {
  createChannelOnboardingPostWriteHook,
  createChannelOnboardingPostWriteHookCollector,
  runCollectedChannelOnboardingPostWriteHooks,
} from "./channel-setup.js";
import type { RuntimeEnv } from "../runtime.js";

const runtime: RuntimeEnv = { log: () => {}, error: () => {}, exit: () => {} };

describe("channel setup flow", () => {
  it("creates and runs account-scoped post-write hooks", async () => {
    const afterConfigWritten = vi.fn();
    const hook = createChannelOnboardingPostWriteHook({
      channel: "telegram",
      accountId: "default",
      previousCfg: {},
      adapter: { afterConfigWritten },
    });
    const collector = createChannelOnboardingPostWriteHookCollector();
    collector.collect(hook!);

    await runCollectedChannelOnboardingPostWriteHooks({
      hooks: collector.drain(),
      cfg: { gateway: { mode: "local" } },
      runtime,
    });

    expect(afterConfigWritten).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: "default", previousCfg: {} }),
    );
  });
});
