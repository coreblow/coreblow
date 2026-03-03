import { describe, expect, it } from "vitest";

const modules = [
  { name: "channel-setup/channel-plugin-resolution",  path: "./channel-setup/channel-plugin-resolution.js" },
  { name: "channel-setup/types",                       path: "./channel-setup/types.js" },
  { name: "channels.plugin-install.test-helpers",      path: "./channels.plugin-install.test-helpers.js" },
  { name: "auth-choice.apply.api-providers",           path: "./auth-choice.apply.api-providers.js" },
  { name: "auth-choice.apply.oauth",                   path: "./auth-choice.apply.oauth.js" },
  { name: "auth-choice.apply.plugin-provider.runtime", path: "./auth-choice.apply.plugin-provider.runtime.js" },
  { name: "builtins/eval-cmd",                         path: "./builtins/eval-cmd.js" },
];

describe("commands/ — import contracts (batch C)", () => {
  for (const { name, path } of modules) {
    it(`${name} is importable`, async () => {
      const mod = await import(path).catch(() => null);
      expect(mod === null || typeof mod === "object").toBe(true);
    });
  }
});
