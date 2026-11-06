/**
 * CoreBlow Sovereign MCP Live End-to-End Simulation Test
 *
 * Boots CoreBlow v2.0.0's 12-Service Microkernel, starts a live node:http loopback
 * JSON-RPC server on 127.0.0.1:0, executes an 8-step autonomous protocol simulation
 * (handshake + 6 sovereign microkernel tool calls), and generates a live telemetry
 * evidence report under .evidence/mcp-live-simulation/live-mcp-report.json.
 */

import http from "node:http";
import type { AddressInfo } from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createMicrokernelServiceRegistry,
  type MicrokernelServicesResult,
} from "../gateway/microkernel-services.js";
import {
  createSovereignMicrokernelMcpTools,
  executeSovereignMcpJsonRpc,
  type SovereignMcpToolsResult,
} from "./sovereign-mcp-bridge.js";
import { handleMcpJsonRpc } from "../gateway/mcp-http.handlers.js";
import type { JsonRpcRequest } from "../gateway/mcp-http.protocol.js";
import type { CoreBlowReleaseManifest } from "../infra/release/sovereign-release-certifier.js";

export interface LiveMcpSimulationReport {
  readonly protocol: {
    readonly serverName: string;
    readonly serverVersion: string;
    readonly protocolVersion: string;
    readonly transport: string;
    readonly endpoint: string;
    readonly simulationCompletedAtIso: string;
    readonly totalDurationMs: number;
  };
  readonly summary: {
    readonly totalSteps: number;
    readonly successfulSteps: number;
    readonly failedSteps: number;
    readonly allStepsPassed: boolean;
    readonly averageLatencyMs: number;
    readonly toolsListedCount: number;
    readonly manifestSha256: string;
    readonly kernelServiceCount: number;
  };
  readonly latencies: Record<string, number>;
  readonly transcript: readonly {
    readonly stepIndex: number;
    readonly stepName: string;
    readonly method: string;
    readonly latencyMs: number;
    readonly timestampIso: string;
    readonly request: unknown;
    readonly response: unknown;
  }[];
  readonly releaseManifest: unknown;
}

interface RpcSuccessResponse<T = unknown> {
  readonly jsonrpc: "2.0";
  readonly id: string | number | null;
  readonly result: T;
}

interface ToolCallResultContent {
  readonly type: "text";
  readonly text: string;
}

interface ToolCallResult {
  readonly content: ToolCallResultContent[];
  readonly isError: boolean;
}

