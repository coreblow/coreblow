import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { CoreBlowConfig } from "../config/config.js";
import type { SessionEntry } from "../config/sessions.js";
import {
  resolveApprovalRequestOriginTarget,
  resolveApprovalRequestSessionConversation,
  resolveExecApprovalSessionTarget,
} from "./exec-approval-session-target.js";
import type { ExecApprovalRequest } from "./exec-approvals.js";
import type { PluginApprovalRequest } from "./plugin-approvals.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

const baseRequest: ExecApprovalRequest = {
  id: "req-1",
  request: {
    command: "echo hello",
    sessionKey: "agent:main:main",
  },
  createdAtMs: 1000,
  expiresAtMs: 6000,
};

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-exec-approval-session-target-"));
  tempDirs.push(dir);
  return dir;
}

function writeStoreFile(
  storePath: string,
  entries: Record<string, Partial<SessionEntry>>,
): CoreBlowConfig {
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(entries), "utf-8");
  return {
    session: { store: storePath },
  } as CoreBlowConfig;
}

function expectResolvedSessionTarget(
  cfg: CoreBlowConfig,
  request: ExecApprovalRequest,
): ReturnType<typeof resolveExecApprovalSessionTarget> {
  return resolveExecApprovalSessionTarget({ cfg, request });
}

function buildRequest(
  overrides: Partial<ExecApprovalRequest["request"]> = {},
): ExecApprovalRequest {
  return {
    ...baseRequest,
    request: {
      ...baseRequest.request,
      ...overrides,
    },
  };
}

function buildPluginRequest(
  overrides: Partial<PluginApprovalRequest["request"]> = {},
): PluginApprovalRequest {
  return {
    id: "plugin:req-1",
    request: {
      title: "Plugin approval",
      description: "Allow plugin action",
      sessionKey: "agent:main:main",
      ...overrides,
    },
    createdAtMs: 1000,
    expiresAtMs: 6000,
  };
}

function resolveSlackPluginOriginTarget(params: { cfg: CoreBlowConfig; turnSourceTo: string }) {
  return resolveApprovalRequestOriginTarget({
    cfg: params.cfg,
    request: buildPluginRequest({
      turnSourceChannel: "slack",
      turnSourceTo: params.turnSourceTo,
    }),
    channel: "slack",
    accountId: "default",
    resolveTurnSourceTarget: (request) =>
      request.request.turnSourceChannel === "slack" && request.request.turnSourceTo
        ? { to: request.request.turnSourceTo }
        : null,
    resolveSessionTarget: (sessionTarget) => ({ to: sessionTarget.to }),
    targetsMatch: (a, b) => a.to === b.to,
  });
}

