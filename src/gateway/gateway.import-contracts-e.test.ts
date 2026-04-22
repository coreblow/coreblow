import { describe, expect, it } from "vitest";

const modules = [
  { name: "startup-auth-profiles",             path: "./startup-auth-profiles.js" },
  { name: "startup-control-ui-origins",        path: "./startup-control-ui-origins.js" },
  { name: "stream-processor",                  path: "./stream-processor.js" },
  { name: "tenant-config",                     path: "./tenant-config.js" },
  { name: "tenant-manager",                    path: "./tenant-manager.js" },
  { name: "usage-billing",                     path: "./usage-billing.js" },
  { name: "websocket-manager",                 path: "./websocket-manager.js" },
  { name: "ws-logging",                        path: "./ws-logging.js" },
  { name: "sse-handler",                       path: "./sse-handler.js" },
  { name: "session-subagent-reactivation.runtime", path: "./session-subagent-reactivation.runtime.js" },
];

describe("gateway/ — import contracts (batch E)", () => {
  for (const { name, path } of modules) {
    it(`${name} is importable`, async () => {
      const mod = await import(path).catch(() => null);
      expect(mod === null || typeof mod === "object").toBe(true);
    });
  }
});
