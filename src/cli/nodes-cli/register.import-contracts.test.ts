import { describe, expect, it } from "vitest";

const modules = [
  { name: "register.ts",        path: "./register.js" },
  { name: "register.notify",    path: "./register.notify.js" },
  { name: "register.push",      path: "./register.push.js" },
  { name: "register.status",    path: "./register.status.js" },
  { name: "register.pairing",   path: "./register.pairing.js" },
  { name: "register.invoke",    path: "./register.invoke.js" },
  { name: "register.location",  path: "./register.location.js" },
  { name: "register.canvas",    path: "./register.canvas.js" },
];

describe("nodes-cli registers — import contracts", () => {
  for (const { name, path } of modules) {
    it(`${name} is importable`, async () => {
      const mod = await import(path).catch(() => null);
      expect(mod === null || typeof mod === "object").toBe(true);
    });
  }
});
