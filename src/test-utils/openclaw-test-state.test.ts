import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createCoreBlowTestState, withCoreBlowTestState } from "./coreblow-test-state.js";

async function expectPathMissing(targetPath: string): Promise<void> {
  try {
    await fs.stat(targetPath);
  } catch (error) {
    expect((error as NodeJS.ErrnoException).code).toBe("ENOENT");
    return;
  }
  throw new Error(`expected missing path: ${targetPath}`);
}

describe("coreblow test state", () => {
  it("creates an isolated home layout with spawn env and restores process env", async () => {
    const previousHome = process.env.HOME;
    const previousCoreBlowHome = process.env.COREBLOW_HOME;
    const previousStateDir = process.env.COREBLOW_STATE_DIR;
    const previousConfigPath = process.env.COREBLOW_CONFIG_PATH;

    const state = await createCoreBlowTestState({
      label: "unit",
      scenario: "minimal",
    });

    try {
      expect(state.home).toBe(path.join(state.root, "home"));
      expect(state.stateDir).toBe(path.join(state.home, ".coreblow"));
      expect(state.configPath).toBe(path.join(state.stateDir, "coreblow.json"));
      expect(state.workspaceDir).toBe(path.join(state.home, "workspace"));
      expect(state.env.HOME).toBe(state.home);
      expect(state.env.COREBLOW_HOME).toBe(state.home);
      expect(state.env.COREBLOW_STATE_DIR).toBe(state.stateDir);
      expect(state.env.COREBLOW_CONFIG_PATH).toBe(state.configPath);
      expect(process.env.HOME).toBe(state.home);
      expect(process.env.COREBLOW_HOME).toBe(state.home);
      expect(JSON.parse(await fs.readFile(state.configPath, "utf8"))).toStrictEqual({});
    } finally {
      await state.cleanup();
    }

    expect(process.env.HOME).toBe(previousHome);
    expect(process.env.COREBLOW_HOME).toBe(previousCoreBlowHome);
    expect(process.env.COREBLOW_STATE_DIR).toBe(previousStateDir);
    expect(process.env.COREBLOW_CONFIG_PATH).toBe(previousConfigPath);
    await expectPathMissing(state.root);
  });

  it("supports state-only layout without overriding HOME", async () => {
    const previousHome = process.env.HOME;

    await withCoreBlowTestState(
      {
        layout: "state-only",
        scenario: "empty",
      },
      async (state) => {
        expect(process.env.HOME).toBe(previousHome);
        expect(process.env.COREBLOW_STATE_DIR).toBe(state.stateDir);
        expect(process.env.COREBLOW_CONFIG_PATH).toBe(state.configPath);
        expect(state.env.HOME).toBe(previousHome);
        await expectPathMissing(state.configPath);
      },
    );
  });

  it("clears inherited agent-dir overrides by default", async () => {
    const previousAgentDir = process.env.COREBLOW_AGENT_DIR;
    const previousPiAgentDir = process.env.PI_CODING_AGENT_DIR;
    process.env.COREBLOW_AGENT_DIR = "/tmp/outside-coreblow-agent";
    process.env.PI_CODING_AGENT_DIR = "/tmp/outside-pi-agent";

    try {
      const state = await createCoreBlowTestState({
        layout: "state-only",
      });

      try {
        expect(process.env.COREBLOW_AGENT_DIR).toBeUndefined();
        expect(process.env.PI_CODING_AGENT_DIR).toBeUndefined();
        expect(state.env.COREBLOW_AGENT_DIR).toBeUndefined();
        expect(state.env.PI_CODING_AGENT_DIR).toBeUndefined();
        expect(state.agentDir()).toBe(path.join(state.stateDir, "agents", "main", "agent"));
      } finally {
        await state.cleanup();
      }

      expect(process.env.COREBLOW_AGENT_DIR).toBe("/tmp/outside-coreblow-agent");
      expect(process.env.PI_CODING_AGENT_DIR).toBe("/tmp/outside-pi-agent");
    } finally {
      if (previousAgentDir === undefined) {
        delete process.env.COREBLOW_AGENT_DIR;
      } else {
        process.env.COREBLOW_AGENT_DIR = previousAgentDir;
      }
      if (previousPiAgentDir === undefined) {
        delete process.env.PI_CODING_AGENT_DIR;
      } else {
        process.env.PI_CODING_AGENT_DIR = previousPiAgentDir;
      }
    }
  });

  it("allows explicit agent-dir overrides when a test needs them", async () => {
    await withCoreBlowTestState(
      {
        env: {
          COREBLOW_AGENT_DIR: "/tmp/explicit-coreblow-agent",
          PI_CODING_AGENT_DIR: "/tmp/explicit-pi-agent",
        },
      },
      async (state) => {
        expect(process.env.COREBLOW_AGENT_DIR).toBe("/tmp/explicit-coreblow-agent");
        expect(process.env.PI_CODING_AGENT_DIR).toBe("/tmp/explicit-pi-agent");
        expect(state.env.COREBLOW_AGENT_DIR).toBe("/tmp/explicit-coreblow-agent");
        expect(state.env.PI_CODING_AGENT_DIR).toBe("/tmp/explicit-pi-agent");
      },
    );
  });

  it("can route agent-dir env vars to the isolated main agent store", async () => {
    await withCoreBlowTestState(
      {
        agentEnv: "main",
      },
      async (state) => {
        expect(process.env.COREBLOW_AGENT_DIR).toBe(state.agentDir());
        expect(process.env.PI_CODING_AGENT_DIR).toBe(state.agentDir());
        expect(state.env.COREBLOW_AGENT_DIR).toBe(state.agentDir());
        expect(state.env.PI_CODING_AGENT_DIR).toBe(state.agentDir());
      },
    );
  });

  it("writes scenario configs and auth profile stores", async () => {
    await withCoreBlowTestState(
      {
        scenario: "update-stable",
      },
      async (state) => {
        expect(JSON.parse(await fs.readFile(state.configPath, "utf8"))).toEqual({
          update: {
            channel: "stable",
          },
          plugins: {},
        });

        const profilePath = await state.writeAuthProfiles({
          version: 1,
          profiles: {
            "openai:test": {
              type: "api_key",
              provider: "openai",
              key: "sk-test",
            },
          },
        });

        expect(profilePath).toBe(path.join(state.agentDir(), "auth-profiles.json"));
        const profiles = JSON.parse(await fs.readFile(profilePath, "utf8")) as {
          version?: unknown;
          profiles?: Record<string, { provider?: unknown }>;
        };
        expect(profiles.version).toBe(1);
        expect(profiles.profiles?.["openai:test"]?.provider).toBe("openai");
      },
    );
  });

  it("creates upgrade survivor fixture state", async () => {
    await withCoreBlowTestState(
      {
        scenario: "upgrade-survivor",
      },
      async (state) => {
        const config = JSON.parse(await fs.readFile(state.configPath, "utf8"));
        expect(config.update?.channel).toBe("stable");
        expect(config.plugins?.enabled).toBe(true);
        expect(config.plugins?.allow).toStrictEqual(["discord", "telegram", "whatsapp", "memory"]);
      },
    );
  });

  it("keeps external-service env scoped to the fixture", async () => {
    const previousPolicy = process.env.COREBLOW_SERVICE_REPAIR_POLICY;

    await withCoreBlowTestState(
      {
        scenario: "external-service",
      },
      async (state) => {
        expect(process.env.COREBLOW_SERVICE_REPAIR_POLICY).toBe("external");
        expect(state.env.COREBLOW_SERVICE_REPAIR_POLICY).toBe("external");
      },
    );

    expect(process.env.COREBLOW_SERVICE_REPAIR_POLICY).toBe(previousPolicy);
  });
});
