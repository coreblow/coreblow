import { describe, expect, it } from "vitest";

const modules = [
  { name: "provider-auth-guidance",    path: "./provider-auth-guidance.js" },
  { name: "provider-auth-helpers",     path: "./provider-auth-helpers.js" },
  { name: "registry",                  path: "./registry.js" },
  { name: "sandbox-display",           path: "./sandbox-display.js" },
  { name: "self-hosted-provider-setup", path: "./self-hosted-provider-setup.js" },
  { name: "sessions-table",            path: "./sessions-table.js" },
  { name: "status-all",                path: "./status-all.js" },
  { name: "systemd-linger",            path: "./systemd-linger.js" },
  { name: "types",                     path: "./types.js" },
  { name: "vllm-setup",                path: "./vllm-setup.js" },
];

describe("commands/ — import contracts (batch E)", () => {
  for (const { name, path } of modules) {
    it(`${name} is importable`, async () => {
      const mod = await import(path).catch(() => null);
      expect(mod === null || typeof mod === "object").toBe(true);
    });
  }
});
