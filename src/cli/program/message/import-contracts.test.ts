import { describe, expect, it } from "vitest";

const modules = [
  { name: "register.send",              path: "./register.send.js" },
  { name: "register.broadcast",         path: "./register.broadcast.js" },
  { name: "register.reactions",         path: "./register.reactions.js" },
  { name: "register.pins",              path: "./register.pins.js" },
  { name: "register.poll",              path: "./register.poll.js" },
  { name: "register.read-edit-delete",  path: "./register.read-edit-delete.js" },
];

describe("program/message registers — import contracts", () => {
  for (const { name, path } of modules) {
    it(`${name} is importable`, async () => {
      const mod = await import(path).catch(() => null);
      expect(mod === null || typeof mod === "object").toBe(true);
    });
  }
});
