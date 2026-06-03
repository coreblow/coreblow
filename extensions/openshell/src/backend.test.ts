import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const cliMocks = vi.hoisted(() => ({
  runOpenShellCli: vi.fn(),
}));

let buildOpenShellSshExecEnv: typeof import("./backend.js").buildOpenShellSshExecEnv;

describe("openshell backend env", () => {
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    vi.resetModules();
    vi.doMock("./cli.js", async (importOriginal) => {
      const actual = await importOriginal<typeof import("./cli.js")>();
      return {
        ...actual,
        runOpenShellCli: cliMocks.runOpenShellCli,
      };
    });
    ({ buildOpenShellSshExecEnv } = await import("./backend.js"));
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
  });

  it("filters blocked secrets from ssh exec env", () => {
    process.env.OPENAI_API_KEY = "sk-test-secret";
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-secret";
    process.env.LANG = "en_US.UTF-8";
    process.env.NODE_ENV = "test";

    const env = buildOpenShellSshExecEnv();

    expect(env.OPENAI_API_KEY).toBeUndefined();
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.LANG).toBe("en_US.UTF-8");
    expect(env.NODE_ENV).toBe("test");
  });
});