describe("Sovereign Microkernel Live MCP End-to-End Simulation", () => {
  let tempDir: string;
  let coryDir: string;
  let kernel: MicrokernelServicesResult;
  let sovereignTools: SovereignMcpToolsResult;
  let server: http.Server;
  let endpoint: string;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-mcp-e2e-"));
    coryDir = path.join(tempDir, "memory");
    fs.mkdirSync(coryDir, { recursive: true });

    kernel = createMicrokernelServiceRegistry({
      stateDir: tempDir,
      coryDir,
      activeProvider: "coreblow-local",
      activeModel: "default",
      isProviderConfigured: true,
    });

    const startResult = await kernel.registry.startAll();
    expect(startResult.failed).toHaveLength(0);
    expect(startResult.started).toHaveLength(12);

    sovereignTools = createSovereignMicrokernelMcpTools(kernel, {
      defaultWorkspaceId: "e2e-simulation-workspace",
      defaultSessionId: "e2e-simulation-session",
      coreHubArtifactCount: 16,
    });

    server = http.createServer(async (req, res) => {
      if (req.method !== "POST") {
        res.writeHead(405, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Method Not Allowed" }));
        return;
      }

      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
      }
      const rawBody = Buffer.concat(chunks).toString("utf8");

      try {
        const message = JSON.parse(rawBody) as JsonRpcRequest;
        const response = await handleMcpJsonRpc({
          message,
          tools: sovereignTools.tools,
          toolSchema: sovereignTools.toolSchema,
          hookContext: { sessionKey: "e2e-mcp-live" } as any,
        });

        if (response === null) {
          res.writeHead(204);
          res.end();
          return;
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(response));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            id: null,
            error: { code: -32603, message },
          }),
        );
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address() as AddressInfo;
    endpoint = `http://127.0.0.1:${address.port}/mcp`;
  }, 30_000);

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }

    if (kernel) {
      await kernel.registry.stopAll();
    }

    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }, 30_000);

  it("executes the complete 8-step live MCP simulation and generates the telemetry evidence report", async () => {
    const simulationStartTime = performance.now();
    const latencies: Record<string, number> = {};
    const transcript: Array<{
      stepIndex: number;
      stepName: string;
      method: string;
      latencyMs: number;
      timestampIso: string;
      request: unknown;
      response: unknown;
    }> = [];

    async function sendRpc<T = unknown>(
      stepIndex: number,
      stepName: string,
      request: JsonRpcRequest,
    ): Promise<T> {
      const start = performance.now();
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(request),
      });

      const latencyMs = Math.round(performance.now() - start);
      latencies[`${stepIndex}_${stepName}`] = latencyMs;

      expect(res.status).toBe(200);
      const data = (await res.json()) as T;

      transcript.push({
        stepIndex,
        stepName,
        method: request.method,
        latencyMs,
        timestampIso: new Date().toISOString(),
        request,
        response: data,
      });

      return data;
    }

    // ========================================================================
    // Step 1: initialize handshake
    // ========================================================================
    const initReq: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        clientInfo: {
          name: "coreblow-live-simulation-client",
          version: "2.0.0",
        },
        capabilities: {},
      },
    };
    const initRes = await sendRpc<
      RpcSuccessResponse<{
        protocolVersion: string;
        capabilities: { tools: object };
        serverInfo: { name: string; version: string };
      }>
    >(1, "initialize", initReq);

    expect(initRes.jsonrpc).toBe("2.0");
    expect(initRes.id).toBe(1);
    expect(initRes.result.protocolVersion).toBe("2024-11-05");
    expect(initRes.result.capabilities.tools).toBeDefined();
    expect(initRes.result.serverInfo.name).toBe("coreblow");
    expect(initRes.result.serverInfo.version).toBe("0.1.0");

    // ========================================================================
    // Step 2: tools/list discovery
    // ========================================================================
    const listReq: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    };
    const listRes = await sendRpc<
      RpcSuccessResponse<{
        tools: Array<{
          name: string;
          description: string;
          inputSchema: { type: string; properties?: Record<string, unknown> };
        }>;
      }>
    >(2, "tools_list", listReq);

    expect(listRes.jsonrpc).toBe("2.0");
    expect(listRes.id).toBe(2);
    expect(listRes.result.tools).toHaveLength(6);

    const expectedToolNames = [
      "cory_memory_recall",
      "cory_evoloop_distill",
      "decision_router_resolve",
      "war_room_orchestrate",
      "pr_workflow_evaluate",
      "sovereign_release_audit",
    ];
    const retrievedToolNames = listRes.result.tools.map((t) => t.name);
    for (const name of expectedToolNames) {
      expect(retrievedToolNames).toContain(name);
    }
    for (const tool of listRes.result.tools) {
      expect(tool.inputSchema.type).toBe("object");
    }

    // ========================================================================
    // Step 3: tools/call cory_memory_recall
    // ========================================================================
    const memoryReq: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "cory_memory_recall",
        arguments: {
          action: "capture_and_recall",
          title: "Sovereign Microkernel Memory Invariants",
          category: "architecture",
          insights: [
            "All 12 microkernel services must start in topological order.",
            "MCP tool bridge exposes dual-surface Stdio and HTTP interfaces.",
          ],
          decisions: [
            "Maintain pure DOP contracts for sovereign release certification.",
          ],
          constraints: [
            "Strictly zero competitor brand mentions anywhere across repositories.",
          ],
          query: "topological order",
          limit: 5,
        },
      },
    };
    const memoryRes = await sendRpc<RpcSuccessResponse<ToolCallResult>>(
      3,
      "cory_memory_recall",
      memoryReq,
    );

    expect(memoryRes.jsonrpc).toBe("2.0");
    expect(memoryRes.id).toBe(3);
    expect(memoryRes.result.isError).toBe(false);
    expect(memoryRes.result.content).toHaveLength(1);

    const memoryPayload = JSON.parse(memoryRes.result.content[0].text);
    expect(memoryPayload.ok).toBe(true);
    expect(memoryPayload.capturedPage).toBeDefined();
    expect(memoryPayload.slug).toBeDefined();
    expect(memoryPayload.auditPanel).toBeDefined();
    expect(memoryPayload.totalPages).toBeGreaterThanOrEqual(1);

    // ========================================================================
    // Step 4: tools/call cory_evoloop_distill
    // ========================================================================
    const evoloopReq: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "cory_evoloop_distill",
        arguments: {
          action: "ingest",
          trajectory: {
            sessionId: "e2e-mcp-session",
            taskGoal: "Certify microkernel release readiness autonomously",
            steps: [
              {
                toolName: "cory_memory_recall",
                succeeded: true,
                durationMs: 14,
                output: "Retrieved architectural invariants from Scribe wiki",
              },
              {
                toolName: "sovereign_release_audit",
                succeeded: true,
                durationMs: 22,
                output: "Audited 12 microkernel services and compiled manifest",
              },
            ],
            verificationPassed: true,
            verificationCommand: "vitest run src/mcp/sovereign-mcp-live.e2e.test.ts",
            learnedInsight:
              "Topological verification and hermetic state guarantee zero test regression",
          },
          targetStatus: "canary",
          evaluatePromote: true,
          promoteCount: 3,
        },
      },
    };
    const evoloopRes = await sendRpc<RpcSuccessResponse<ToolCallResult>>(
      4,
      "cory_evoloop_distill",
      evoloopReq,
    );

    expect(evoloopRes.jsonrpc).toBe("2.0");
    expect(evoloopRes.id).toBe(4);
    expect(evoloopRes.result.isError).toBe(false);

    const evoloopPayload = JSON.parse(evoloopRes.result.content[0].text);
    expect(evoloopPayload.ok).toBe(true);
    expect(evoloopPayload.skillId).toBeDefined();
    expect(evoloopPayload.status).toBe("verified_active");
    expect(evoloopPayload.autoPromoted).toBe(true);
    expect(evoloopPayload.wilsonScore).toBeGreaterThan(0);

    // ========================================================================
    // Step 5: tools/call decision_router_resolve
    // ========================================================================
    const routerReq: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "decision_router_resolve",
        arguments: {
          prompt: "Verify release security invariants and compute cryptographic manifest",
          tier: "decision",
          profileId: "lead",
          simulateQuotaExhaustion: true,
        },
      },
    };
    const routerRes = await sendRpc<RpcSuccessResponse<ToolCallResult>>(
      5,
      "decision_router_resolve",
      routerReq,
    );

    expect(routerRes.jsonrpc).toBe("2.0");
    expect(routerRes.id).toBe(5);
    expect(routerRes.result.isError).toBe(false);

    const routerPayload = JSON.parse(routerRes.result.content[0].text);
    expect(routerPayload.ok).toBe(true);
    expect(routerPayload.tier).toBe("decision");
    expect(routerPayload.daybreakSwitched).toBe(true);
    expect(routerPayload.providerId).toBeDefined();
    expect(routerPayload.modelId).toBeDefined();

    // ========================================================================
    // Step 6: tools/call war_room_orchestrate
    // ========================================================================
    const warRoomReq: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: {
        name: "war_room_orchestrate",
        arguments: {
          action: "orchestrate",
          roomId: "room-e2e-mcp-live",
          title: "CoreBlow v2.0.0 Sovereign Release Squad",
          purpose: "Autonomous coordination for v2.0.0 GA release verification",
          prompt: "Audit microkernel health, evaluate release gates, and approve PR",
          forkTopic: "Security Invariant Verification",
          column: "done",
        },
      },
    };
    const warRoomRes = await sendRpc<RpcSuccessResponse<ToolCallResult>>(
      6,
      "war_room_orchestrate",
      warRoomReq,
    );

    expect(warRoomRes.jsonrpc).toBe("2.0");
    expect(warRoomRes.id).toBe(6);
    expect(warRoomRes.result.isError).toBe(false);

    const warRoomPayload = JSON.parse(warRoomRes.result.content[0].text);
    expect(warRoomPayload.ok).toBe(true);
    expect(warRoomPayload.status).toBe("completed");
    expect(warRoomPayload.roomId).toBe("room-e2e-mcp-live");
    expect(warRoomPayload.leadAgentId).toBeDefined();
    expect(warRoomPayload.delegatedToAgentId).toBeDefined();
    expect(warRoomPayload.forkedThreadId).toBeDefined();
    expect(warRoomPayload.markdownCard).toBeDefined();
    expect(typeof warRoomPayload.markdownCard).toBe("string");
    expect(warRoomPayload.markdownCard.length).toBeGreaterThan(0);

    // ========================================================================
    // Step 7: tools/call pr_workflow_evaluate
    // ========================================================================
    const prReq: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: {
        name: "pr_workflow_evaluate",
        arguments: {
          action: "evaluate_and_approve",
          title: "PR: Sovereign MCP Live Simulation Feature",
          description:
            "End-to-End autonomous live simulation connecting 12 microkernel services to MCP JSON-RPC.",
          changedFiles: [
            "src/mcp/sovereign-mcp-bridge.ts",
            "src/mcp/sovereign-mcp-live.e2e.test.ts",
          ],
          diffText: "+ export const SOVEREIGN_MCP_LIVE_SIMULATION_READY = true;\n",
          testSecretDiff:
            "+ const leakedKey = 'sk-ant-api03-abcdef1234567890abcdef1234567890';\n",
          testPassed: true,
          typecheckPassed: true,
          lintPassed: true,
          autoApproveClean: true,
        },
      },
    };
    const prRes = await sendRpc<RpcSuccessResponse<ToolCallResult>>(
      7,
      "pr_workflow_evaluate",
      prReq,
    );

    expect(prRes.jsonrpc).toBe("2.0");
    expect(prRes.id).toBe(7);
    expect(prRes.result.isError).toBe(false);

    const prPayload = JSON.parse(prRes.result.content[0].text);
    expect(prPayload.ok).toBe(true);
    expect(prPayload.secretScanBlocked).toBe(true);
    expect(prPayload.secretBlockedStatus).toBe("blocked");
    expect(prPayload.status).toBe("approved");
    expect(prPayload.allChecksPassed).toBe(true);
    expect(prPayload.approvedDraft).toBeDefined();
    expect(prPayload.markdownScorecard).toBeDefined();
    expect(typeof prPayload.markdownScorecard).toBe("string");
    expect(prPayload.markdownScorecard.length).toBeGreaterThan(0);

    // ========================================================================
    // Step 8: tools/call sovereign_release_audit
    // ========================================================================
    const auditReq: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: 8,
      method: "tools/call",
      params: {
        name: "sovereign_release_audit",
        arguments: {
          version: "2.0.0",
          releaseChannel: "stable",
          coreHubArtifactCount: 16,
          stagedFilePaths: [
            "src/mcp/sovereign-mcp-bridge.ts",
            "src/mcp/sovereign-mcp-live.e2e.test.ts",
          ],
          sourceSnippets: [
            "export const SOVEREIGN_MICROKERNEL_RELEASE_READY = true;",
          ],
        },
      },
    };
    const auditRes = await sendRpc<RpcSuccessResponse<ToolCallResult>>(
      8,
      "sovereign_release_audit",
      auditReq,
    );

    expect(auditRes.jsonrpc).toBe("2.0");
    expect(auditRes.id).toBe(8);
    expect(auditRes.result.isError).toBe(false);

    const auditPayload = JSON.parse(auditRes.result.content[0].text);
    expect(auditPayload.ok).toBe(true);
    expect(auditPayload.allGatesPassed).toBe(true);
    expect(auditPayload.totalKernelServices).toBe(12);
    expect(auditPayload.kernelServiceNames).toHaveLength(12);
    expect(auditPayload.manifestSha256).toMatch(/^[a-f0-9]{64}$/);

    const releaseManifest = auditPayload.manifest as CoreBlowReleaseManifest;
    expect(releaseManifest.product).toBe("CoreBlow Sovereign Agent-OS");
    expect(releaseManifest.version).toBe("2.0.0");
    expect(releaseManifest.allGatesPassed).toBe(true);
    expect(releaseManifest.gateResults).toHaveLength(5);

    // ========================================================================
    // Telemetry Evidence Report Compilation & Atomic File Write
    // ========================================================================
    const totalDurationMs = Math.round(performance.now() - simulationStartTime);
    const latencyValues = Object.values(latencies);
    const averageLatencyMs = Math.round(
      latencyValues.reduce((acc, curr) => acc + curr, 0) / latencyValues.length,
    );

    const report: LiveMcpSimulationReport = {
      protocol: {
        serverName: "coreblow",
        serverVersion: "0.1.0",
        protocolVersion: "2024-11-05",
        transport: "http-jsonrpc",
        endpoint,
        simulationCompletedAtIso: new Date().toISOString(),
        totalDurationMs,
      },
      summary: {
        totalSteps: 8,
        successfulSteps: 8,
        failedSteps: 0,
        allStepsPassed: true,
        averageLatencyMs,
        toolsListedCount: 6,
        manifestSha256: auditPayload.manifestSha256,
        kernelServiceCount: 12,
      },
      latencies,
      transcript,
      releaseManifest,
    };

    const evidenceDir = path.resolve(process.cwd(), ".evidence/mcp-live-simulation");
    fs.mkdirSync(evidenceDir, { recursive: true });

    const tempReportPath = path.join(evidenceDir, "live-mcp-report.json.tmp");
    const finalReportPath = path.join(evidenceDir, "live-mcp-report.json");

    fs.writeFileSync(tempReportPath, JSON.stringify(report, null, 2), "utf8");
    fs.renameSync(tempReportPath, finalReportPath);

    // Assert that the generated file exists and is valid
    expect(fs.existsSync(finalReportPath)).toBe(true);
    const savedContent = fs.readFileSync(finalReportPath, "utf8");
    const loadedReport = JSON.parse(savedContent) as LiveMcpSimulationReport;

    expect(loadedReport.summary.allStepsPassed).toBe(true);
    expect(loadedReport.summary.totalSteps).toBe(8);
    expect(loadedReport.summary.successfulSteps).toBe(8);
    expect(loadedReport.summary.manifestSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(loadedReport.transcript).toHaveLength(8);
    expect(loadedReport.summary.toolsListedCount).toBe(6);
    expect(loadedReport.summary.kernelServiceCount).toBe(12);
  }, 45_000);

  it("verifies direct executeSovereignMcpJsonRpc dispatch without HTTP overhead", async () => {
    const directRes = (await executeSovereignMcpJsonRpc({
      request: {
        jsonrpc: "2.0",
        id: "direct-1",
        method: "tools/list",
        params: {},
      },
      services: kernel,
    })) as RpcSuccessResponse<{ tools: Array<{ name: string }> }>;

    expect(directRes).toBeDefined();
    expect(directRes.jsonrpc).toBe("2.0");
    expect(directRes.id).toBe("direct-1");
    expect(directRes.result.tools).toHaveLength(6);
  });
});
