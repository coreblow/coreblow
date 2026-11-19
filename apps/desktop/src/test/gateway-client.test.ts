import { describe, it, expect, vi, beforeEach } from "vitest";
import { CoreBlowGatewayClient } from "../services/gateway-client";
import type { ToolExecutionStep } from "../types/gateway";

describe("CoreBlowGatewayClient", () => {
  let client: CoreBlowGatewayClient;

  beforeEach(() => {
    client = new CoreBlowGatewayClient("http://127.0.0.1:18789");
    vi.restoreAllMocks();
  });

  it("checks gateway health returns true on 200", async () => {
    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    } as any);

    const healthy = await client.checkHealth();
    expect(healthy).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:18789/health",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("checks gateway health returns false on network error", async () => {
    (global as any).fetch = vi.fn().mockRejectedValue(new Error("Network Error"));

    const healthy = await client.checkHealth();
    expect(healthy).toBe(false);
  });

  it("fetches memory layers from GET /api/cory/layers grouping items by layer", async () => {
    const mockPayload = {
      ok: true,
      count: 3,
      items: [
        { id: "1", layer: "durable", content: "Architecture fact" },
        { id: "2", layer: "durable", content: "Second durable fact" },
        { id: "3", layer: "working", content: "Current task" },
      ],
    };
    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockPayload,
    } as any);

    const layers = await client.getMemoryLayers();
    expect(layers.length).toBe(2);
    const durable = layers.find((l) => l.layer === "durable");
    expect(durable).toBeDefined();
    expect(durable?.count).toBe(2);
    const working = layers.find((l) => l.layer === "working");
    expect(working).toBeDefined();
    expect(working?.count).toBe(1);
    expect(global.fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:18789/api/cory/layers",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("searches memory via GET /api/cory/search handling hits array", async () => {
    const mockPayload = {
      ok: true,
      hits: [
        {
          item: { id: "hit-1", layer: "durable", content: "Cognitive AI Architecture" },
          score: 0.96,
        },
      ],
    };
    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockPayload,
    } as any);

    const results = await client.searchMemory("Cognitive");
    expect(results.length).toBe(1);
    expect(results[0].id).toBe("hit-1");
    expect(results[0].layer).toBe("durable");
    expect(results[0].content).toBe("Cognitive AI Architecture");
    expect(results[0].score).toBe(0.96);
    expect(global.fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:18789/api/cory/search?q=Cognitive",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("handles Cory profile, remember, forget, proposal resolve, and wiki compile", async () => {
    // 1. getCoryProfile
    const mockProfile = {
      ok: true,
      profile: {
        updatedAt: 1000,
        traits: [{ id: "t1", dimension: "tech_stack", key: "desktop_framework", value: "Electron", confidence: 0.95, updatedAt: 1000 }],
      },
      itemsByLayer: {
        identity: [{ id: "i1", layer: "identity", content: "Operator" }],
        durable: [{ id: "d1", layer: "durable", content: "Single Brain" }],
        constraint: [{ id: "c1", layer: "constraint", content: "Zero Trust" }],
        episodic: [],
      },
      pendingProposals: [
        { id: "p1", content: "TypeScript", targetLayer: "durable", source: "test", createdAt: 1000, status: "pending" },
      ],
      counts: { total: 3, identity: 1, durable: 1, constraint: 1, episodic: 0 },
    };

    (global as any).fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockProfile,
    } as any);

    const profileRes = await client.getCoryProfile();
    expect(profileRes).not.toBeNull();
    expect(profileRes?.profile.traits.length).toBe(1);
    expect(profileRes?.itemsByLayer.durable.length).toBe(1);
    expect(profileRes?.pendingProposals.length).toBe(1);

    // 2. rememberMemory
    (global as any).fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, item: { id: "new-1" } }),
    } as any);

    const remOk = await client.rememberMemory("User prefers dark mode", "identity");
    expect(remOk).toBe(true);

    // 3. forgetMemory
    (global as any).fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, removedCount: 1 }),
    } as any);

    const delOk = await client.forgetMemory("old-1");
    expect(delOk).toBe(true);

    // 4. resolveMemoryProposal
    (global as any).fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    } as any);

    const propOk = await client.resolveMemoryProposal("p1", "approve");
    expect(propOk).toBe(true);

    // 5. compileMemoryWiki
    (global as any).fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, path: "/path/to/INDEX.md", markdown: "# Wiki" }),
    } as any);

    const wikiRes = await client.compileMemoryWiki();
    expect(wikiRes?.ok).toBe(true);
    expect(wikiRes?.markdown).toBe("# Wiki");
  });

  it("fetches storefront skills from GET /api/corehub/storefront handling cards array", async () => {
    const mockPayload = {
      ok: true,
      cards: [
        { id: "skill-1", name: "Git Auditor", description: "Audits git repo" },
      ],
    };
    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockPayload,
    } as any);

    const skills = await client.getStorefront();
    expect(skills.length).toBe(1);
    expect(skills[0].id).toBe("skill-1");
    expect(skills[0].name).toBe("Git Auditor");
    expect(skills[0].description).toBe("Audits git repo");
    expect(skills[0].version).toBe("2.0.0");
    expect(global.fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:18789/api/corehub/storefront",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("fetches learned skills from GET /api/corehub/skills/learned handling skills array", async () => {
    const mockPayload = {
      ok: true,
      skills: [
        { id: "learned-1", name: "Gate Runner", description: "Learned procedure" },
      ],
    };
    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockPayload,
    } as any);

    const learned = await client.getLearnedSkills();
    expect(learned.length).toBe(1);
    expect(learned[0].id).toBe("learned-1");
    expect(learned[0].name).toBe("Gate Runner");
    expect(learned[0].description).toBe("Learned procedure");
    expect(learned[0].installed).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:18789/api/corehub/skills/learned",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("handles multi-turn real-time SSE streaming with string step and toolStep events", async () => {
    const sseChunks = [
      'data: {"step":"Executing list_dir (coreblow)"}\n\n',
      'data: {"toolStep":"✓ list_dir · coreblow (12ms)"}\n\n',
      'data: {"step":"Executing read_file (package.json)"}\n\n',
      'data: {"toolStep":"✓ read_file · package.json (8ms)"}\n\n',
      'data: {"choices":[{"delta":{"content":"Single-Brain "}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"Gateway verified."}}]}\n\n',
      "data: [DONE]\n\n",
    ];

    let chunkIndex = 0;
    const mockStream = {
      getReader: () => ({
        read: async () => {
          if (chunkIndex < sseChunks.length) {
            const encoder = new TextEncoder();
            const chunk = encoder.encode(sseChunks[chunkIndex++]);
            return { value: chunk, done: false };
          }
          return { value: undefined, done: true };
        },
      }),
    };

    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: mockStream,
    } as any);

    const deltas: string[] = [];
    const steps: ToolExecutionStep[] = [];
    let completed = false;

    const reply = await client.streamChat(
      {
        prompt: "Verify CoreBlow Desktop",
        messages: [{ role: "user", content: "Verify CoreBlow Desktop" }],
        executionProfile: "Guarded",
      },
      {
        onDelta: (d) => deltas.push(d),
        onStep: (s) => steps.push(s),
        onToolStep: (ts) => steps.push(ts),
        onDone: () => {
          completed = true;
        },
      },
    );

    expect(reply).toBe("Single-Brain Gateway verified.");
    expect(deltas).toEqual(["Single-Brain ", "Gateway verified."]);
    // 2 running steps + 2 done tool steps = 4 step events
    expect(steps.length).toBe(4);
    expect(steps[0].tool).toBe("list_dir");
    expect(steps[0].status).toBe("running");
    expect(steps[0].stepIndex).toBe(1);

    expect(steps[1].tool).toBe("list_dir");
    expect(steps[1].status).toBe("done");
    expect(steps[1].stepIndex).toBe(1); // Same stepIndex as running!
    expect(steps[1].durationMs).toBe(12);

    expect(steps[2].tool).toBe("read_file");
    expect(steps[2].status).toBe("running");
    expect(steps[2].stepIndex).toBe(2); // Incremented stepIndex!

    expect(steps[3].tool).toBe("read_file");
    expect(steps[3].status).toBe("done");
    expect(steps[3].stepIndex).toBe(2);
    expect(steps[3].durationMs).toBe(8);

    expect(completed).toBe(true);
  });

  it("lists sessions from GET /api/corehub/sessions", async () => {
    const mockSessions = [
      {
        id: "sess_1",
        title: "Test Chat",
        createdAt: 1000,
        updatedAt: 2000,
        surface: "desktop",
        messages: [
          { id: "m1", role: "user", content: "Hi", createdAt: 1000 },
          { id: "m2", role: "assistant", content: "Hello", createdAt: 1001 },
        ],
      },
    ];
    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, count: 1, sessions: mockSessions }),
    } as any);

    const sessions = await client.listSessions();
    expect(sessions.length).toBe(1);
    expect(sessions[0].id).toBe("sess_1");
    expect(sessions[0].title).toBe("Test Chat");
    expect(sessions[0].messages.length).toBe(2);
  });

  it("saves and deletes sessions via POST and DELETE /api/corehub/sessions", async () => {
    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as any);

    const saved = await client.saveSession({
      id: "sess_save_test",
      title: "Save Test",
      createdAt: 1000,
      updatedAt: 2000,
      executionProfile: "Full access",
      model: "High Reasoning",
      messages: [],
    });
    expect(saved).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:18789/api/corehub/sessions",
      expect.objectContaining({ method: "POST" }),
    );

    const deleted = await client.deleteSession("sess_save_test");
    expect(deleted).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:18789/api/corehub/sessions/sess_save_test",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("handles War Room state, squad messaging, and approval resolution", async () => {
    // 1. listWarRooms
    (global as any).fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, rooms: [{ roomId: "room_1", title: "Room 1", purpose: "Test" }] }),
    } as any);

    const rooms = await client.listWarRooms();
    expect(rooms.length).toBe(1);
    expect(rooms[0].roomId).toBe("room_1");

    // 2. getWarRoomState
    const mockState = {
      ok: true,
      roomId: "coreblow-squad",
      title: "CoreBlow Squad",
      purpose: "Unified Squad",
      leadAgentId: "agent-lead",
      members: [
        { agentId: "agent-coder", name: "Coder", role: "coder", routeTier: "coding", liveState: "idle" },
      ],
      kanbanBoard: [],
      pendingApprovals: [
        { approvalId: "appr_1", parentSessionId: "p1", childSessionId: "c1", agentId: "agent-coder", toolName: "terminal", status: "pending" },
      ],
      messages: [
        { id: "m1", roomId: "coreblow-squad", senderId: "user", senderName: "Operator", senderRole: "user", content: "@coder hello", mentions: ["coder"], handoffDepth: 0, createdAt: 1000 },
      ],
      screenFeed: [],
    };

    (global as any).fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockState,
    } as any);

    const state = await client.getWarRoomState("coreblow-squad");
    expect(state).not.toBeNull();
    expect(state?.roomId).toBe("coreblow-squad");
    expect(state?.members.length).toBe(1);
    expect(state?.pendingApprovals.length).toBe(1);
    expect(state?.messages.length).toBe(1);

    // 3. postWarRoomMessage
    (global as any).fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        userMessage: mockState.messages[0],
        replies: [{ id: "m2", roomId: "coreblow-squad", senderId: "agent-coder", senderName: "Coder", senderRole: "coder", content: "Done", mentions: [], handoffDepth: 1, createdAt: 1001 }],
        room: mockState,
      }),
    } as any);

    const postResult = await client.postWarRoomMessage("coreblow-squad", "@coder run tests");
    expect(postResult).not.toBeNull();
    expect(postResult?.replies.length).toBe(1);
    expect(postResult?.replies[0].senderRole).toBe("coder");

    // 4. resolveWarRoomApproval
    (global as any).fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    } as any);

    const approvalRes = await client.resolveWarRoomApproval("coreblow-squad", "appr_1", "approved");
    expect(approvalRes).toBe(true);
  });

  it("handles CoreHub 1-click install/uninstall, skill toggle/patch, and credential pools", async () => {
    // 1. installStorefrontItem & uninstallStorefrontItem
    (global as any).fetch = vi.fn().mockResolvedValueOnce({ ok: true } as any);
    const instOk = await client.installStorefrontItem("ext-1");
    expect(instOk).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:18789/api/corehub/storefront/ext-1/install",
      expect.objectContaining({ method: "POST" }),
    );

    (global as any).fetch = vi.fn().mockResolvedValueOnce({ ok: true } as any);
    const uninstOk = await client.uninstallStorefrontItem("ext-1");
    expect(uninstOk).toBe(true);

    // 2. toggleLearnedSkill & patchLearnedSkill
    (global as any).fetch = vi.fn().mockResolvedValueOnce({ ok: true } as any);
    const toggleOk = await client.toggleLearnedSkill("skill-1", true);
    expect(toggleOk).toBe(true);

    (global as any).fetch = vi.fn().mockResolvedValueOnce({ ok: true } as any);
    const patchOk = await client.patchLearnedSkill("skill-1", { description: "Updated playbook" });
    expect(patchOk).toBe(true);

    // 3. getCredentialPools
    const mockPools = {
      ok: true,
      fallbackChain: ["anthropic", "openai"],
      pools: {
        anthropic: [{ id: "k1", providerId: "anthropic", label: "Key 1", apiKey: "sk-...1234", priority: 1, enabled: true }],
      },
      telemetry: {
        daily: {},
        monthly: {},
        lifetime: { requests: 10, inputTokens: 5000, outputTokens: 2000, totalTokens: 7000, estimatedCostUsd: 0.05, failovers: 1 },
        byProvider: {},
      },
    };
    (global as any).fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockPools,
    } as any);

    const pools = await client.getCredentialPools();
    expect(pools).not.toBeNull();
    expect(pools?.fallbackChain.length).toBe(2);
    expect(pools?.pools.anthropic.length).toBe(1);

    // 4. addCredentialPoolKey & deleteCredentialPoolKey
    (global as any).fetch = vi.fn().mockResolvedValueOnce({ ok: true } as any);
    const addKeyOk = await client.addCredentialPoolKey({ providerId: "openai", apiKey: "sk-proj-test", label: "Backup" });
    expect(addKeyOk).toBe(true);

    (global as any).fetch = vi.fn().mockResolvedValueOnce({ ok: true } as any);
    const delKeyOk = await client.deleteCredentialPoolKey("k1");
    expect(delKeyOk).toBe(true);

    // 5. saveFallbackChain
    (global as any).fetch = vi.fn().mockResolvedValueOnce({ ok: true } as any);
    const chainOk = await client.saveFallbackChain(["openai", "anthropic"]);
    expect(chainOk).toBe(true);
  });

  it("handles target node switching and Bearer auth header injection", async () => {
    client.setTargetNode("https://vps-frankfurt.coreblow.com:18789", "tok_secret_production_key_12345");
    const target = client.getTargetNode();
    expect(target.baseUrl).toBe("https://vps-frankfurt.coreblow.com:18789");
    expect(target.bearerToken).toBe("tok_secret_production_key_12345");

    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    } as any);

    const healthy = await client.checkHealth();
    expect(healthy).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://vps-frankfurt.coreblow.com:18789/health",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer tok_secret_production_key_12345",
        }),
      }),
    );
  });

  it("handles remote nodes CRUD, probing, session sync, and voice API methods", async () => {
    // 1. listNodes
    const mockNodes = [
      { id: "local", name: "Local Gateway", url: "http://127.0.0.1:18789", kind: "local", enabled: true },
      { id: "vps_1", name: "VPS Cloud 24/7", url: "https://vps.cloud:18789", kind: "vps", enabled: true, bearerToken: "tok_...1234" },
    ];
    (global as any).fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, nodes: mockNodes }),
    } as any);
    const nodes = await client.listNodes();
    expect(nodes.length).toBe(2);
    expect(nodes[0].id).toBe("local");

    // 2. saveRemoteNode
    (global as any).fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, node: mockNodes[1] }),
    } as any);
    const saveRes = await client.saveRemoteNode({ name: "VPS Cloud 24/7", url: "https://vps.cloud:18789", kind: "vps" });
    expect(saveRes.ok).toBe(true);
    expect(saveRes.node?.id).toBe("vps_1");

    // 3. probeNode
    (global as any).fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, healthy: true, latencyMs: 24 }),
    } as any);
    const probeRes = await client.probeNode("vps_1");
    expect(probeRes.ok).toBe(true);
    expect(probeRes.healthy).toBe(true);
    expect(probeRes.latencyMs).toBe(24);

    // 4. syncNodeSessions
    (global as any).fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, syncedCount: 5 }),
    } as any);
    const syncRes = await client.syncNodeSessions("vps_1");
    expect(syncRes.ok).toBe(true);
    expect(syncRes.syncedCount).toBe(5);

    // 5. deleteRemoteNode
    (global as any).fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, removed: true }),
    } as any);
    const delRes = await client.deleteRemoteNode("vps_1");
    expect(delRes.ok).toBe(true);

    // 6. transcribeVoice
    (global as any).fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, text: "Transcribed voice text", engine: "whisper-large-v3" }),
    } as any);
    const transcribeRes = await client.transcribeVoice({ audioBase64: "base64audio==" });
    expect(transcribeRes.ok).toBe(true);
    expect(transcribeRes.text).toBe("Transcribed voice text");

    // 7. synthesizeVoice
    (global as any).fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, mode: "browser_speech_fallback", text: "Speak this" }),
    } as any);
    const synthRes = await client.synthesizeVoice({ text: "Speak this" });
    expect(synthRes.ok).toBe(true);
    expect(synthRes.mode).toBe("browser_speech_fallback");
  });
});
