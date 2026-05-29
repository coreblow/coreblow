import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { CoreBlowConfig } from "../config/config.js";
import type { SessionEntry } from "../config/sessions/types.js";
import type { ExecApprovalRequest } from "./exec-approvals.js";
import {
  doesApprovalRequestMatchChannelAccount,
  resolveApprovalRequestAccountId,
  resolveApprovalRequestChannelAccountId,
  resolvePersistedApprovalRequestSessionEntry,
} from "./approval-request-account-binding.js";

const tempDirs: string[] = [];

function createTempStore(entries: Record<string, Partial<SessionEntry>>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-approval-account-binding-"));
  tempDirs.push(dir);
  const storePath = path.join(dir, "sessions.json");
  const store: Record<string, SessionEntry> = {};
  for (const [key, entry] of Object.entries(entries)) {
    store[key] = {
      sessionId: key,
      updatedAt: 1,
      ...entry,
    };
  }
  fs.writeFileSync(storePath, JSON.stringify(store), "utf8");
  return {
    cfg: { session: { store: storePath } } as CoreBlowConfig,
    storePath,
  };
}

function execRequest(overrides: Partial<ExecApprovalRequest["request"]> = {}): ExecApprovalRequest {
  return {
    id: "approval-id",
    createdAtMs: 1,
    expiresAtMs: 2,
    request: {
      command: "ls",
      ...overrides,
    },
  };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("approval request account binding", () => {
  it("loads the persisted session entry for the request session key", () => {
    const sessionKey = "agent:ops:slack:direct:U1";
    const { cfg } = createTempStore({
      [sessionKey]: {
        origin: { provider: "slack", accountId: "work" },
      },
    });

    expect(
      resolvePersistedApprovalRequestSessionEntry({
        cfg,
        request: execRequest({ sessionKey }),
      })?.entry.origin,
    ).toEqual({ provider: "slack", accountId: "work" });
  });

  it("prefers explicit turn-source account ids when the expected channel matches", () => {
    const { cfg } = createTempStore({});

    expect(
      resolveApprovalRequestAccountId({
        cfg,
        channel: "slack",
        request: execRequest({
          turnSourceChannel: "slack",
          turnSourceAccountId: " Work ",
        }),
      }),
    ).toBe("work");
  });

  it("rejects explicit turn-source channel mismatches", () => {
    const { cfg } = createTempStore({});

    expect(
      resolveApprovalRequestAccountId({
        cfg,
        channel: "discord",
        request: execRequest({
          turnSourceChannel: "slack",
          turnSourceAccountId: "work",
        }),
      }),
    ).toBeNull();
  });

  it("falls back to the persisted session account binding", () => {
    const sessionKey = "agent:ops:slack:direct:U1";
    const { cfg } = createTempStore({
      [sessionKey]: {
        origin: { provider: "slack", accountId: "work" },
      },
    });

    const request = execRequest({ sessionKey });
    expect(resolveApprovalRequestAccountId({ cfg, channel: "slack", request })).toBe("work");
    expect(resolveApprovalRequestChannelAccountId({ cfg, channel: "slack", request })).toBe(
      "work",
    );
  });

  it("uses session binding for channel account fallback when turn source points elsewhere", () => {
    const sessionKey = "agent:ops:slack:direct:U1";
    const { cfg } = createTempStore({
      [sessionKey]: {
        lastChannel: "slack",
        lastAccountId: "work",
      },
    });

    expect(
      resolveApprovalRequestChannelAccountId({
        cfg,
        channel: "slack",
        request: execRequest({
          sessionKey,
          turnSourceChannel: "discord",
          turnSourceAccountId: "personal",
        }),
      }),
    ).toBe("work");
  });

  it("matches channel accounts using turn source or session bindings", () => {
    const sessionKey = "agent:ops:slack:direct:U1";
    const { cfg } = createTempStore({
      [sessionKey]: {
        lastChannel: "slack",
        lastAccountId: "work",
      },
    });

    expect(
      doesApprovalRequestMatchChannelAccount({
        cfg,
        channel: "slack",
        accountId: "work",
        request: execRequest({ sessionKey }),
      }),
    ).toBe(true);
    expect(
      doesApprovalRequestMatchChannelAccount({
        cfg,
        channel: "slack",
        accountId: "personal",
        request: execRequest({ sessionKey }),
      }),
    ).toBe(false);
  });
});
