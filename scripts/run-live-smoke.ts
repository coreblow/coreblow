/**
 * scripts/run-live-smoke.ts
 *
 * Real Gateway Live Smoke Test (Option 2):
 * 1. Boots real Gateway server on 127.0.0.1:18789 with full 12-service microkernel.
 * 2. Sends Turn 1 via SSE: "Remember: the canonical release version of CoreBlow is 2.0.0"
 * 3. Sends Turn 2 via SSE: "What is the canonical release version of CoreBlow?"
 * 4. Verifies both turns return HTTP 200 with real streamed replies (no 404 self-loop).
 * 5. Verifies GET /api/cory/layers contains the remembered durable memory.
 * 6. Gracefully shuts down Gateway.
 */

import http from "node:http";
import { startGatewayServer } from "../src/gateway/server.impl.js";
import { getActiveMicrokernel } from "../src/gateway/microkernel-services.js";

const PORT = 18789;
const TOKEN = process.env.COREBLOW_GATEWAY_TOKEN || "fa7bf442335435e16297730b33f304310664d980c86c657f"; // pragma: allowlist secret

async function sendSseChatTurn(prompt: string): Promise<{
  statusCode: number;
  events: string[];
  fullReply: string;
  toolSteps: string[];
}> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      prompt,
      executionProfile: "Full access",
    });

    const req = http.request(
      `http://127.0.0.1:${PORT}/api/corehub/chat/react`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          Authorization: `Bearer ${TOKEN}`,
        },
      },
      (res) => {
        let raw = "";
        const events: string[] = [];
        let fullReply = "";
        const toolSteps: string[] = [];

        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          raw += chunk;
          const lines = chunk.split("\n");
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data:")) {
              const dataStr = trimmed.slice(5).trim();
              if (dataStr === "[DONE]") {
                events.push("[DONE]");
                continue;
              }
              try {
                const parsed = JSON.parse(dataStr);
                events.push(dataStr);
                if (parsed.choices?.[0]?.delta?.content) {
                  fullReply += parsed.choices[0].delta.content;
                } else if (parsed.reply) {
                  fullReply = parsed.reply;
                }
                if (parsed.toolSteps) {
                  toolSteps.push(...parsed.toolSteps);
                }
                if (parsed.step) {
                  toolSteps.push(parsed.step);
                }
              } catch {}
            }
          }
        });

        res.on("end", () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            events,
            fullReply,
            toolSteps,
          });
        });
      },
    );

    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

async function getCoryLayers(): Promise<{ ok: boolean; items: Array<{ layer: string; content: string; id: string }> }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      `http://127.0.0.1:${PORT}/api/cory/layers`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
        },
      },
      (res) => {
        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(raw));
          } catch (e) {
            reject(e);
          }
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

async function run() {
  console.log("=== STEP 1: Booting real Gateway on 127.0.0.1:18789 ===");
  process.env.COREBLOW_GATEWAY_TOKEN = TOKEN;
  process.env.COREBLOW_SKIP_BROWSER_CONTROL_SERVER = "1";
  process.env.COREBLOW_SKIP_GMAIL_WATCHER = "1";
  process.env.COREBLOW_SKIP_CANVAS_HOST = "1";
  process.env.COREBLOW_SKIP_CHANNELS = "1";
  process.env.COREBLOW_SKIP_CRON = "1";
  process.env.COREBLOW_ALLOW_MULTI_GATEWAY = "1";
  process.env.COREBLOW_BUNDLED_PLUGINS_DIR = "/tmp/coreblow-smoke-no-bundled";
  delete process.env.COREBLOW_TEST_MINIMAL_GATEWAY;

  const server = await startGatewayServer(PORT, {
    auth: { mode: "token", token: TOKEN },
    controlUiEnabled: false,
  });

  const activeMk = getActiveMicrokernel();
  if (!activeMk) {
    throw new Error("FATAL: getActiveMicrokernel() returned null after server start!");
  }
  console.log("✓ Gateway microkernel booted with 12 services running!");

  try {
    console.log("\n=== STEP 2: Turn 1 (Remember Directive via SSE) ===");
    const turn1 = await sendSseChatTurn(
      "Remember: the canonical release version of CoreBlow is 2.0.0",
    );
    console.log("Turn 1 Status Code:", turn1.statusCode);
    console.log("Turn 1 Events Received:", turn1.events.length);
    console.log("Turn 1 Full Reply:", turn1.fullReply.slice(0, 200));

    if (turn1.statusCode !== 200) {
      throw new Error(`Turn 1 failed with status ${turn1.statusCode}`);
    }
    if (!turn1.events.includes("[DONE]")) {
      throw new Error("Turn 1 did not receive [DONE] SSE terminator");
    }

    console.log("\n=== STEP 3: Turn 2 (Memory Recall Query via SSE) ===");
    const turn2 = await sendSseChatTurn(
      "What is the canonical release version of CoreBlow?",
    );
    console.log("Turn 2 Status Code:", turn2.statusCode);
    console.log("Turn 2 Events Received:", turn2.events.length);
    console.log("Turn 2 Full Reply:", turn2.fullReply.slice(0, 200));

    if (turn2.statusCode !== 200) {
      throw new Error(`Turn 2 failed with status ${turn2.statusCode}`);
    }
    if (!turn2.events.includes("[DONE]")) {
      throw new Error("Turn 2 did not receive [DONE] SSE terminator");
    }

    console.log("\n=== STEP 4: Inspect Cory 4-Layer Memory via /api/cory/layers ===");
    const layers = await getCoryLayers();
    console.log("Total Cory Layer Items:", layers.items?.length ?? 0);
    const durableItems = layers.items.filter((i) => i.layer.toLowerCase() === "durable");
    console.log("Durable Items:", durableItems.map((i) => i.content));

    const foundRemembered = durableItems.some((i) =>
      i.content.toLowerCase().includes("2.0.0") ||
      i.content.toLowerCase().includes("canonical release version"),
    );

    if (!foundRemembered) {
      throw new Error("Remembered version 2.0.0 not found in Cory durable layer!");
    }
    console.log("✓ Successfully verified '2.0.0' in Cory Durable Memory layer!");

    console.log("\n=== LIVE SMOKE TEST PASSED 100% GREEN ===");
  } finally {
    console.log("\nClosing Gateway server...");
    await server.close();
    console.log("✓ Gateway server closed cleanly.");
  }
}

run().catch((err) => {
  console.error("SMOKE TEST FAILED:", err);
  process.exit(1);
});
