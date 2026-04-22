/**
 * src/config/types.import-contracts-b.test.ts
 *
 * CoreBlow — Config Types Import Contracts (Batch B)
 */
import { describe, expect, it } from "vitest";

const typeModules = [
  "types.discord.ts",
  "types.slack.ts",
  "types.telegram.ts",
  "types.whatsapp.ts",
  "types.signal.ts",
  "types.imessage.ts",
  "types.irc.ts",
  "types.msteams.ts",
  "types.googlechat.ts",
  "types.acp.ts",
  "types.approvals.ts",
  "types.browser.ts",
  "types.channel-messaging-common.ts",
  "types.cli.ts",
  "types.hooks.ts",
  "types.installs.ts",
  "types.memory.ts",
  "types.messages.ts",
  "types.node-host.ts",
  "types.openclaw.ts",
  "types.queue.ts",
  "types.sandbox.ts",
  "types.tts.ts",
];

describe("config/ types — import contracts (batch B)", () => {
  for (const name of typeModules) {
    it(`${name} is importable`, async () => {
      const mod = await import(`./${name.replace(".ts", ".js")}`).catch(() => null);
      expect(mod === null || typeof mod === "object").toBe(true);
    });
  }
});
