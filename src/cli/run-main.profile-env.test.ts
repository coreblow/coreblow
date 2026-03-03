import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fileState = vi.hoisted(() => ({
  hasCliDotEnv: false,
}));

const dotenvState = vi.hoisted(() => {
  const state = {
    profileAtDotenvLoad: undefined as string | undefined,
    containerAtDotenvLoad: undefined as string | undefined,
  };
  return {
    state,
    loadDotEnv: vi.fn(() => {
      state.profileAtDotenvLoad = process.env.COREBLOW_PROFILE;
      state.containerAtDotenvLoad = process.env.COREBLOW_CONTAINER;
    }),
  };
});

const maybeRunCliInContainerMock = vi.hoisted(() =>
  vi.fn((argv: string[]) => ({ handled: false, argv })),
);

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  type ExistsSyncPath = Parameters<typeof actual.existsSync>[0];
  return {
    ...actual,
    existsSync: vi.fn((target: ExistsSyncPath) => {
      if (typeof target === "string" && target.endsWith(".env")) {
        return fileState.hasCliDotEnv;
      }
      return actual.existsSync(target);
    }),
  };
});

vi.mock("./dotenv.js", () => ({
  loadCliDotEnv: dotenvState.loadDotEnv,
}));

vi.mock("../infra/env.js", () => ({
  normalizeEnv: vi.fn(),
}));

vi.mock("../infra/runtime-guard.js", () => ({
  assertSupportedRuntime: vi.fn(),
}));

vi.mock("../infra/path-env.js", () => ({
  ensureCoreBlowCliOnPath: vi.fn(),
}));

vi.mock("./route.js", () => ({
  tryRouteCli: vi.fn(async () => true),
}));

vi.mock("./windows-argv.js", () => ({
  normalizeWindowsArgv: (argv: string[]) => argv,
}));

vi.mock("./container-target.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./container-target.js")>();
  return {
    ...actual,
    maybeRunCliInContainer: maybeRunCliInContainerMock,
  };
});

import { runCli } from "./run-main.js";