describe("exec approval session target", () => {
  type PlaceholderStoreCase = {
    name: string;
    relativeStoreDir: string;
    entries: Record<string, Partial<SessionEntry>>;
    request: ExecApprovalRequest;
    expected: ReturnType<typeof resolveExecApprovalSessionTarget>;
  };

  it("returns null for blank session keys, missing entries, and unresolved targets", () => {
    const tmpDir = createTempDir();
    const storePath = path.join(tmpDir, "sessions.json");
    const cfg = writeStoreFile(storePath, {
      "agent:main:main": {
        sessionId: "main",
        updatedAt: 1,
        lastChannel: "slack",
      },
    });

    const requests = [
      buildRequest({ sessionKey: "  " }),
      buildRequest({ sessionKey: "agent:main:missing" }),
      baseRequest,
    ] satisfies ExecApprovalRequest[];

    for (const request of requests) {
      expect(expectResolvedSessionTarget(cfg, request)).toBeNull();
    }
  });

  it("prefers turn-source routing over stale session delivery state", () => {
    const tmpDir = createTempDir();
    const storePath = path.join(tmpDir, "sessions.json");
    const cfg = writeStoreFile(storePath, {
      "agent:main:main": {
        sessionId: "main",
        updatedAt: 1,
        lastChannel: "slack",
        lastTo: "U1",
      },
    });

    expect(
      resolveExecApprovalSessionTarget({
        cfg,
        request: baseRequest,
        turnSourceChannel: " whatsapp ",
        turnSourceTo: " +15555550123 ",
        turnSourceAccountId: " work ",
        turnSourceThreadId: "1739201675.123",
      }),
    ).toEqual({
      channel: "whatsapp",
      to: "+15555550123",
      accountId: "work",
      threadId: "1739201675.123",
    });
  });

  it.each([
    {
      name: "uses the parsed session-key agent id for store-path placeholders",
      relativeStoreDir: "helper",
      entries: {
        "agent:helper:main": {
          sessionId: "main",
          updatedAt: 1,
          lastChannel: "discord",
          lastTo: "channel:123",
          lastAccountId: " Work ",
          lastThreadId: "55",
        },
      } as Record<string, Partial<SessionEntry>>,
      request: buildRequest({ sessionKey: "agent:helper:main" }),
      expected: {
        channel: "discord",
        to: "channel:123",
        accountId: "work",
        threadId: "55",
      },
    },
    {
      name: "falls back to request agent id for legacy session keys",
      relativeStoreDir: "worker-1",
      entries: {
        "legacy-main": {
          sessionId: "legacy-main",
          updatedAt: 1,
          lastChannel: "telegram",
          lastTo: "-100123",
          lastThreadId: 77,
        },
      } as Record<string, Partial<SessionEntry>>,
      request: buildRequest({
        agentId: "Worker 1",
        sessionKey: "legacy-main",
      }),
      expected: {
        channel: "telegram",
        to: "-100123",
        accountId: undefined,
        threadId: 77,
      },
    },
  ] satisfies PlaceholderStoreCase[])(
    "$name",
    ({ relativeStoreDir, entries, request, expected }) => {
      const tmpDir = createTempDir();
      const cfg = writeStoreFile(path.join(tmpDir, relativeStoreDir, "sessions.json"), entries);
      cfg.session = { store: path.join(tmpDir, "{agentId}", "sessions.json") };
      expect(expectResolvedSessionTarget(cfg, request)).toEqual(expected);
    },
  );

  it("preserves string thread ids from the session store", () => {
    const tmpDir = createTempDir();
    const storePath = path.join(tmpDir, "sessions.json");
    const cfg = writeStoreFile(storePath, {
      "agent:main:main": {
        sessionId: "main",
        updatedAt: 1,
        lastChannel: "discord",
        lastTo: "channel:123",
        lastAccountId: " Work ",
        lastThreadId: "777888999111222333",
      },
    });

    expect(expectResolvedSessionTarget(cfg, baseRequest)).toEqual({
      channel: "discord",
      to: "channel:123",
      accountId: "work",
      threadId: "777888999111222333",
    });
  });

  it("parses channel-scoped session conversation fallbacks for approval requests", () => {
    const request = buildPluginRequest({
      sessionKey: "agent:main:matrix:channel:!Ops:Example.org:thread:$root",
    });

    expect(
      resolveApprovalRequestSessionConversation({
        request,
        channel: "matrix",
      }),
    ).toEqual({
      channel: "matrix",
      kind: "channel",
      id: "!Ops:Example.org",
      rawId: "!Ops:Example.org:thread:$root",
      threadId: "$root",
      baseSessionKey: "agent:main:matrix:channel:!Ops:Example.org",
      baseConversationId: "!Ops:Example.org",
      parentConversationCandidates: ["!Ops:Example.org"],
    });
  });

  it("ignores session conversation fallbacks for other channels", () => {
    const request = buildPluginRequest({
      sessionKey: "agent:main:matrix:channel:!ops:example.org",
    });

    expect(
      resolveApprovalRequestSessionConversation({
        request,
        channel: "slack",
      }),
    ).toBeNull();
  });

  it("reconciles plugin-request turn source and session origin targets through the shared helper", () => {
    const tmpDir = createTempDir();
    const storePath = path.join(tmpDir, "sessions.json");
    const cfg = writeStoreFile(storePath, {
      "agent:main:main": {
        sessionId: "main",
        updatedAt: 1,
        lastChannel: "slack",
        lastTo: "channel:C123",
      },
    });

    expect(
      resolveSlackPluginOriginTarget({
        cfg,
        turnSourceTo: "channel:C123",
      }),
    ).toEqual({ to: "channel:C123" });
  });

  it("returns null when explicit turn source conflicts with the session-bound origin target", () => {
    const tmpDir = createTempDir();
    const storePath = path.join(tmpDir, "sessions.json");
    const cfg = writeStoreFile(storePath, {
      "agent:main:main": {
        sessionId: "main",
        updatedAt: 1,
        lastChannel: "slack",
        lastTo: "channel:C123",
      },
    });

    expect(
      resolveSlackPluginOriginTarget({
        cfg,
        turnSourceTo: "channel:C999",
      }),
    ).toBeNull();
  });

  it("falls back to a legacy origin target when no turn-source or session target exists", () => {
    const target = resolveApprovalRequestOriginTarget({
      cfg: {} as CoreBlowConfig,
      request: buildPluginRequest({ sessionKey: "agent:main:missing" }),
      channel: "discord",
      accountId: "default",
      resolveTurnSourceTarget: () => null,
      resolveSessionTarget: () => ({ to: "unused" }),
      targetsMatch: (a, b) => a.to === b.to,
      resolveFallbackTarget: () => ({ to: "channel:legacy" }),
    });

    expect(target).toEqual({ to: "channel:legacy" });
  });
});
