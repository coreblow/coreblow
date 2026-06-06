import { describe, expect, it } from "vitest";
import {
  applyUnsetPathsForWrite,
  collectChangedPaths,
  createMergePatch,
  formatConfigValidationFailure,
  resolvePersistCandidateForWrite,
  resolveWriteEnvSnapshotForPath,
  restoreEnvRefsFromMap,
  unsetPathForWrite,
} from "./io.write-prepare.js";
import type { CoreBlowConfig } from "./types.js";

describe("config io write prepare helpers", () => {
  it("persists caller changes onto source config without leaking runtime defaults", () => {
    const persisted = resolvePersistCandidateForWrite({
      runtimeConfig: {
        gateway: { port: 18789 },
        agents: { defaults: { cliBackend: "codex" } },
        messages: { ackReaction: "eyes" },
        sessions: { persistence: true },
      } as CoreBlowConfig,
      sourceConfig: {
        gateway: { port: 18789 },
      } as CoreBlowConfig,
      nextConfig: {
        gateway: {
          port: 18789,
          auth: { mode: "token" },
        },
      } as CoreBlowConfig,
    }) as Record<string, unknown>;

    expect(persisted.gateway).toEqual({
      port: 18789,
      auth: { mode: "token" },
    });
    expect(persisted).not.toHaveProperty("agents.defaults");
    expect(persisted).not.toHaveProperty("messages.ackReaction");
    expect(persisted).not.toHaveProperty("sessions.persistence");
  });

  it("strips managed plugin install records from partial writes", () => {
    const persisted = applyUnsetPathsForWrite({
      plugins: {
        entries: {},
        installs: {
          "web-search": {
            source: "npm",
            spec: "@coreblow/web-search",
          },
        },
      },
    }) as { plugins?: { installs?: unknown } };

    expect(persisted.plugins?.installs).toBeUndefined();
  });

  it("creates merge patches and unsets explicit paths", () => {
    expect(createMergePatch({ a: 1, b: { c: 2 }, d: 4 }, { b: { c: 3 }, d: 4 })).toEqual({
      a: null,
      b: { c: 3 },
    });
    expect(unsetPathForWrite({ a: { b: 1, c: 2 } }, ["a", "b"])).toEqual({ a: { c: 2 } });
  });

  it("collects changed paths and restores untouched env refs", () => {
    const changedPaths = collectChangedPaths(
      { gateway: { auth: { token: "resolved-token", mode: "token" } } },
      { gateway: { auth: { token: "resolved-token", mode: "password" } } },
    );
    const envRefs = new Map([["gateway.auth.token", "${COREBLOW_GATEWAY_TOKEN}"]]);

    expect([...changedPaths]).toEqual(["gateway.auth.mode"]);
    expect(resolveWriteEnvSnapshotForPath(changedPaths, envRefs)).toBeNull();
    expect(
      restoreEnvRefsFromMap(
        { gateway: { auth: { token: "resolved-token", mode: "password" } } },
        "",
        envRefs,
        changedPaths,
      ),
    ).toEqual({ gateway: { auth: { token: "${COREBLOW_GATEWAY_TOKEN}", mode: "password" } } });
  });

  it("formats validation failures", () => {
    expect(formatConfigValidationFailure([{ path: "", message: "invalid" }])).toBe(
      "- <root>: invalid",
    );
  });
});
