// @ts-nocheck
import { describe, expect, it } from "vitest";
import {
  COREBLOW_CLI_ENV_VAR,
  COREBLOW_CLI_ENV_VALUE,
  markCoreBlowExecEnv,
  ensureCoreBlowExecMarkerOnProcess,
} from "./coreblow-exec-env.js";

describe("CoreBlow exec env marker", () => {
  it("marks an env record with the CLI env variable", () => {
    const env = { PATH: "/usr/bin" };
    const marked = markCoreBlowExecEnv(env);
    expect(marked[COREBLOW_CLI_ENV_VAR]).toBe(COREBLOW_CLI_ENV_VALUE);
    expect(marked.PATH).toBe("/usr/bin");
  });

  it("sets the marker on a process-like env object", () => {
    const env: Record<string, string | undefined> = {};
    ensureCoreBlowExecMarkerOnProcess(env as any);
    expect(env[COREBLOW_CLI_ENV_VAR]).toBe(COREBLOW_CLI_ENV_VALUE);
  });
});
