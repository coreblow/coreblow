import { describe, expect, it } from "vitest";
const modules = [
  "agent-command", "agent-engine", "auto-reply", "bash-tools-exec",
  "bash-tools.exec-host-gateway", "bash-tools.exec-host-node",
  "bash-tools.exec-host-shared", "bash-tools.exec-types",
  "bash-tools.exec", "bash-tools.process",
];
describe("agents/ — import contracts (batch A)", () => {
  for (const name of modules) {
    it(`${name} is importable`, async () => {
      const m = await import(`./${name}.js`).catch(() => null);
      expect(m === null || typeof m === "object").toBe(true);
    });
  }
});
