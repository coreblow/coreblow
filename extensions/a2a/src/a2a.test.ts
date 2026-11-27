import http from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import {
  A2AClient,
  A2ATaskStore,
  assertA2aPolicyAllowed,
  assertSafeA2aUrl,
  buildAgentCard,
  createA2aHttpHandler,
  redactA2aOutboundText,
} from "../index.js";

describe("External Agent-to-Agent (A2A) Protocol Extension", () => {
  const servers: http.Server[] = [];

  afterEach(async () => {
    for (const srv of servers.splice(0)) {
      await new Promise<void>((resolve) => srv.close(() => resolve()));
    }
  });

  async function startTestA2aServer(options?: {
    authorize?: (req: http.IncomingMessage) => { ok: true } | { ok: false; statusCode?: number; reason: string };
    state?: "working" | "completed";
  }): Promise<{ baseUrl: string; receivedTexts: string[] }> {
    const receivedTexts: string[] = [];
    const taskStore = new A2ATaskStore();
    let baseUrl = "";

    const handler = createA2aHttpHandler({
      agentCard: buildAgentCard({
        name: "CoreBlow A2A Test Agent",
        version: "2.7.0",
        url: "https://agent.example.invalid/a2a",
      }),
      taskStore,
      authorizeRequest: options?.authorize,
      onTaskSend: ({ message }) => {
        receivedTexts.push(message.parts.map((p) => p.text).join("\n"));
        return {
          state: options?.state ?? "working",
          replyText: "Task acknowledged",
        };
      },
    });

    const server = http.createServer(async (req, res) => {
      const handled = await handler(req, res);
      if (!handled) {
        res.statusCode = 404;
        res.end("Not found");
      }
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address() as { port: number };
    baseUrl = `http://127.0.0.1:${addr.port}`;
    return { baseUrl, receivedTexts };
  }

  it("supports /.well-known/agent.json discovery and full tasks/send -> get -> cancel lifecycle", async () => {
    const { baseUrl, receivedTexts } = await startTestA2aServer({ state: "working" });
    const client = new A2AClient({
      policy: { enabled: true, allow: ["partner-agent"] },
      allowPrivateNetworkForTest: true,
    });

    const card = await client.discoverAgentCard(baseUrl, "partner-agent");
    expect(card.name).toBe("CoreBlow A2A Test Agent");
    expect(card.skills.length).toBeGreaterThan(0);

    const sent = await client.sendTask({
      endpointUrl: `${baseUrl}/a2a`,
      targetAgentId: "partner-agent",
      taskId: "task-101",
      message: {
        role: "user",
        parts: [{ type: "text", text: "Run check with key sk-ant-api03-1234567890abcdef" }],
      },
    });
    expect(sent.id).toBe("task-101");
    expect(sent.status.state).toBe("working");
    expect(receivedTexts[0]).toContain("[REDACTED]");
    expect(receivedTexts[0]).not.toContain("1234567890abcdef");

    const fetched = await client.getTask({
      endpointUrl: `${baseUrl}/a2a`,
      targetAgentId: "partner-agent",
      taskId: "task-101",
    });
    expect(fetched.status.state).toBe("working");

    const canceled = await client.cancelTask({
      endpointUrl: `${baseUrl}/a2a`,
      targetAgentId: "partner-agent",
      taskId: "task-101",
    });
    expect(canceled.status.state).toBe("canceled");
  });

  it("enforces agentToAgent policy and rejects unauthorized inbound requests", async () => {
    expect(() => assertA2aPolicyAllowed({ enabled: false }, "partner-agent")).toThrow(
      /A2A_POLICY_DISABLED/,
    );
    expect(() =>
      assertA2aPolicyAllowed({ enabled: true, allow: ["allowed-only"] }, "other-agent"),
    ).toThrow(/A2A_POLICY_TARGET_DENIED/);

    const { baseUrl } = await startTestA2aServer({
      authorize: () => ({ ok: false, statusCode: 403, reason: "rbac denied" }),
    });
    const client = new A2AClient({
      policy: { enabled: true, allow: ["*"] },
      allowPrivateNetworkForTest: true,
    });
    await expect(
      client.getTask({
        endpointUrl: `${baseUrl}/a2a`,
        targetAgentId: "partner-agent",
        taskId: "task-x",
      }),
    ).rejects.toThrow(/-32003: rbac denied/);
  });

  it("blocks SSRF private/metadata URLs and redacts secrets", () => {
    for (const badUrl of [
      "http://169.254.169.254/latest/meta-data/",
      "https://127.0.0.1:18789/a2a",
      "https://10.0.0.5/a2a",
      "https://192.168.1.10/a2a",
      "https://localhost/a2a",
      "https://user:secret@example.com/a2a",
      "http://example.com/a2a",
    ]) {
      expect(() => assertSafeA2aUrl(badUrl)).toThrow(/SSRF_BLOCKED/);
    }

    expect(() => assertSafeA2aUrl("https://agents.example.com/a2a")).not.toThrow();
    expect(redactA2aOutboundText("token ghp_1234567890abcdefghijklmnop")).toBe(
      "token [REDACTED]",
    );
  });
});
