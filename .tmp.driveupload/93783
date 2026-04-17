import { describe, it, expect, beforeEach } from "vitest";
import {
  registerInternalHook,
  unregisterInternalHook,
  clearInternalHooks,
  getRegisteredEventKeys,
  hasInternalHookListeners,
  triggerInternalHook,
  createInternalHookEvent,
  isAgentBootstrapEvent,
  isGatewayStartupEvent,
  isMessageReceivedEvent,
  isMessageSentEvent,
  isMessageTranscribedEvent,
  isSessionPatchEvent,
  type InternalHookHandler,
} from "../../src/hooks/internal-hooks.js";

describe("internal-hooks", () => {
  beforeEach(() => {
    clearInternalHooks();
  });

  describe("register / unregister / trigger", () => {
    it("registers and triggers a handler", async () => {
      let called = false;
      registerInternalHook("command:new", async () => { called = true; });
      await triggerInternalHook(createInternalHookEvent("command", "new", "session-1"));
      expect(called).toBe(true);
    });

    it("also triggers type-level handlers", async () => {
      let called = false;
      registerInternalHook("command", async () => { called = true; });
      await triggerInternalHook(createInternalHookEvent("command", "new", "session-1"));
      expect(called).toBe(true);
    });

    it("unregisters a handler", async () => {
      let count = 0;
      const handler: InternalHookHandler = async () => { count++; };
      registerInternalHook("command:new", handler);
      await triggerInternalHook(createInternalHookEvent("command", "new", "s1"));
      expect(count).toBe(1);

      unregisterInternalHook("command:new", handler);
      await triggerInternalHook(createInternalHookEvent("command", "new", "s1"));
      expect(count).toBe(1); // not called again
    });

    it("clearInternalHooks removes everything", () => {
      registerInternalHook("a", async () => {});
      registerInternalHook("b", async () => {});
      clearInternalHooks();
      expect(getRegisteredEventKeys()).toEqual([]);
    });

    it("hasInternalHookListeners detects presence", () => {
      expect(hasInternalHookListeners("command", "new")).toBe(false);
      registerInternalHook("command:new", async () => {});
      expect(hasInternalHookListeners("command", "new")).toBe(true);
    });

    it("errors in handlers don't block others", async () => {
      const results: string[] = [];
      registerInternalHook("command:new", async () => { throw new Error("fail"); });
      registerInternalHook("command:new", async () => { results.push("ok"); });
      await triggerInternalHook(createInternalHookEvent("command", "new", "s1"));
      expect(results).toEqual(["ok"]);
    });
  });

  describe("createInternalHookEvent", () => {
    it("creates event with correct fields", () => {
      const event = createInternalHookEvent("message", "received", "sess-1", { from: "user" });
      expect(event.type).toBe("message");
      expect(event.action).toBe("received");
      expect(event.sessionKey).toBe("sess-1");
      expect(event.context.from).toBe("user");
      expect(event.timestamp).toBeInstanceOf(Date);
      expect(event.messages).toEqual([]);
    });
  });

  describe("type guards", () => {
    it("isAgentBootstrapEvent validates correctly", () => {
      const valid = createInternalHookEvent("agent", "bootstrap", "s1", {
        workspaceDir: "/test",
        bootstrapFiles: [],
      });
      expect(isAgentBootstrapEvent(valid)).toBe(true);

      const invalid = createInternalHookEvent("agent", "bootstrap", "s1", {});
      expect(isAgentBootstrapEvent(invalid)).toBe(false);
    });

    it("isGatewayStartupEvent validates correctly", () => {
      const valid = createInternalHookEvent("gateway", "startup", "s1", {});
      expect(isGatewayStartupEvent(valid)).toBe(true);

      const invalid = createInternalHookEvent("command", "new", "s1", {});
      expect(isGatewayStartupEvent(invalid)).toBe(false);
    });

    it("isMessageReceivedEvent validates correctly", () => {
      const valid = createInternalHookEvent("message", "received", "s1", {
        from: "user123",
        channelId: "telegram",
      });
      expect(isMessageReceivedEvent(valid)).toBe(true);

      const invalid = createInternalHookEvent("message", "received", "s1", { from: "user123" });
      expect(isMessageReceivedEvent(invalid)).toBe(false);
    });

    it("isMessageSentEvent validates correctly", () => {
      const valid = createInternalHookEvent("message", "sent", "s1", {
        to: "user",
        channelId: "telegram",
        success: true,
      });
      expect(isMessageSentEvent(valid)).toBe(true);
    });

    it("isMessageTranscribedEvent validates correctly", () => {
      const valid = createInternalHookEvent("message", "transcribed", "s1", {
        transcript: "hello",
        channelId: "telegram",
      });
      expect(isMessageTranscribedEvent(valid)).toBe(true);
    });

    it("isSessionPatchEvent validates correctly", () => {
      const valid = createInternalHookEvent("session", "patch", "s1", {
        patch: { name: "new" },
        sessionEntry: { id: "1" },
      });
      expect(isSessionPatchEvent(valid)).toBe(true);
    });
  });
});