describe("runCli profile env bootstrap", () => {
  const originalProfile = process.env.COREBLOW_PROFILE;
  const originalStateDir = process.env.COREBLOW_STATE_DIR;
  const originalConfigPath = process.env.COREBLOW_CONFIG_PATH;
  const originalContainer = process.env.COREBLOW_CONTAINER;
  const originalGatewayPort = process.env.COREBLOW_GATEWAY_PORT;
  const originalGatewayUrl = process.env.COREBLOW_GATEWAY_URL;
  const originalGatewayToken = process.env.COREBLOW_GATEWAY_TOKEN;
  const originalGatewayPassword = process.env.COREBLOW_GATEWAY_PASSWORD;

  beforeEach(() => {
    delete process.env.COREBLOW_PROFILE;
    delete process.env.COREBLOW_STATE_DIR;
    delete process.env.COREBLOW_CONFIG_PATH;
    delete process.env.COREBLOW_CONTAINER;
    delete process.env.COREBLOW_GATEWAY_PORT;
    delete process.env.COREBLOW_GATEWAY_URL;
    delete process.env.COREBLOW_GATEWAY_TOKEN;
    delete process.env.COREBLOW_GATEWAY_PASSWORD;
    dotenvState.state.profileAtDotenvLoad = undefined;
    dotenvState.state.containerAtDotenvLoad = undefined;
    dotenvState.loadDotEnv.mockClear();
    maybeRunCliInContainerMock.mockClear();
    fileState.hasCliDotEnv = false;
  });

  afterEach(() => {
    if (originalProfile === undefined) {
      delete process.env.COREBLOW_PROFILE;
    } else {
      process.env.COREBLOW_PROFILE = originalProfile;
    }
    if (originalContainer === undefined) {
      delete process.env.COREBLOW_CONTAINER;
    } else {
      process.env.COREBLOW_CONTAINER = originalContainer;
    }
    if (originalStateDir === undefined) {
      delete process.env.COREBLOW_STATE_DIR;
    } else {
      process.env.COREBLOW_STATE_DIR = originalStateDir;
    }
    if (originalConfigPath === undefined) {
      delete process.env.COREBLOW_CONFIG_PATH;
    } else {
      process.env.COREBLOW_CONFIG_PATH = originalConfigPath;
    }
    if (originalGatewayPort === undefined) {
      delete process.env.COREBLOW_GATEWAY_PORT;
    } else {
      process.env.COREBLOW_GATEWAY_PORT = originalGatewayPort;
    }
    if (originalGatewayUrl === undefined) {
      delete process.env.COREBLOW_GATEWAY_URL;
    } else {
      process.env.COREBLOW_GATEWAY_URL = originalGatewayUrl;
    }
    if (originalGatewayToken === undefined) {
      delete process.env.COREBLOW_GATEWAY_TOKEN;
    } else {
      process.env.COREBLOW_GATEWAY_TOKEN = originalGatewayToken;
    }
    if (originalGatewayPassword === undefined) {
      delete process.env.COREBLOW_GATEWAY_PASSWORD;
    } else {
      process.env.COREBLOW_GATEWAY_PASSWORD = originalGatewayPassword;
    }
  });

  it("applies --profile before dotenv loading", async () => {
    fileState.hasCliDotEnv = true;
    await runCli(["node", "coreblow", "--profile", "rawdog", "status"]);

    expect(dotenvState.loadDotEnv).toHaveBeenCalledOnce();
    expect(dotenvState.state.profileAtDotenvLoad).toBe("rawdog");
    expect(process.env.COREBLOW_PROFILE).toBe("rawdog");
  });

  it("rejects --container combined with --profile", async () => {
    await expect(
      runCli(["node", "coreblow", "--container", "demo", "--profile", "rawdog", "status"]),
    ).rejects.toThrow("--container cannot be combined with --profile/--dev");

    expect(dotenvState.loadDotEnv).not.toHaveBeenCalled();
    expect(process.env.COREBLOW_PROFILE).toBe("rawdog");
  });

  it("rejects --container combined with interleaved --profile", async () => {
    await expect(
      runCli(["node", "coreblow", "status", "--container", "demo", "--profile", "rawdog"]),
    ).rejects.toThrow("--container cannot be combined with --profile/--dev");
  });

  it("rejects --container combined with interleaved --dev", async () => {
    await expect(
      runCli(["node", "coreblow", "status", "--container", "demo", "--dev"]),
    ).rejects.toThrow("--container cannot be combined with --profile/--dev");
  });

  it("does not let dotenv change container target resolution", async () => {
    fileState.hasCliDotEnv = true;
    dotenvState.loadDotEnv.mockImplementationOnce(() => {
      process.env.COREBLOW_CONTAINER = "demo";
      dotenvState.state.profileAtDotenvLoad = process.env.COREBLOW_PROFILE;
      dotenvState.state.containerAtDotenvLoad = process.env.COREBLOW_CONTAINER;
    });

    await runCli(["node", "coreblow", "status"]);

    expect(dotenvState.loadDotEnv).toHaveBeenCalledOnce();
    expect(process.env.COREBLOW_CONTAINER).toBe("demo");
    expect(dotenvState.state.containerAtDotenvLoad).toBe("demo");
    expect(maybeRunCliInContainerMock).toHaveBeenCalledWith(["node", "coreblow", "status"]);
    expect(maybeRunCliInContainerMock).toHaveReturnedWith({
      handled: false,
      argv: ["node", "coreblow", "status"],
    });
  });

  it("allows container mode when COREBLOW_PROFILE is already set in env", async () => {
    process.env.COREBLOW_PROFILE = "work";

    await expect(
      runCli(["node", "coreblow", "--container", "demo", "status"]),
    ).resolves.toBeUndefined();
  });

  it.each([
    ["COREBLOW_GATEWAY_PORT", "19001"],
    ["COREBLOW_GATEWAY_URL", "ws://127.0.0.1:18789"],
    ["COREBLOW_GATEWAY_TOKEN", "demo-token"],
    ["COREBLOW_GATEWAY_PASSWORD", "demo-password"],
  ])("allows container mode when %s is set in env", async (key, value) => {
    process.env[key] = value;

    await expect(
      runCli(["node", "coreblow", "--container", "demo", "status"]),
    ).resolves.toBeUndefined();
  });

  it("allows container mode when only COREBLOW_STATE_DIR is set in env", async () => {
    process.env.COREBLOW_STATE_DIR = "/tmp/coreblow-host-state";

    await expect(
      runCli(["node", "coreblow", "--container", "demo", "status"]),
    ).resolves.toBeUndefined();
  });

  it("allows container mode when only COREBLOW_CONFIG_PATH is set in env", async () => {
    process.env.COREBLOW_CONFIG_PATH = "/tmp/coreblow-host-state/coreblow.json";

    await expect(
      runCli(["node", "coreblow", "--container", "demo", "status"]),
    ).resolves.toBeUndefined();
  });
});
