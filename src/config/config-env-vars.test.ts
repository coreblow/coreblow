import { describe, it, expect } from "vitest";
import {
  collectConfigRuntimeEnvVars,
  collectConfigServiceEnvVars,
  collectConfigEnvVars,
  applyConfigEnvVars,
  createConfigRuntimeEnv,
} from "./config-env-vars.js";

describe("collectConfigRuntimeEnvVars", () => {
  it("returns empty for undefined config", () => {
    expect(collectConfigRuntimeEnvVars(undefined)).toEqual({});
  });

  it("returns empty when config has no env", () => {
    expect(collectConfigRuntimeEnvVars({} as any)).toEqual({});
  });

  it("collects vars from env.vars", () => {
    const cfg = { env: { vars: { MY_TOKEN: "abc123", EMPTY: "" } } } as any;
    const vars = collectConfigRuntimeEnvVars(cfg);
    expect(vars.MY_TOKEN).toBe("abc123");
    expect(vars.EMPTY).toBeUndefined(); // empty values skipped
  });

  it("collects top-level env string entries (non-vars, non-shellEnv)", () => {
    const cfg = { env: { MY_KEY: "val1", shellEnv: { enabled: true }, vars: {} } } as any;
    const vars = collectConfigRuntimeEnvVars(cfg);
    expect(vars.MY_KEY).toBe("val1");
  });

  it("skips shellEnv and vars keys in top-level scan", () => {
    const cfg = { env: { vars: { A: "1" }, shellEnv: { enabled: true } } } as any;
    const vars = collectConfigRuntimeEnvVars(cfg);
    expect(vars.A).toBe("1");
    expect(vars.shellEnv).toBeUndefined();
    expect(vars.vars).toBeUndefined();
  });

  it("skips non-string and whitespace-only top-level values", () => {
    const cfg = { env: { num: 42, empty: "  ", VALID_KEY: "hello" } } as any;
    const vars = collectConfigRuntimeEnvVars(cfg);
    expect(vars.num).toBeUndefined();
    expect(vars.empty).toBeUndefined();
    expect(vars.VALID_KEY).toBe("hello");
  });
});

describe("collectConfigServiceEnvVars", () => {
  it("returns same result as runtime vars (same underlying function)", () => {
    const cfg = { env: { vars: { SVC_KEY: "svc-val" } } } as any;
    expect(collectConfigServiceEnvVars(cfg)).toEqual(collectConfigRuntimeEnvVars(cfg));
  });
});

describe("collectConfigEnvVars (deprecated)", () => {
  it("delegates to collectConfigRuntimeEnvVars", () => {
    const cfg = { env: { vars: { OLD: "val" } } } as any;
    expect(collectConfigEnvVars(cfg)).toEqual(collectConfigRuntimeEnvVars(cfg));
  });
});

describe("applyConfigEnvVars", () => {
  it("sets env vars that are not already present", () => {
    const env: Record<string, string | undefined> = {};
    const cfg = { env: { vars: { NEW_VAR: "new-value" } } } as any;
    applyConfigEnvVars(cfg, env as NodeJS.ProcessEnv);
    expect(env.NEW_VAR).toBe("new-value");
  });

  it("does not overwrite existing env vars", () => {
    const env: Record<string, string | undefined> = { EXISTING: "original" };
    const cfg = { env: { vars: { EXISTING: "overwritten" } } } as any;
    applyConfigEnvVars(cfg, env as NodeJS.ProcessEnv);
    expect(env.EXISTING).toBe("original");
  });

  it("skips values with unresolved ${VAR} references", () => {
    const env: Record<string, string | undefined> = {};
    const cfg = { env: { vars: { TOKEN: "${VAULT_TOKEN}" } } } as any;
    applyConfigEnvVars(cfg, env as NodeJS.ProcessEnv);
    expect(env.TOKEN).toBeUndefined();
  });
});

describe("createConfigRuntimeEnv", () => {
  it("creates a new env object with config vars applied", () => {
    const baseEnv = { EXISTING: "yes" } as unknown as NodeJS.ProcessEnv;
    const cfg = { env: { vars: { NEW: "hello" } } } as any;
    const result = createConfigRuntimeEnv(cfg, baseEnv);
    expect(result.EXISTING).toBe("yes");
    expect(result.NEW).toBe("hello");
  });

  it("does not mutate the base env", () => {
    const baseEnv = {} as unknown as NodeJS.ProcessEnv;
    const cfg = { env: { vars: { ADDED: "val" } } } as any;
    createConfigRuntimeEnv(cfg, baseEnv);
    expect((baseEnv as any).ADDED).toBeUndefined();
  });
});
