import { afterEach, describe, expect, test } from "vitest";
import { restoreLiveEnv, snapshotLiveEnv } from "./live-env-test-helpers.js";

const managedEnvNames = [
  "COREBLOW_CONFIG_PATH",
  "OPENAI_API_KEY",
  "COREBLOW_EXTRA_LIVE_ENV",
] as const;

const originalEnv = snapshotLiveEnv(managedEnvNames);

afterEach(() => {
  restoreLiveEnv(originalEnv);
});

describe("live env test helpers", () => {
  test("restores CoreBlow and extra live env values", () => {
    process.env.COREBLOW_CONFIG_PATH = "/tmp/coreblow-live/coreblow.json";
    process.env.OPENAI_API_KEY = "sk-test";
    delete process.env.COREBLOW_EXTRA_LIVE_ENV;

    const snapshot = snapshotLiveEnv(["COREBLOW_EXTRA_LIVE_ENV"]);

    process.env.COREBLOW_CONFIG_PATH = "/tmp/changed/coreblow.json";
    delete process.env.OPENAI_API_KEY;
    process.env.COREBLOW_EXTRA_LIVE_ENV = "changed";

    restoreLiveEnv(snapshot);

    expect(process.env.COREBLOW_CONFIG_PATH).toBe("/tmp/coreblow-live/coreblow.json");
    expect(process.env.OPENAI_API_KEY).toBe("sk-test");
    expect(process.env.COREBLOW_EXTRA_LIVE_ENV).toBeUndefined();
  });
});
