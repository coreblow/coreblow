import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { appendAssistantMessageToSessionTranscript } from "../config/sessions/transcript.js";
import { emitSessionLifecycleEvent } from "../sessions/session-lifecycle-events.js";
import {
  connectOk,
  createGatewaySuiteHarness,
  installGatewayTestHooks,
  onceMessage,
  rpcReq,
  writeSessionStore,
} from "./test-helpers.server.js";
import { testState } from "./test-helpers.mocks.js";

installGatewayTestHooks();

const cleanupDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    cleanupDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

async function createSessionStoreFile(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "coreblow-session-message-"));
  cleanupDirs.push(dir);
  const storePath = path.join(dir, "sessions.json");
  testState.sessionStorePath = storePath;
  return storePath;
}

async function expectNoMessageWithin(params: {
  action?: () => Promise<void> | void;
  watch: () => Promise<unknown>;
  timeoutMs?: number;
}): Promise<void> {
  const timeoutMs = params.timeoutMs ?? 300;
  vi.useFakeTimers();
  try {
    const outcome = params
      .watch()
      .then(() => "received")
      .catch(() => "timeout");
    await params.action?.();
    await vi.advanceTimersByTimeAsync(timeoutMs);
    await expect(outcome).resolves.toBe("timeout");
  } finally {
    vi.useRealTimers();
  }
}

describe("session.message websocket events", () => {
  test("includes spawned session ownership metadata on lifecycle sessions.changed events", async () => {
    const previousMinimalGateway = process.env.COREBLOW_TEST_MINIMAL_GATEWAY;
    delete process.env.COREBLOW_TEST_MINIMAL_GATEWAY;
    try {
      const storePath = await createSessionStoreFile();
      await writeSessionStore({
        entries: {
          child: {
            sessionId: "sess-child",
            updatedAt: Date.now(),
            spawnedBy: "agent:main:parent",
            spawnedWorkspaceDir: "/tmp/subagent-workspace",
            forkedFromParent: true,
            spawnDepth: 2,
            subagentRole: "orchestrator",
            subagentControlScope: "children",
            displayName: "Ops Child",
          },
        },
        storePath,
      });

      const harness = await createGatewaySuiteHarness();
      try {
        const ws = await harness.openWs();
        try {
          await connectOk(ws, { scopes: ["operator.read"] });
          await rpcReq(ws, "sessions.subscribe");
          const changedEvent = onceMessage(
            ws,
            (message) =>
              message.type === "event" &&
              message.event === "sessions.changed" &&
              (message.payload as { sessionKey?: string } | undefined)?.sessionKey ===
                "agent:main:child",
          );

          emitSessionLifecycleEvent({
            sessionKey: "agent:main:child",
            reason: "reactivated",
          });

          const event = await changedEvent;
          expect(event.payload).toMatchObject({
            sessionKey: "agent:main:child",
            reason: "reactivated",
            spawnedBy: "agent:main:parent",
            spawnedWorkspaceDir: "/tmp/subagent-workspace",
            forkedFromParent: true,
            spawnDepth: 2,
            subagentRole: "orchestrator",
            subagentControlScope: "children",
            displayName: "Ops Child",
          });
        } finally {
          ws.close();
        }
      } finally {
        await harness.close();
      }
    } finally {
      if (previousMinimalGateway === undefined) {
        delete process.env.COREBLOW_TEST_MINIMAL_GATEWAY;
      } else {
        process.env.COREBLOW_TEST_MINIMAL_GATEWAY = previousMinimalGateway;
      }
    }
  });

  test("only sends transcript events to subscribed operator clients", async () => {
    const storePath = await createSessionStoreFile();
    await writeSessionStore({
      entries: {
        main: {
          sessionId: "sess-main",
          updatedAt: Date.now(),
        },
      },
      storePath,
    });

    const harness = await createGatewaySuiteHarness();
    try {
      const subscribedWs = await harness.openWs();
      const unsubscribedWs = await harness.openWs();
      const nodeWs = await harness.openWs();
      try {
        await connectOk(subscribedWs, { scopes: ["operator.read"] });
        await rpcReq(subscribedWs, "sessions.subscribe");
        await connectOk(unsubscribedWs, { scopes: ["operator.read"] });
        await connectOk(nodeWs, { role: "node", scopes: [] });

        const subscribedEvent = onceMessage(
          subscribedWs,
          (message) =>
            message.type === "event" &&
            message.event === "session.message" &&
            (message.payload as { sessionKey?: string } | undefined)?.sessionKey ===
              "agent:main:main",
        );
        const appended = await appendAssistantMessageToSessionTranscript({
          sessionKey: "agent:main:main",
          text: "subscribed only",
          storePath,
        });
        expect(appended.ok).toBe(true);
        await expect(subscribedEvent).resolves.toBeTruthy();
        await expectNoMessageWithin({
          watch: () =>
            onceMessage(
              unsubscribedWs,
              (message) => message.type === "event" && message.event === "session.message",
              300,
            ),
        });
        await expectNoMessageWithin({
          watch: () =>
            onceMessage(
              nodeWs,
              (message) => message.type === "event" && message.event === "session.message",
              300,
            ),
        });
      } finally {
        subscribedWs.close();
        unsubscribedWs.close();
        nodeWs.close();
      }
    } finally {
      await harness.close();
    }
  });

  test("broadcasts appended transcript messages with the session key", async () => {
    const storePath = await createSessionStoreFile();
    await writeSessionStore({
      entries: {
        main: {
          sessionId: "sess-main",
          updatedAt: Date.now(),
        },
      },
      storePath,
    });

    const harness = await createGatewaySuiteHarness();
    try {
      const ws = await harness.openWs();
      try {
        await connectOk(ws, { scopes: ["operator.read"] });
        await rpcReq(ws, "sessions.subscribe");

        const appendPromise = appendAssistantMessageToSessionTranscript({
          sessionKey: "agent:main:main",
          text: "live websocket message",
          storePath,
        });
        const eventPromise = onceMessage(
          ws,
          (message) =>
            message.type === "event" &&
            message.event === "session.message" &&
            (message.payload as { sessionKey?: string } | undefined)?.sessionKey ===
              "agent:main:main",
        );

        const [appended, event] = await Promise.all([appendPromise, eventPromise]);
        expect(appended.ok).toBe(true);
        if (!appended.ok) {
          throw new Error(`append failed: ${appended.reason}`);
        }
        expect(
          (event.payload as { message?: { content?: Array<{ text?: string }> } }).message
            ?.content?.[0]?.text,
        ).toBe("live websocket message");
        expect((event.payload as { messageSeq?: number }).messageSeq).toBe(1);
        expect(
          (
            event.payload as {
              message?: { __coreblow?: { id?: string; seq?: number } };
            }
          ).message?.__coreblow,
        ).toMatchObject({
          id: appended.ok ? appended.messageId : undefined,
          seq: 1,
        });
      } finally {
        ws.close();
      }
    } finally {
      await harness.close();
    }
  });
});
