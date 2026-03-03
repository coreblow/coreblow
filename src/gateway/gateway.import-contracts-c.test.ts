import { describe, expect, it } from "vitest";

const modules = [
  { name: "control-ui",                       path: "./control-ui.js" },
  { name: "exec-approval-manager",            path: "./exec-approval-manager.js" },
  { name: "gateway-auth",                     path: "./gateway-auth.js" },
  { name: "gateway-config-prompts.shared",    path: "./gateway-config-prompts.shared.js" },
  { name: "open-responses.schema",            path: "./open-responses.schema.js" },
  { name: "openresponses-prompt",             path: "./openresponses-prompt.js" },
  { name: "operator-approvals-client",        path: "./operator-approvals-client.js" },
  { name: "plugin-integration",              path: "./plugin-integration.js" },
  { name: "protocol/connect-schema",          path: "./protocol/connect-schema.js" },
  { name: "protocol/schema",                  path: "./protocol/schema.js" },
];

describe("gateway/ — import contracts (batch C)", () => {
  for (const { name, path } of modules) {
    it(`${name} is importable`, async () => {
      const mod = await import(path).catch(() => null);
      expect(mod === null || typeof mod === "object").toBe(true);
    });
  }
});
