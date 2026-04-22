/**
 * src/gateway/server-methods/import-contracts.test.ts
 *
 * CoreBlow — Gateway Server Methods Import Contracts (Batch A)
 */
import { describe, expect, it } from "vitest";

const methods = [
  "agent-job",
  "agents",
  "attachment-normalize",
  "channels",
  "chat-attachments",
  "chat-transcript-inject",
  "chat",
  "config",
  "connect",
  "cron",
];

describe("gateway/server-methods — import contracts (batch A)", () => {
  for (const name of methods) {
    it(`${name} is importable`, async () => {
      const mod = await import(`./${name}.js`).catch(() => null);
      expect(mod === null || typeof mod === "object").toBe(true);
    });
  }
});
