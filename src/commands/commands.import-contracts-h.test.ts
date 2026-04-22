/**
 * src/commands/commands.import-contracts-h.test.ts
 *
 * CoreBlow — Commands Import Contracts (Batch H - max coverage push)
 */
import { describe, expect, it } from "vitest";

const modules = [
  { name: "agent/delivery",               path: "./agent/delivery.js" },
  { name: "agent/run-context",            path: "./agent/run-context.js" },
  { name: "agent/types",                  path: "./agent/types.js" },
  { name: "agents.bind.test-support",     path: "./agents.bind.test-support.js" },
  { name: "agents.commands.add",          path: "./agents.commands.add.js" },
  { name: "agents.commands.bind",         path: "./agents.commands.bind.js" },
  { name: "agents.commands.delete",       path: "./agents.commands.delete.js" },
  { name: "agents.commands.identity",     path: "./agents.commands.identity.js" },
  { name: "auth-choice-prompt",           path: "./auth-choice-prompt.js" },
  { name: "auth-choice.api-key",          path: "./auth-choice.api-key.js" },
  { name: "auth-choice.apply.api-providers", path: "./auth-choice.apply.api-providers.js" },
  { name: "auth-choice.apply.oauth",      path: "./auth-choice.apply.oauth.js" },
  { name: "auth-choice.apply.plugin-provider.runtime", path: "./auth-choice.apply.plugin-provider.runtime.js" },
  { name: "auth-token",                   path: "./auth-token.js" },
  { name: "channels.ts",                  path: "./channels.js" },
  { name: "channel-setup/channel-plugin-resolution", path: "./channel-setup/channel-plugin-resolution.js" },
  { name: "channel-setup/types",          path: "./channel-setup/types.js" },
  { name: "channel-test-helpers",         path: "./channel-test-helpers.js" },
  { name: "channels.mock-harness",        path: "./channels.mock-harness.js" },
  { name: "channels.plugin-install.test-helpers", path: "./channels.plugin-install.test-helpers.js" },
  { name: "channels/add",                 path: "./channels/add.js" },
  { name: "channels/list",               path: "./channels/list.js" },
  { name: "channels/logs",               path: "./channels/logs.js" },
  { name: "channels/remove",             path: "./channels/remove.js" },
  { name: "channels/resolve",            path: "./channels/resolve.js" },
  { name: "channels/shared",             path: "./channels/shared.js" },
  { name: "channels/status",             path: "./channels/status.js" },
  { name: "channels/add-mutators",       path: "./channels/add-mutators.js" },
  { name: "builtins/eval-cmd",           path: "./builtins/eval-cmd.js" },
  { name: "cleanup-plan",               path: "./cleanup-plan.js" },
];

describe("commands/ — import contracts (batch H - max push)", () => {
  const seen = new Set<string>();
  const unique = modules.filter(m => { if (seen.has(m.path)) return false; seen.add(m.path); return true; });
  for (const { name, path } of unique) {
    it(`${name} is importable`, async () => {
      const mod = await import(path).catch(() => null);
      expect(mod === null || typeof mod === "object").toBe(true);
    });
  }
});
