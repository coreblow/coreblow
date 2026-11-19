import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  approvePairing,
  listPairingState,
  requestOrCheckPairing,
  resolvePairingStorePath,
  revokePairing,
} from "./pairing-store.js";

describe("Bot Pairing Security & Authorization Store", () => {
  let tempDir: string;
  let testStorePath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-pairing-test-"));
    testStorePath = path.join(tempDir, "pairing.json");
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it("resolves default and custom pairing.json paths", () => {
    expect(resolvePairingStorePath(testStorePath)).toBe(testStorePath);
    const defaultPath = resolvePairingStorePath();
    expect(defaultPath).toMatch(/pairing[/\\]pairing\.json$/);
  });

  it("generates COREBLOW-XXXX code for unapproved user and protects access", () => {
    const res = requestOrCheckPairing(
      {
        platform: "telegram",
        externalUserId: "user_tg_1234",
        displayName: "Sovereign Operator",
      },
      testStorePath,
    );

    expect(res.authorized).toBe(false);
    if (!res.authorized) {
      expect(res.code).toMatch(/^COREBLOW-[A-Z0-9]{4}$/);
      expect(res.message).toContain(res.code);
      expect(res.message).toContain("Approve it in CoreBlow Desktop -> Pairing.");
    }

    const state = listPairingState(testStorePath);
    expect(state.pending.length).toBe(1);
    expect(state.approved.length).toBe(0);
    expect(state.pending[0].externalUserId).toBe("user_tg_1234");
  });

  it("approves pending pairing code and grants authorized status", () => {
    const req = requestOrCheckPairing(
      { platform: "discord", externalUserId: "discord_user_99" },
      testStorePath,
    );
    expect(req.authorized).toBe(false);
    const code = !req.authorized ? req.code : "";

    // Approve via code
    const approved = approvePairing(code, testStorePath);
    expect(approved).toBe(true);

    const state = listPairingState(testStorePath);
    expect(state.pending.length).toBe(0);
    expect(state.approved.length).toBe(1);
    expect(state.approved[0].externalUserId).toBe("discord_user_99");

    // Subsequent check is immediately authorized
    const checkAgain = requestOrCheckPairing(
      { platform: "discord", externalUserId: "discord_user_99" },
      testStorePath,
    );
    expect(checkAgain.authorized).toBe(true);
  });

  it("revokes approved pairing cleanly", () => {
    const req = requestOrCheckPairing(
      { platform: "slack", externalUserId: "slack_user_42" },
      testStorePath,
    );
    if (!req.authorized) {
      approvePairing(req.code, testStorePath);
    }

    expect(listPairingState(testStorePath).approved.length).toBe(1);

    const revoked = revokePairing("slack_user_42", testStorePath);
    expect(revoked).toBe(true);
    expect(listPairingState(testStorePath).approved.length).toBe(0);

    // After revoking, user must pair again
    const check = requestOrCheckPairing(
      { platform: "slack", externalUserId: "slack_user_42" },
      testStorePath,
    );
    expect(check.authorized).toBe(false);
  });

  it("ensures unique pairing codes across multiple requests", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const res = requestOrCheckPairing(
        { platform: "telegram", externalUserId: `user_${i}` },
        testStorePath,
      );
      if (!res.authorized) {
        expect(codes.has(res.code)).toBe(false);
        codes.add(res.code);
      }
    }
    expect(codes.size).toBe(20);
  });
});
