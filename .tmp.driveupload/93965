/**
 * Phase 25 — Test 11: Gateway Server Infrastructure
 * Tests server constants, utils, channels, WS logging, config reload, etc.
 */
import { describe, it, expect } from "vitest";
import { MAX_BUFFERED_BYTES, MAX_MESSAGE_SIZE, HEARTBEAT_INTERVAL_MS } from "../../src/gateway/server-constants.js";
import { resolveGatewayPort, formatUptime } from "../../src/gateway/server-utils.js";
import { extractConnectionDetails } from "../../src/gateway/connection-details.js";
import { createChannelManager } from "../../src/gateway/server-channels.js";
import { logWs, shouldLogWs, formatForLog, summarizeAgentEventForWsLog } from "../../src/gateway/ws-log.js";
import { getMemoryStatus } from "../../src/gateway/server-startup-memory.js";
import { NodeSubscriptionManager } from "../../src/gateway/server-node-subscriptions.js";
import { enqueueNodePendingWork, drainNodePendingWork } from "../../src/gateway/node-pending-work.js";
import { abortChatRun } from "../../src/gateway/chat-abort.js";

describe("GW Server Infrastructure — Full Integration", () => {

    // ── Server Constants ──
    describe("Server Constants", () => {
        it("MAX_BUFFERED_BYTES is 5MB", () => expect(MAX_BUFFERED_BYTES).toBe(5 * 1024 * 1024));
        it("MAX_MESSAGE_SIZE is 10MB", () => expect(MAX_MESSAGE_SIZE).toBe(10 * 1024 * 1024));
        it("HEARTBEAT_INTERVAL_MS is 30s", () => expect(HEARTBEAT_INTERVAL_MS).toBe(30000));
    });

    // ── Server Utils ──
    describe("Server Utils", () => {
        it("resolveGatewayPort returns valid port from config", () => {
            expect(resolveGatewayPort(8080)).toBe(8080);
        });
        it("resolveGatewayPort defaults to 3000", () => {
            expect(resolveGatewayPort(undefined)).toBe(3000);
        });
        it("resolveGatewayPort rejects invalid", () => {
            expect(resolveGatewayPort(-1)).toBe(3000);
            expect(resolveGatewayPort(99999)).toBe(3000);
        });
        it("formatUptime formats seconds", () => expect(formatUptime(5000)).toBe("5s"));
        it("formatUptime formats minutes", () => expect(formatUptime(125000)).toBe("2m 5s"));
        it("formatUptime formats hours", () => expect(formatUptime(3700000)).toBe("1h 1m"));
        it("formatUptime formats days", () => expect(formatUptime(90000000)).toBe("1d 1h"));
    });

    // ── Connection Details ──
    describe("Connection Details", () => {
        it("extracts IP and user-agent from mock request", () => {
            const details = extractConnectionDetails({
                socket: { remoteAddress: "192.168.1.1" },
                headers: { "user-agent": "TestAgent/1.0", "x-client-id": "client-abc" },
            });
            expect(details.ip).toBe("192.168.1.1");
            expect(details.userAgent).toBe("TestAgent/1.0");
            expect(details.clientId).toBe("client-abc");
        });

        it("handles missing headers gracefully", () => {
            const details = extractConnectionDetails({ headers: {} });
            expect(details.ip).toBe("unknown");
            expect(details.userAgent).toBe("unknown");
        });
    });

    // ── Channel Manager ──
    describe("Channel Manager", () => {
        it("creates manager with start/stop API", async () => {
            const log = { info: () => {}, warn: () => {} };
            const mgr = createChannelManager({ log, channelLogs: {} });
            expect(typeof mgr.startChannel).toBe("function");
            expect(typeof mgr.stopChannel).toBe("function");
            expect(typeof mgr.getRuntimeSnapshot).toBe("function");

            await mgr.startChannel("discord", "acc-1");
            const snap = mgr.getRuntimeSnapshot();
            expect(snap.channels["discord:acc-1"]).toBeDefined();

            await mgr.stopChannel("discord", "acc-1");
            const snap2 = mgr.getRuntimeSnapshot();
            expect(snap2.channels["discord:acc-1"]).toBeUndefined();
        });
    });

    // ── WS Logging ──
    describe("WS Logging", () => {
        it("shouldLogWs returns boolean", () => {
            expect(typeof shouldLogWs()).toBe("boolean");
        });
        it("formatForLog handles Error objects", () => {
            expect(formatForLog(new Error("test"))).toBe("test");
        });
        it("formatForLog handles strings", () => {
            expect(formatForLog("raw")).toBe("raw");
        });
        it("summarizeAgentEventForWsLog handles null", () => {
            expect(summarizeAgentEventForWsLog(null)).toBe("unknown event");
        });
        it("summarizeAgentEventForWsLog returns type", () => {
            expect(summarizeAgentEventForWsLog({ type: "chat.delta" })).toBe("chat.delta");
        });
    });

    // ── Startup Memory ──
    describe("Startup Memory", () => {
        it("getMemoryStatus returns valid fields", () => {
            const mem = getMemoryStatus();
            expect(mem.rssMB).toBeGreaterThan(0);
            expect(mem.heapTotalMB).toBeGreaterThan(0);
            expect(typeof mem.systemFreeMB).toBe("number");
        });
    });

    // ── Node Subscriptions ──
    describe("Node Subscriptions", () => {
        it("subscribe + getSubscribers works", () => {
            const mgr = new NodeSubscriptionManager();
            mgr.subscribe("node-1", "session-A");
            mgr.subscribe("node-2", "session-A");
            expect(mgr.getSubscribers("session-A")).toHaveLength(2);
        });

        it("unsubscribe works", () => {
            const mgr = new NodeSubscriptionManager();
            mgr.subscribe("node-1", "session-A");
            mgr.unsubscribe("node-1", "session-A");
            expect(mgr.getSubscribers("session-A")).toHaveLength(0);
        });

        it("handleNodeDisconnect cleans all subscriptions", () => {
            const mgr = new NodeSubscriptionManager();
            mgr.subscribe("node-1", "s1");
            mgr.subscribe("node-1", "s2");
            mgr.handleNodeDisconnect("node-1");
            expect(mgr.getSubscribers("s1")).toHaveLength(0);
            expect(mgr.getSubscribers("s2")).toHaveLength(0);
        });
    });

    // ── Node Pending Work ──
    describe("Node Pending Work", () => {
        it("enqueue + drain lifecycle", () => {
            const result = enqueueNodePendingWork({ nodeId: "n1", type: "sync" });
            expect(result.item.id).toBeDefined();
            expect(result.item.type).toBe("sync");

            const drained = drainNodePendingWork("n1");
            expect(drained.items.length).toBeGreaterThan(0);

            // Should be empty after drain
            const drained2 = drainNodePendingWork("n1");
            expect(drained2.items).toHaveLength(0);
        });
    });

    // ── Chat Abort ──
    describe("Chat Abort", () => {
        it("abortChatRun returns false for missing session", () => {
            const state = new Map();
            expect(abortChatRun(state, "nonexistent")).toBe(false);
        });

        it("abortChatRun calls abort on registered controller", () => {
            const state = new Map();
            const ac = new AbortController();
            state.set("session-1", ac);
            expect(abortChatRun(state, "session-1")).toBe(true);
            expect(ac.signal.aborted).toBe(true);
        });
    });
});
