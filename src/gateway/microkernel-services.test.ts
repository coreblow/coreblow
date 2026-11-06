import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CoreHubAppManifest } from "../plugins/app-store-contract.js";
import type { ResolvedGatewayAuth } from "./auth.js";
import {
  createMicrokernelServiceRegistry,
  handleCoreHubRoute,
  resolveCoreHubOperatorScopes,
  NativeProviderRuntimeService,
  NativeRagRuntimeService,
  NativeToolRuntimeService,
  NativeBrowserRuntimeService,
  NativeVoiceRuntimeService,
} from "./microkernel-services.js";

function createMockReqRes(options: {
  method: string;
  url: string;
  body?: unknown;
  headers?: Record<string, string>;
}): {
  req: IncomingMessage;
  res: ServerResponse;
  getResult: () => Promise<{ statusCode: number; data: any; headers: Record<string, string> }>;
} {
  const passThrough = new PassThrough();
  const req = passThrough as unknown as IncomingMessage;
  (req as any).method = options.method;
  (req as any).url = options.url;

  const normalizedHeaders: Record<string, string> = {
    "content-type": "application/json",
    host: "localhost:3000",
  };
  if (options.headers) {
    for (const [k, v] of Object.entries(options.headers)) {
      normalizedHeaders[k.toLowerCase()] = v;
    }
  }
  (req as any).headers = normalizedHeaders;
  (req as any).socket = { remoteAddress: "127.0.0.1" };

  let statusCode = 200;
  const resHeaders: Record<string, string> = {};
  const chunks: Buffer[] = [];
  let isFinished = false;

  const res = new EventEmitter() as unknown as ServerResponse;
  Object.defineProperty(res, "statusCode", {
    get: () => statusCode,
    set: (val: number) => {
      statusCode = val;
    },
  });
  (res as any).setHeader = (key: string, value: string) => {
    resHeaders[key.toLowerCase()] = String(value);
  };
  (res as any).getHeader = (key: string) => resHeaders[key.toLowerCase()];
  (res as any).end = (chunk?: string | Buffer) => {
    if (chunk) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    isFinished = true;
    res.emit("finish");
  };

  if (options.body !== undefined) {
    const payload = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
    passThrough.end(Buffer.from(payload));
  } else {
    passThrough.end();
  }

  const getResult = async () => {
    if (!isFinished) {
      await new Promise<void>((resolve) => res.once("finish", () => resolve()));
    }
    const raw = Buffer.concat(chunks).toString("utf8");
    let data: any = raw;
    try {
      data = JSON.parse(raw);
    } catch {
      // Return raw string if not JSON
    }
    return { statusCode, data, headers: resHeaders };
  };

  return { req, res, getResult };
}

describe("Microkernel Services Registry & Storefront Endpoints", () => {
  let testDir: string;
  let coryDir: string;

  const testAuth: ResolvedGatewayAuth = {
    mode: "token",
    token: "test-admin-secret-token",
    modeSource: "token",
    allowTailscale: false,
  };

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), `coreblow-microkernel-test-${crypto.randomUUID()}`);
    coryDir = path.join(testDir, "memory");
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(coryDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it("registers all 12 microkernel services with deterministic topological dependencies", () => {
    const microkernel = createMicrokernelServiceRegistry({
      stateDir: testDir,
      coryDir,
    });

    expect(microkernel.provider.name).toBe("provider-runtime");
    expect(microkernel.rag.name).toBe("rag-runtime");
    expect(microkernel.tool.name).toBe("tool-runtime");
    expect(microkernel.browser.name).toBe("browser-runtime");
    expect(microkernel.voice.name).toBe("voice-runtime");
    expect(microkernel.cory.name).toBe("cory-memory");
    expect(microkernel.skillSynthesizer.name).toBe("cory-skill-synthesizer");
    expect(microkernel.tierPolicy.name).toBe("extension-tier-policy");
    expect(microkernel.appStore.name).toBe("corehub-app-store");
    expect(microkernel.warRoom.name).toBe("war-room-orchestrator");
    expect(microkernel.knowledgeScribe.name).toBe("cory-knowledge-scribe");
    expect(microkernel.prWorkflow.name).toBe("pr-workflow-orchestrator");

    const list = microkernel.registry.list();
    expect(list).toHaveLength(12);

    const providerEntry = list.find((s) => s.name === "provider-runtime")!;
    expect(providerEntry.deps).toEqual([]);

    const ragEntry = list.find((s) => s.name === "rag-runtime")!;
    expect(ragEntry.deps).toEqual(["provider-runtime"]);

    const toolEntry = list.find((s) => s.name === "tool-runtime")!;
    expect(toolEntry.deps).toEqual(["provider-runtime"]);

    const browserEntry = list.find((s) => s.name === "browser-runtime")!;
    expect(browserEntry.deps).toEqual(["tool-runtime"]);

    const voiceEntry = list.find((s) => s.name === "voice-runtime")!;
    expect(voiceEntry.deps).toEqual([]);

    // Strict invariant: Cory depends ONLY on provider-runtime, NEVER on CoreHub
    const coryEntry = list.find((s) => s.name === "cory-memory")!;
    expect(coryEntry.deps).toEqual(["provider-runtime"]);
    expect(coryEntry.deps).not.toContain("corehub-app-store");

    const skillSynthesizerEntry = list.find((s) => s.name === "cory-skill-synthesizer")!;
    expect(skillSynthesizerEntry.deps).toEqual(["cory-memory"]);

    const tierPolicyEntry = list.find((s) => s.name === "extension-tier-policy")!;
    expect(tierPolicyEntry.deps).toEqual([]);

    const appStoreEntry = list.find((s) => s.name === "corehub-app-store")!;
    expect(appStoreEntry.deps).toEqual(["extension-tier-policy"]);

    const warRoomEntry = list.find((s) => s.name === "war-room-orchestrator")!;
    expect(warRoomEntry.deps).toEqual(["cory-skill-synthesizer", "provider-runtime"]);

    const knowledgeScribeEntry = list.find((s) => s.name === "cory-knowledge-scribe")!;
    expect(knowledgeScribeEntry.deps).toEqual(["cory-memory", "cory-skill-synthesizer"]);

    const prWorkflowEntry = list.find((s) => s.name === "pr-workflow-orchestrator")!;
    expect(prWorkflowEntry.deps).toEqual(["tool-runtime", "war-room-orchestrator"]);
  });

  it("executes topological startAll() and reverse-order stopAll() with truthful health reporting", async () => {
    const microkernel = createMicrokernelServiceRegistry({
      stateDir: testDir,
      coryDir,
    });

    // 1. Initial health before start
    expect(microkernel.provider.health().status).toBe("down");
    expect(microkernel.rag.health().status).toBe("down");
    expect(microkernel.tool.health().status).toBe("down");
    expect(microkernel.browser.health().status).toBe("down");
    expect(microkernel.voice.health().status).toBe("down");
    expect(microkernel.cory.health().status).toBe("down");
    expect(microkernel.skillSynthesizer.health().status).toBe("down");
    expect(microkernel.tierPolicy.health().status).toBe("down");
    expect(microkernel.warRoom.health().status).toBe("down");
    expect(microkernel.knowledgeScribe.health().status).toBe("down");
    expect(microkernel.prWorkflow.health().status).toBe("down");

    // 2. Start all services in topological order
    const startResult = await microkernel.registry.startAll();
    expect(startResult.failed).toHaveLength(0);
    expect(startResult.started).toEqual([
      "provider-runtime",
      "rag-runtime",
      "tool-runtime",
      "browser-runtime",
      "voice-runtime",
      "cory-memory",
      "cory-skill-synthesizer",
      "extension-tier-policy",
      "corehub-app-store",
      "war-room-orchestrator",
      "cory-knowledge-scribe",
      "pr-workflow-orchestrator",
    ]);

    // 3. Verify health status after start
    expect(microkernel.rag.health().status).toBe("healthy");
    expect(microkernel.tool.health().status).toBe("healthy");
    expect(microkernel.browser.health().status).toBe("healthy");
    expect(microkernel.voice.health().status).toBe("healthy");
    expect(microkernel.cory.health().status).toBe("healthy");
    expect(microkernel.skillSynthesizer.health().status).toBe("healthy");
    expect(microkernel.tierPolicy.health().status).toBe("healthy");
    expect(microkernel.appStore.health().status).toBe("healthy");
    expect(microkernel.warRoom.health().status).toBe("healthy");
    expect(microkernel.knowledgeScribe.health().status).toBe("healthy");
    expect(microkernel.prWorkflow.health().status).toBe("healthy");

    // Provider registry without registered models reports truthful degradation
    expect(microkernel.provider.health().status).toBe("degraded");
    expect(microkernel.provider.health().detail).toBe("No AI model providers registered");

    // Register a mock provider and verify healthy status
    microkernel.provider.registry.register(
      { id: "mock", name: "Mock", chat: async () => ({}) as any },
      ["m1"],
    );
    expect(microkernel.provider.health().status).toBe("healthy");

    // 4. Stop all services in reverse-order
    const stopResult = await microkernel.registry.stopAll();
    expect(stopResult.failed).toHaveLength(0);

    const prWorkflowIndex = stopResult.stopped.indexOf("pr-workflow-orchestrator");
    const warRoomIndex = stopResult.stopped.indexOf("war-room-orchestrator");
    expect(prWorkflowIndex).toBeLessThan(warRoomIndex);

    const appStoreIndex = stopResult.stopped.indexOf("corehub-app-store");
    const tierPolicyIndex = stopResult.stopped.indexOf("extension-tier-policy");
    expect(appStoreIndex).toBeLessThan(tierPolicyIndex);

    const coryIndex = stopResult.stopped.indexOf("cory-memory");
    const providerIndex = stopResult.stopped.indexOf("provider-runtime");
    expect(coryIndex).toBeLessThan(providerIndex);

    const browserIndex = stopResult.stopped.indexOf("browser-runtime");
    const toolIndex = stopResult.stopped.indexOf("tool-runtime");
    expect(browserIndex).toBeLessThan(toolIndex);

    const knowledgeScribeIndex = stopResult.stopped.indexOf("cory-knowledge-scribe");
    const skillSynthesizerIndex = stopResult.stopped.indexOf("cory-skill-synthesizer");
    expect(knowledgeScribeIndex).toBeLessThan(skillSynthesizerIndex);

    // 5. Verify down status after stop
    expect(microkernel.provider.health().status).toBe("down");
    expect(microkernel.rag.health().status).toBe("down");
    expect(microkernel.tool.health().status).toBe("down");
    expect(microkernel.browser.health().status).toBe("down");
    expect(microkernel.voice.health().status).toBe("down");
    expect(microkernel.tierPolicy.health().status).toBe("down");
    expect(microkernel.appStore.health().status).toBe("down");
    expect(microkernel.warRoom.health().status).toBe("down");
    expect(microkernel.knowledgeScribe.health().status).toBe("down");
    expect(microkernel.prWorkflow.health().status).toBe("down");
  });

  it("handles GET /api/corehub/storefront and returns computed app cards with service health", async () => {
    const microkernel = createMicrokernelServiceRegistry({
      stateDir: testDir,
      coryDir,
    });
    await microkernel.registry.startAll();

    const { req, res, getResult } = createMockReqRes({
      method: "GET",
      url: "/api/corehub/storefront?tier=corehub_on_demand",
    });

    const handled = await handleCoreHubRoute(req, res, microkernel);
    expect(handled).toBe(true);

    const result = await getResult();
    expect(result.statusCode).toBe(200);
    expect(result.data.ok).toBe(true);
    expect(Array.isArray(result.data.apps)).toBe(true);
    expect(result.data.health.cory.status).toBe("healthy");
    expect(result.data.health.appStore.status).toBe("healthy");
    expect(result.data.health.tierPolicy.status).toBe("healthy");
    expect(result.data.health.rag.status).toBe("healthy");
    expect(result.data.health.knowledgeScribe.status).toBe("healthy");

    await microkernel.registry.stopAll();
  });

  describe("CoreHub Mutation Security & Scope Authorization", () => {
    it("rejects anonymous callers with 401 on POST /api/corehub/consent", async () => {
      const microkernel = createMicrokernelServiceRegistry({
        stateDir: testDir,
        coryDir,
      });
      await microkernel.registry.startAll();

      const { req, res, getResult } = createMockReqRes({
        method: "POST",
        url: "/api/corehub/consent",
        body: {
          pluginId: "discord",
          capabilities: ["network"],
        },
      });

      await handleCoreHubRoute(req, res, microkernel, { auth: testAuth });
      const result = await getResult();
      expect(result.statusCode).toBe(401);

      await microkernel.registry.stopAll();
    });

    it("rejects callers missing operator.admin scope with 403 on POST /api/corehub/consent", async () => {
      const microkernel = createMicrokernelServiceRegistry({
        stateDir: testDir,
        coryDir,
      });
      await microkernel.registry.startAll();

      const { req, res, getResult } = createMockReqRes({
        method: "POST",
        url: "/api/corehub/consent",
        headers: {
          authorization: "Bearer test-admin-secret-token",
          "x-coreblow-scopes": "operator.read",
        },
        body: {
          pluginId: "discord",
          capabilities: ["network"],
        },
      });

      await handleCoreHubRoute(req, res, microkernel, { auth: testAuth });
      const result = await getResult();
      expect(result.statusCode).toBe(403);
      expect(result.data.error.message).toContain("missing scope: operator.admin");

      await microkernel.registry.stopAll();
    });

    it("ensures manually spoofed x-coreblow-scopes: operator.admin cannot elevate an unprivileged identity", async () => {
      // 1. Unit test scope resolver contract
      const { req: spoofReq } = createMockReqRes({
        method: "POST",
        url: "/api/corehub/consent",
        headers: {
          "x-coreblow-scopes": "operator.admin",
        },
      });

      // An unprivileged request where established auth set trustDeclaredOperatorScopes: false
      const unprivilegedScopes = resolveCoreHubOperatorScopes(spoofReq, {
        authMethod: "unprivileged-identity" as any,
        trustDeclaredOperatorScopes: false,
      });
      // MUST NOT trust the declared scope and must return empty array
      expect(unprivilegedScopes).toEqual([]);

      // 2. Integration test via handleCoreHubRoute:
      // Even if attacker provides x-coreblow-scopes: operator.admin without valid credentials, they get 401
      const microkernel = createMicrokernelServiceRegistry({
        stateDir: testDir,
        coryDir,
      });
      await microkernel.registry.startAll();

      const {
        req: anonSpoofReq,
        res: anonSpoofRes,
        getResult: getAnonSpoofResult,
      } = createMockReqRes({
        method: "POST",
        url: "/api/corehub/consent",
        headers: {
          "x-coreblow-scopes": "operator.admin",
        },
        body: {
          pluginId: "discord",
          capabilities: ["network"],
        },
      });

      await handleCoreHubRoute(anonSpoofReq, anonSpoofRes, microkernel, { auth: testAuth });
      const anonResult = await getAnonSpoofResult();
      expect(anonResult.statusCode).toBe(401);

      await microkernel.registry.stopAll();
    });

    it("rejects untrusted cross-origin requests with 403 and never sets wildcard CORS", async () => {
      const microkernel = createMicrokernelServiceRegistry({
        stateDir: testDir,
        coryDir,
      });
      await microkernel.registry.startAll();

      const { req, res, getResult } = createMockReqRes({
        method: "POST",
        url: "/api/corehub/consent",
        headers: {
          authorization: "Bearer test-admin-secret-token",
          "x-coreblow-scopes": "operator.admin",
          origin: "https://evil-unauthorized-site.com",
        },
        body: {
          pluginId: "discord",
          capabilities: ["network"],
        },
      });

      await handleCoreHubRoute(req, res, microkernel, { auth: testAuth });
      const result = await getResult();
      expect(result.statusCode).toBe(403);
      expect(result.data.error).toBe("Origin not allowed");
      expect(result.headers["access-control-allow-origin"]).toBeUndefined();

      await microkernel.registry.stopAll();
    });

    it("authorizes valid admin callers, enforces non-wildcard CORS, and disregards caller body.operator", async () => {
      const microkernel = createMicrokernelServiceRegistry({
        stateDir: testDir,
        coryDir,
      });
      await microkernel.registry.startAll();

      // 1. Grant consent with spoofed body.operator: "untrusted-adversary"
      const {
        req: grantReq,
        res: grantRes,
        getResult: getGrantResult,
      } = createMockReqRes({
        method: "POST",
        url: "/api/corehub/consent",
        headers: {
          authorization: "Bearer test-admin-secret-token",
          "x-coreblow-scopes": "operator.admin",
          origin: "http://localhost:3000",
        },
        body: {
          pluginId: "discord",
          capabilities: ["network", "credentials"],
          operator: "untrusted-adversary",
        },
      });

      await handleCoreHubRoute(grantReq, grantRes, microkernel, { auth: testAuth });
      const grantResult = await getGrantResult();
      expect(grantResult.statusCode).toBe(200);
      expect(grantResult.data.ok).toBe(true);
      expect(grantResult.data.consent.approvedCapabilities).toEqual(["network", "credentials"]);

      // Verify origin is reflected without wildcard and Vary: Origin is present
      expect(grantResult.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
      expect(grantResult.headers["vary"]).toBe("Origin");

      // Verify stored operator identity in ledger came from auth, NOT body
      const consentRecord = microkernel.appStore.getConsentLedger().getConsent("discord");
      expect(consentRecord?.approvedCapabilities).toEqual(["network", "credentials"]);
      expect(consentRecord?.operator).toBe("gateway:token");
      expect(consentRecord?.operator).not.toBe("untrusted-adversary");

      // 2. Revoke consent with admin credentials
      const {
        req: revokeReq,
        res: revokeRes,
        getResult: getRevokeResult,
      } = createMockReqRes({
        method: "POST",
        url: "/api/corehub/consent",
        headers: {
          authorization: "Bearer test-admin-secret-token",
          "x-coreblow-scopes": "operator.admin",
        },
        body: {
          pluginId: "discord",
          action: "revoke",
        },
      });

      await handleCoreHubRoute(revokeReq, revokeRes, microkernel, { auth: testAuth });
      const revokeResult = await getRevokeResult();
      expect(revokeResult.statusCode).toBe(200);
      expect(revokeResult.data.ok).toBe(true);
      expect(revokeResult.data.revoked).toBe(true);
      expect(microkernel.appStore.getConsentLedger().getConsent("discord")).toBeNull();

      await microkernel.registry.stopAll();
    });

    it("protects POST /api/corehub/rollback with admin scope and allows authorized rollback", async () => {
      const microkernel = createMicrokernelServiceRegistry({
        stateDir: testDir,
        coryDir,
      });
      await microkernel.registry.startAll();

      // 1. Anonymous rollback -> 401
      const {
        req: anonReq,
        res: anonRes,
        getResult: getAnonResult,
      } = createMockReqRes({
        method: "POST",
        url: "/api/corehub/rollback",
        body: { pluginId: "telegram" },
      });
      await handleCoreHubRoute(anonReq, anonRes, microkernel, { auth: testAuth });
      expect((await getAnonResult()).statusCode).toBe(401);

      // 2. Unauthorized scope -> 403
      const {
        req: unauthReq,
        res: unauthRes,
        getResult: getUnauthResult,
      } = createMockReqRes({
        method: "POST",
        url: "/api/corehub/rollback",
        headers: {
          authorization: "Bearer test-admin-secret-token",
          "x-coreblow-scopes": "operator.read",
        },
        body: { pluginId: "telegram" },
      });
      await handleCoreHubRoute(unauthReq, unauthRes, microkernel, { auth: testAuth });
      expect((await getUnauthResult()).statusCode).toBe(403);

      // 3. Authorized rollback attempt without backup -> 400
      const {
        req: failingReq,
        res: failingRes,
        getResult: getFailingResult,
      } = createMockReqRes({
        method: "POST",
        url: "/api/corehub/rollback",
        headers: {
          authorization: "Bearer test-admin-secret-token",
          "x-coreblow-scopes": "operator.admin",
        },
        body: { pluginId: "telegram" },
      });
      await handleCoreHubRoute(failingReq, failingRes, microkernel, { auth: testAuth });
      const failingResult = await getFailingResult();
      expect(failingResult.statusCode).toBe(400);
      expect(failingResult.data.ok).toBe(false);

      // 4. Create an installed app snapshot and execute authorized rollback
      const pluginDir = path.join(testDir, "extensions", "telegram");
      fs.mkdirSync(pluginDir, { recursive: true });
      fs.writeFileSync(path.join(pluginDir, "index.js"), "console.log('v1.0.0');");

      microkernel.appStore.getLifecycleManager().transitionTo("telegram", "installed_disabled");
      microkernel.appStore.getLifecycleManager().transitionTo("telegram", "updating");
      microkernel.appStore.getLifecycleManager().snapshotBeforeUpdate("telegram", "1.0.0");

      // Overwrite with v2
      fs.writeFileSync(path.join(pluginDir, "index.js"), "console.log('v2.0.0');");
      microkernel.appStore.getLifecycleManager().transitionTo("telegram", "installed_disabled");

      // Successful rollback via endpoint
      const {
        req: successReq,
        res: successRes,
        getResult: getSuccessResult,
      } = createMockReqRes({
        method: "POST",
        url: "/api/corehub/rollback",
        headers: {
          authorization: "Bearer test-admin-secret-token",
          "x-coreblow-scopes": "operator.admin",
        },
        body: {
          pluginId: "telegram",
          targetVersion: "1.0.0",
        },
      });

      await handleCoreHubRoute(successReq, successRes, microkernel, { auth: testAuth });
      const successResult = await getSuccessResult();
      expect(successResult.statusCode).toBe(200);
      expect(successResult.data.ok).toBe(true);

      const restoredCode = fs.readFileSync(path.join(pluginDir, "index.js"), "utf8");
      expect(restoredCode).toBe("console.log('v1.0.0');");

      await microkernel.registry.stopAll();
    });

    it("handles OPTIONS preflight for privileged mutations with exact reflected origin and Vary: Origin, and public storefront with wildcard", async () => {
      const microkernel = createMicrokernelServiceRegistry({
        stateDir: testDir,
        coryDir,
      });
      await microkernel.registry.startAll();

      // 1. Mutation preflight with valid origin
      const {
        req: optReq,
        res: optRes,
        getResult: getOptResult,
      } = createMockReqRes({
        method: "OPTIONS",
        url: "/api/corehub/consent",
        headers: {
          origin: "http://localhost:3000",
          host: "localhost:3000",
        },
      });
      await handleCoreHubRoute(optReq, optRes, microkernel, { auth: testAuth });
      const optResult = await getOptResult();
      expect(optResult.statusCode).toBe(204);
      expect(optResult.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
      expect(optResult.headers["vary"]).toBe("Origin");
      expect(optResult.headers["access-control-allow-methods"]).toBe("POST, OPTIONS");

      // 2. Public read-only storefront (intentionally public wildcard CORS for dashboard discovery)
      const {
        req: storeReq,
        res: storeRes,
        getResult: getStoreResult,
      } = createMockReqRes({
        method: "GET",
        url: "/api/corehub/storefront",
      });
      await handleCoreHubRoute(storeReq, storeRes, microkernel, { auth: testAuth });
      const storeResult = await getStoreResult();
      expect(storeResult.statusCode).toBe(200);
      expect(storeResult.headers["access-control-allow-origin"]).toBe("*");

      await microkernel.registry.stopAll();
    });

    it("handles GET /api/corehub/skills/learned with scope authorization and filtering", async () => {
      const microkernel = createMicrokernelServiceRegistry({
        stateDir: testDir,
        coryDir,
      });
      await microkernel.registry.startAll();

      // 1. Unauthenticated request rejected with 401
      const {
        req: unauthReq,
        res: unauthRes,
        getResult: getUnauthResult,
      } = createMockReqRes({
        method: "GET",
        url: "/api/corehub/skills/learned",
      });
      await handleCoreHubRoute(unauthReq, unauthRes, microkernel, { auth: testAuth });
      const unauthResult = await getUnauthResult();
      expect(unauthResult.statusCode).toBe(401);

      // 2. Authenticated request with READ_SCOPE returns 200 and empty list initially
      const {
        req: authReq,
        res: authRes,
        getResult: getAuthResult,
      } = createMockReqRes({
        method: "GET",
        url: "/api/corehub/skills/learned",
        headers: {
          authorization: "Bearer test-admin-secret-token",
          "x-coreblow-scopes": "operator.read",
        },
      });
      await handleCoreHubRoute(authReq, authRes, microkernel, { auth: testAuth });
      const authResult = await getAuthResult();
      expect(authResult.statusCode).toBe(200);
      expect(authResult.data.ok).toBe(true);
      expect(authResult.data.count).toBe(0);
      expect(Array.isArray(authResult.data.skills)).toBe(true);

      await microkernel.registry.stopAll();
    });

    it("handles POST /api/corehub/skills/ingest: rejects Zone 0 and ingests valid trajectories", async () => {
      const microkernel = createMicrokernelServiceRegistry({
        stateDir: testDir,
        coryDir,
      });
      await microkernel.registry.startAll();

      // 1. Zone 0 public channel trajectory rejected with 403
      const {
        req: zone0Req,
        res: zone0Res,
        getResult: getZone0Result,
      } = createMockReqRes({
        method: "POST",
        url: "/api/corehub/skills/ingest",
        headers: {
          authorization: "Bearer test-admin-secret-token",
          "x-coreblow-scopes": "operator.admin",
        },
        body: {
          trajectory: {
            id: "traj-zone-0",
            sessionId: "sess-1",
            userGoal: "Public channel action",
            userScope: "public",
            workspaceId: "ws-pub",
            trustZone: "public",
            isPublicChannel: true,
            steps: [
              {
                toolName: "run_command",
                commandSummary: "pnpm test",
                succeeded: false,
                outputSummary: "FAIL",
                durationMs: 100,
              },
              {
                toolName: "run_command",
                commandSummary: "pnpm test:fix",
                succeeded: true,
                outputSummary: "PASS",
                durationMs: 100,
              },
            ],
            succeeded: true,
            correctionDetails: "Use test fix command instead of raw test run",
            timestampMs: Date.now(),
          },
        },
      });
      await handleCoreHubRoute(zone0Req, zone0Res, microkernel, { auth: testAuth });
      const zone0Result = await getZone0Result();
      expect(zone0Result.statusCode).toBe(403);
      expect(zone0Result.data.ok).toBe(false);
      expect(zone0Result.data.code).toBe("ZONE_0_BLOCKED");

      // 2. Valid operator trajectory synthesizes skill candidate with 200
      const {
        req: validReq,
        res: validRes,
        getResult: getValidResult,
      } = createMockReqRes({
        method: "POST",
        url: "/api/corehub/skills/ingest",
        headers: {
          authorization: "Bearer test-admin-secret-token",
          "x-coreblow-scopes": "operator.admin",
        },
        body: {
          trajectory: {
            id: "traj-valid-1",
            sessionId: "sess-valid",
            userGoal: "Fix hanging vitest runner in CI",
            userScope: "operator",
            workspaceId: "ws-valid",
            trustZone: "operator",
            isPublicChannel: false,
            steps: [
              {
                toolName: "run_command",
                commandSummary: "pnpm exec vitest",
                succeeded: false,
                outputSummary: "hanging interactive prompt",
                durationMs: 15000,
              },
              {
                toolName: "run_command",
                commandSummary: "./node_modules/.bin/vitest run",
                succeeded: true,
                outputSummary: "Tests 10 passed",
                durationMs: 1200,
              },
            ],
            succeeded: true,
            correctionDetails: "Invoke local vitest binary directly to bypass corepack prompts",
            timestampMs: Date.now(),
          },
        },
      });
      await handleCoreHubRoute(validReq, validRes, microkernel, { auth: testAuth });
      const validResult = await getValidResult();
      expect(validResult.statusCode).toBe(200);
      expect(validResult.data.ok).toBe(true);
      expect(validResult.data.skill.id).toBeDefined();

      // 3. Verify GET /api/corehub/skills/learned now returns the newly synthesized skill
      const {
        req: listReq,
        res: listRes,
        getResult: getListResult,
      } = createMockReqRes({
        method: "GET",
        url: "/api/corehub/skills/learned",
        headers: {
          authorization: "Bearer test-admin-secret-token",
          "x-coreblow-scopes": "operator.read",
        },
      });
      await handleCoreHubRoute(listReq, listRes, microkernel, { auth: testAuth });
      const listResult = await getListResult();
      expect(listResult.statusCode).toBe(200);
      expect(listResult.data.count).toBe(1);
      expect(listResult.data.skills[0].id).toBe(validResult.data.skill.id);

      await microkernel.registry.stopAll();
    });

    it("handles POST /api/corehub/skills/outcome: records fitness metrics and supports auto-promotion", async () => {
      const microkernel = createMicrokernelServiceRegistry({
        stateDir: testDir,
        coryDir,
      });
      await microkernel.registry.startAll();

      // 1. Synthesize a skill first
      const {
        req: ingestReq,
        res: ingestRes,
        getResult: getIngestResult,
      } = createMockReqRes({
        method: "POST",
        url: "/api/corehub/skills/ingest",
        headers: {
          authorization: "Bearer test-admin-secret-token",
          "x-coreblow-scopes": "operator.admin",
        },
        body: {
          trajectory: {
            id: "traj-outcome-1",
            sessionId: "sess-outcome",
            userGoal: "Clean node module lockfile contention",
            userScope: "operator",
            workspaceId: "ws-outcome",
            trustZone: "operator",
            isPublicChannel: false,
            steps: [
              {
                toolName: "run_command",
                commandSummary: "pnpm install",
                succeeded: false,
                outputSummary: "lockfile contention",
                durationMs: 500,
              },
              {
                toolName: "run_command",
                commandSummary: "pnpm install --frozen-lockfile",
                succeeded: true,
                outputSummary: "install complete",
                durationMs: 200,
              },
            ],
            succeeded: true,
            correctionDetails: "Use frozen lockfile parameter for repeatable installation",
            timestampMs: Date.now(),
          },
        },
      });
      await handleCoreHubRoute(ingestReq, ingestRes, microkernel, { auth: testAuth });
      const ingestResult = await getIngestResult();
      expect(ingestResult.statusCode).toBe(200);
      const skillId = ingestResult.data.skill.id;

      // 2. Record outcome via POST /api/corehub/skills/outcome
      const {
        req: outcomeReq,
        res: outcomeRes,
        getResult: getOutcomeResult,
      } = createMockReqRes({
        method: "POST",
        url: "/api/corehub/skills/outcome",
        headers: {
          authorization: "Bearer test-admin-secret-token",
          "x-coreblow-scopes": "operator.admin",
        },
        body: {
          skillId,
          outcome: "success",
        },
      });
      await handleCoreHubRoute(outcomeReq, outcomeRes, microkernel, { auth: testAuth });
      const outcomeResult = await getOutcomeResult();
      expect(outcomeResult.statusCode).toBe(200);
      expect(outcomeResult.data.ok).toBe(true);
      expect(outcomeResult.data.skillId).toBe(skillId);
      expect(outcomeResult.data.fitness.totalInvocations).toBe(1);

      // 3. Test non-existent skill returns 404
      const {
        req: missingReq,
        res: missingRes,
        getResult: getMissingResult,
      } = createMockReqRes({
        method: "POST",
        url: "/api/corehub/skills/outcome",
        headers: {
          authorization: "Bearer test-admin-secret-token",
          "x-coreblow-scopes": "operator.admin",
        },
        body: {
          skillId: "non-existent-skill",
          outcome: "success",
        },
      });
      await handleCoreHubRoute(missingReq, missingRes, microkernel, { auth: testAuth });
      const missingResult = await getMissingResult();
      expect(missingResult.statusCode).toBe(404);

      await microkernel.registry.stopAll();
    });

    it("handles War Room endpoints: list, create, delegate, and fork", async () => {
      const microkernel = createMicrokernelServiceRegistry({
        stateDir: testDir,
        coryDir,
      });
      await microkernel.registry.startAll();

      // 1. GET /api/corehub/war-room/rooms returns empty list initially
      const {
        req: listReq1,
        res: listRes1,
        getResult: getListResult1,
      } = createMockReqRes({
        method: "GET",
        url: "/api/corehub/war-room/rooms",
        headers: {
          authorization: "Bearer test-admin-secret-token",
        },
      });
      await handleCoreHubRoute(listReq1, listRes1, microkernel, { auth: testAuth });
      const listResult1 = await getListResult1();
      expect(listResult1.statusCode).toBe(200);
      expect(listResult1.data.ok).toBe(true);
      expect(listResult1.data.count).toBe(0);

      // 2. POST /api/corehub/war-room/rooms creates a new room
      const {
        req: createReq,
        res: createRes,
        getResult: getCreateResult,
      } = createMockReqRes({
        method: "POST",
        url: "/api/corehub/war-room/rooms",
        headers: {
          authorization: "Bearer test-admin-secret-token",
          "x-coreblow-scopes": "operator.admin",
        },
        body: {
          roomId: "room-stage6",
          title: "Stage 6 Architecture War Room",
          purpose: "Coordinate microkernel and multi-agent implementation",
        },
      });
      await handleCoreHubRoute(createReq, createRes, microkernel, { auth: testAuth });
      const createResult = await getCreateResult();
      expect(createResult.statusCode).toBe(200);
      expect(createResult.data.ok).toBe(true);
      expect(createResult.data.roomId).toBe("room-stage6");
      expect(createResult.data.room.members).toHaveLength(5);

      // 3. POST /api/corehub/war-room/delegate routes message via lead
      const {
        req: delegateReq,
        res: delegateRes,
        getResult: getDelegateResult,
      } = createMockReqRes({
        method: "POST",
        url: "/api/corehub/war-room/delegate",
        headers: {
          authorization: "Bearer test-admin-secret-token",
          "x-coreblow-scopes": "operator.admin",
        },
        body: {
          roomId: "room-stage6",
          prompt: "Please implement and refactor the core TypeScript gateway service",
        },
      });
      await handleCoreHubRoute(delegateReq, delegateRes, microkernel, { auth: testAuth });
      const delegateResult = await getDelegateResult();
      expect(delegateResult.statusCode).toBe(200);
      expect(delegateResult.data.ok).toBe(true);
      expect(delegateResult.data.delegatedToAgentId).toBe("agent-coder");
      expect(delegateResult.data.kanbanCard.column).toBe("in_progress");

      // 4. POST /api/corehub/war-room/fork forks sibling thread
      const {
        req: forkReq,
        res: forkRes,
        getResult: getForkResult,
      } = createMockReqRes({
        method: "POST",
        url: "/api/corehub/war-room/fork",
        headers: {
          authorization: "Bearer test-admin-secret-token",
          "x-coreblow-scopes": "operator.admin",
        },
        body: {
          roomId: "room-stage6",
          topicTitle: "Investigation of memory consumption",
        },
      });
      await handleCoreHubRoute(forkReq, forkRes, microkernel, { auth: testAuth });
      const forkResult = await getForkResult();
      expect(forkResult.statusCode).toBe(200);
      expect(forkResult.data.ok).toBe(true);
      expect(forkResult.data.parentRoomId).toBe("room-stage6");
      expect(forkResult.data.forkedThreadId).toBeDefined();

      // 5. GET /api/corehub/war-room/rooms now lists both rooms
      const {
        req: listReq2,
        res: listRes2,
        getResult: getListResult2,
      } = createMockReqRes({
        method: "GET",
        url: "/api/corehub/war-room/rooms",
        headers: {
          authorization: "Bearer test-admin-secret-token",
        },
      });
      await handleCoreHubRoute(listReq2, listRes2, microkernel, { auth: testAuth });
      const listResult2 = await getListResult2();
      expect(listResult2.statusCode).toBe(200);
      expect(listResult2.data.count).toBe(2);

      await microkernel.registry.stopAll();
    });

    it("handles POST /api/corehub/skills/lock endpoint", async () => {
      const microkernel = createMicrokernelServiceRegistry({
        stateDir: testDir,
        coryDir,
      });
      await microkernel.registry.startAll();

      // Duck-type or mock setSkillLock on skillSynthesizer for test if not already present
      (microkernel.skillSynthesizer as any).setSkillLock = async (
        skillId: string,
        locked: boolean,
      ) => {
        if (skillId === "missing-skill") {
          throw new Error("SKILL_NOT_FOUND: missing-skill");
        }
        return {
          id: skillId,
          name: "Test Skill",
          status: "verified_active",
          locked,
        };
      };

      // 1. Lock an existing skill
      const {
        req: lockReq,
        res: lockRes,
        getResult: getLockResult,
      } = createMockReqRes({
        method: "POST",
        url: "/api/corehub/skills/lock",
        headers: {
          authorization: "Bearer test-admin-secret-token",
          "x-coreblow-scopes": "operator.admin",
        },
        body: {
          skillId: "skill-123",
          locked: true,
        },
      });
      await handleCoreHubRoute(lockReq, lockRes, microkernel, { auth: testAuth });
      const lockResult = await getLockResult();
      expect(lockResult.statusCode).toBe(200);
      expect(lockResult.data.ok).toBe(true);
      expect(lockResult.data.skillId).toBe("skill-123");
      expect(lockResult.data.locked).toBe(true);

      // 2. Non-existent skill returns 404
      const {
        req: missingReq,
        res: missingRes,
        getResult: getMissingResult,
      } = createMockReqRes({
        method: "POST",
        url: "/api/corehub/skills/lock",
        headers: {
          authorization: "Bearer test-admin-secret-token",
          "x-coreblow-scopes": "operator.admin",
        },
        body: {
          skillId: "missing-skill",
          locked: true,
        },
      });
      await handleCoreHubRoute(missingReq, missingRes, microkernel, { auth: testAuth });
      const missingResult = await getMissingResult();
      expect(missingResult.statusCode).toBe(404);

      await microkernel.registry.stopAll();
    });

    it("handles Memory Wiki and Scribe endpoints", async () => {
      const microkernel = createMicrokernelServiceRegistry({
        stateDir: testDir,
        coryDir,
      });
      await microkernel.registry.startAll();

      // 1. GET /api/corehub/memory-wiki returns snapshot with pages and auditPanel
      const {
        req: wikiReq,
        res: wikiRes,
        getResult: getWikiResult,
      } = createMockReqRes({
        method: "GET",
        url: "/api/corehub/memory-wiki",
        headers: {
          authorization: "Bearer test-admin-secret-token",
        },
      });
      await handleCoreHubRoute(wikiReq, wikiRes, microkernel, { auth: testAuth });
      const wikiResult = await getWikiResult();
      expect(wikiResult.statusCode).toBe(200);
      expect(wikiResult.data.ok).toBe(true);
      expect(Array.isArray(wikiResult.data.pages)).toBe(true);
      expect(wikiResult.data.auditPanel).toBeDefined();
      expect(typeof wikiResult.data.auditPanel.totalPages).toBe("number");

      // 2. POST /api/corehub/memory-wiki/scribe validation error on missing title
      const {
        req: invalidScribeReq,
        res: invalidScribeRes,
        getResult: getInvalidScribeResult,
      } = createMockReqRes({
        method: "POST",
        url: "/api/corehub/memory-wiki/scribe",
        headers: {
          authorization: "Bearer test-admin-secret-token",
          "x-coreblow-scopes": "operator.admin",
        },
        body: {
          sessionId: "sess-1",
        },
      });
      await handleCoreHubRoute(invalidScribeReq, invalidScribeRes, microkernel, { auth: testAuth });
      const invalidScribeResult = await getInvalidScribeResult();
      expect(invalidScribeResult.statusCode).toBe(400);

      // 3. POST /api/corehub/memory-wiki/scribe Zone 0 rejection (trustZone: "public")
      const {
        req: zone0Req,
        res: zone0Res,
        getResult: getZone0Result,
      } = createMockReqRes({
        method: "POST",
        url: "/api/corehub/memory-wiki/scribe",
        headers: {
          authorization: "Bearer test-admin-secret-token",
          "x-coreblow-scopes": "operator.admin",
        },
        body: {
          sessionId: "sess-public",
          title: "Public Note",
          scope: {
            trustZone: "public",
          },
          insights: ["Public chatter"],
        },
      });
      await handleCoreHubRoute(zone0Req, zone0Res, microkernel, { auth: testAuth });
      const zone0Result = await getZone0Result();
      expect(zone0Result.statusCode).toBe(403);
      expect(zone0Result.data.ok).toBe(false);
      expect(zone0Result.data.error).toContain("ZONE_0_BLOCKED");

      // 4. POST /api/corehub/memory-wiki/scribe successful capture
      const {
        req: scribeReq,
        res: scribeRes,
        getResult: getScribeResult,
      } = createMockReqRes({
        method: "POST",
        url: "/api/corehub/memory-wiki/scribe",
        headers: {
          authorization: "Bearer test-admin-secret-token",
          "x-coreblow-scopes": "operator.admin",
        },
        body: {
          sessionId: "sess-trusted",
          title: "Architecture Scribe Note",
          category: "architecture",
          insights: ["Deterministic caching stabilizes inference tokens"],
          decisions: ["Adopted SHA-256 tool definitions hash"],
          constraints: ["Never leak secrets in workspace import"],
        },
      });
      await handleCoreHubRoute(scribeReq, scribeRes, microkernel, { auth: testAuth });
      const scribeResult = await getScribeResult();
      expect(scribeResult.statusCode).toBe(200);
      expect(scribeResult.data.ok).toBe(true);
      expect(scribeResult.data.page.title).toBe("Architecture Scribe Note");
      expect(scribeResult.data.page.slug).toBe("architecture-scribe-note");

      await microkernel.registry.stopAll();
    });

    it("handles Universal Agent Importer endpoint (preview and apply)", async () => {
      const microkernel = createMicrokernelServiceRegistry({
        stateDir: testDir,
        coryDir,
      });
      await microkernel.registry.startAll();

      // Create a test workspace folder with CLAUDE.md
      const sampleWorkspace = path.join(testDir, "test-import-workspace");
      fs.mkdirSync(sampleWorkspace, { recursive: true });
      fs.writeFileSync(
        path.join(sampleWorkspace, "CLAUDE.md"),
        "# CoreBlow Guidelines\n\n- Never run untrusted code without audit.\n- Always keep API keys private.\n",
        "utf8",
      );

      // 1. Validation error on missing source
      const {
        req: invalidImportReq,
        res: invalidImportRes,
        getResult: getInvalidImportResult,
      } = createMockReqRes({
        method: "POST",
        url: "/api/corehub/import-agent",
        headers: {
          authorization: "Bearer test-admin-secret-token",
          "x-coreblow-scopes": "operator.admin",
        },
        body: {
          sourceDir: sampleWorkspace,
        },
      });
      await handleCoreHubRoute(invalidImportReq, invalidImportRes, microkernel, { auth: testAuth });
      const invalidImportResult = await getInvalidImportResult();
      expect(invalidImportResult.statusCode).toBe(400);

      // 2. Dry-run preview import
      const {
        req: previewReq,
        res: previewRes,
        getResult: getPreviewResult,
      } = createMockReqRes({
        method: "POST",
        url: "/api/corehub/import-agent",
        headers: {
          authorization: "Bearer test-admin-secret-token",
          "x-coreblow-scopes": "operator.admin",
        },
        body: {
          source: "claude-code",
          sourceDir: sampleWorkspace,
          dryRun: true,
        },
      });
      await handleCoreHubRoute(previewReq, previewRes, microkernel, { auth: testAuth });
      const previewResult = await getPreviewResult();
      expect(previewResult.statusCode).toBe(200);
      expect(previewResult.data.ok).toBe(true);
      expect(previewResult.data.bundle.dryRun).toBe(true);
      expect(previewResult.data.bundle.source).toBe("claude-code");

      // 3. Apply import (dryRun: false)
      const {
        req: applyReq,
        res: applyRes,
        getResult: getApplyResult,
      } = createMockReqRes({
        method: "POST",
        url: "/api/corehub/import-agent",
        headers: {
          authorization: "Bearer test-admin-secret-token",
          "x-coreblow-scopes": "operator.admin",
        },
        body: {
          source: "claude-code",
          sourceDir: sampleWorkspace,
          dryRun: false,
        },
      });
      await handleCoreHubRoute(applyReq, applyRes, microkernel, { auth: testAuth });
      const applyResult = await getApplyResult();
      expect(applyResult.statusCode).toBe(200);
      expect(applyResult.data.ok).toBe(true);
      expect(applyResult.data.bundle.dryRun).toBe(false);

      await microkernel.registry.stopAll();
    });
  });

  describe("Autonomous Git & PR Workflow & Chat Views CoreHub Endpoints", () => {
    it("handles GET /api/corehub/pr-workflow/drafts and filters by workspaceId", async () => {
      const microkernel = createMicrokernelServiceRegistry({
        stateDir: testDir,
        coryDir,
      });
      await microkernel.registry.startAll();

      // Unauthorized request should fail with 401
      const {
        req: unauthReq,
        res: unauthRes,
        getResult: getUnauthResult,
      } = createMockReqRes({
        method: "GET",
        url: "/api/corehub/pr-workflow/drafts",
      });
      await handleCoreHubRoute(unauthReq, unauthRes, microkernel, { auth: testAuth });
      const unauthResult = await getUnauthResult();
      expect(unauthResult.statusCode).toBe(401);

      // Authenticated request should return empty list initially
      const { req, res, getResult } = createMockReqRes({
        method: "GET",
        url: "/api/corehub/pr-workflow/drafts",
        headers: {
          authorization: "Bearer test-admin-secret-token",
          "x-coreblow-scopes": "operator.read",
        },
      });
      await handleCoreHubRoute(req, res, microkernel, { auth: testAuth });
      const result = await getResult();
      expect(result.statusCode).toBe(200);
      expect(result.data.ok).toBe(true);
      expect(result.data.drafts).toEqual([]);

      // Create a draft directly in service
      microkernel.prWorkflow.createPullRequestDraft({
        workspaceId: "ws-target",
        sourceBranch: "feat/sample",
        title: "Sample PR",
        description: "A sample PR",
        changedFiles: ["src/index.ts"],
        diffText: "+const x = 1;",
      });

      // Filter by workspace
      const {
        req: wsReq,
        res: wsRes,
        getResult: getWsResult,
      } = createMockReqRes({
        method: "GET",
        url: "/api/corehub/pr-workflow/drafts?workspaceId=ws-target",
        headers: {
          authorization: "Bearer test-admin-secret-token",
          "x-coreblow-scopes": "operator.read",
        },
      });
      await handleCoreHubRoute(wsReq, wsRes, microkernel, { auth: testAuth });
      const wsResult = await getWsResult();
      expect(wsResult.statusCode).toBe(200);
      expect(wsResult.data.ok).toBe(true);
      expect(wsResult.data.drafts).toHaveLength(1);
      expect(wsResult.data.drafts[0].title).toBe("Sample PR");

      // Query non-matching workspace
      const {
        req: otherReq,
        res: otherRes,
        getResult: getOtherResult,
      } = createMockReqRes({
        method: "GET",
        url: "/api/corehub/pr-workflow/drafts?workspaceId=ws-other",
        headers: {
          authorization: "Bearer test-admin-secret-token",
          "x-coreblow-scopes": "operator.read",
        },
      });
      await handleCoreHubRoute(otherReq, otherRes, microkernel, { auth: testAuth });
      const otherResult = await getOtherResult();
      expect(otherResult.statusCode).toBe(200);
      expect(otherResult.data.drafts).toHaveLength(0);

      await microkernel.registry.stopAll();
    });

    it("handles POST /api/corehub/pr-workflow/drafts and POST /api/corehub/pr-workflow/approve", async () => {
      const microkernel = createMicrokernelServiceRegistry({
        stateDir: testDir,
        coryDir,
      });
      await microkernel.registry.startAll();

      // 1. Zone 0 rejection
      const {
        req: zone0Req,
        res: zone0Res,
        getResult: getZone0Result,
      } = createMockReqRes({
        method: "POST",
        url: "/api/corehub/pr-workflow/drafts",
        headers: {
          authorization: "Bearer test-admin-secret-token",
          "x-coreblow-scopes": "operator.admin",
        },
        body: {
          title: "Public PR",
          sourceBranch: "feat/public",
          changedFiles: ["src/index.ts"],
          diffText: "+const z = 1;",
          trustZone: "public",
        },
      });
      await handleCoreHubRoute(zone0Req, zone0Res, microkernel, { auth: testAuth });
      const zone0Result = await getZone0Result();
      expect(zone0Result.statusCode).toBe(403);
      expect(zone0Result.data.ok).toBe(false);
      expect(zone0Result.data.error).toContain("ZONE_0_BLOCKED");

      // 2. Successful creation of ready_for_review draft
      const {
        req: createReq,
        res: createRes,
        getResult: getCreateResult,
      } = createMockReqRes({
        method: "POST",
        url: "/api/corehub/pr-workflow/drafts",
        headers: {
          authorization: "Bearer test-admin-secret-token",
          "x-coreblow-scopes": "operator.admin",
        },
        body: {
          workspaceId: "ws-dev",
          title: "Add Microkernel Service",
          description: "Wires PR workflow into microkernel",
          sourceBranch: "feat/m3",
          targetBranch: "main",
          changedFiles: ["src/service.ts"],
          diffText: "+export const service = 'ready';",
          testPassed: true,
          typecheckPassed: true,
          lintPassed: true,
        },
      });
      await handleCoreHubRoute(createReq, createRes, microkernel, { auth: testAuth });
      const createResult = await getCreateResult();
      expect(createResult.statusCode).toBe(201);
      expect(createResult.data.ok).toBe(true);
      expect(createResult.data.draft.status).toBe("ready_for_review");
      expect(createResult.data.draft.allChecksPassed).toBe(true);

      const prId = createResult.data.draft.prId;

      // 3. Successful approval of verified draft
      const {
        req: approveReq,
        res: approveRes,
        getResult: getApproveResult,
      } = createMockReqRes({
        method: "POST",
        url: "/api/corehub/pr-workflow/approve",
        headers: {
          authorization: "Bearer test-admin-secret-token",
          "x-coreblow-scopes": "operator.admin",
        },
        body: {
          prId,
          approverId: "lead-engineer",
        },
      });
      await handleCoreHubRoute(approveReq, approveRes, microkernel, { auth: testAuth });
      const approveResult = await getApproveResult();
      expect(approveResult.statusCode).toBe(200);
      expect(approveResult.data.ok).toBe(true);
      expect(approveResult.data.draft.status).toBe("approved");

      // 4. Create blocked draft (failing tests)
      const {
        req: failReq,
        res: failRes,
        getResult: getFailResult,
      } = createMockReqRes({
        method: "POST",
        url: "/api/corehub/pr-workflow/drafts",
        headers: {
          authorization: "Bearer test-admin-secret-token",
          "x-coreblow-scopes": "operator.admin",
        },
        body: {
          title: "Failing PR",
          sourceBranch: "feat/broken",
          changedFiles: ["src/fail.ts"],
          diffText: "+const broken = true;",
          testPassed: false,
        },
      });
      await handleCoreHubRoute(failReq, failRes, microkernel, { auth: testAuth });
      const failResult = await getFailResult();
      expect(failResult.statusCode).toBe(201);
      expect(failResult.data.draft.status).toBe("blocked");

      // 5. Refuse approval on blocked draft
      const {
        req: rejectApproveReq,
        res: rejectApproveRes,
        getResult: getRejectApproveResult,
      } = createMockReqRes({
        method: "POST",
        url: "/api/corehub/pr-workflow/approve",
        headers: {
          authorization: "Bearer test-admin-secret-token",
          "x-coreblow-scopes": "operator.admin",
        },
        body: {
          prId: failResult.data.draft.prId,
          approverId: "lead-engineer",
        },
      });
      await handleCoreHubRoute(rejectApproveReq, rejectApproveRes, microkernel, { auth: testAuth });
      const rejectApproveResult = await getRejectApproveResult();
      expect(rejectApproveResult.statusCode).toBe(400);
      expect(rejectApproveResult.data.ok).toBe(false);
      expect(rejectApproveResult.data.error).toContain("PR_GATE_BLOCKED");

      await microkernel.registry.stopAll();
    });

    it("handles POST /api/corehub/chat-views/render and produces multi-surface views", async () => {
      const microkernel = createMicrokernelServiceRegistry({
        stateDir: testDir,
        coryDir,
      });
      await microkernel.registry.startAll();

      const { req, res, getResult } = createMockReqRes({
        method: "POST",
        url: "/api/corehub/chat-views/render",
        headers: {
          authorization: "Bearer test-admin-secret-token",
          "x-coreblow-scopes": "operator.admin",
        },
        body: {
          viewId: "view-pr-1",
          pluginId: "pr-workflow-orchestrator",
          viewType: "pr_scorecard",
          title: "PR #42 Pre-Flight Scorecard",
          subtitle: "Automated Verification",
          fields: [
            { label: "Status", value: "Ready for Review", badge: "ok" },
            { label: "Gates", value: "5/5 Passed", badge: "ok" },
          ],
          actions: [
            {
              id: "approve-action",
              label: "Approve PR",
              actionUrlOrCommand: "/api/corehub/pr-workflow/approve",
              style: "primary",
            },
          ],
          updatedAtMs: 1714000000000,
        },
      });

      await handleCoreHubRoute(req, res, microkernel, { auth: testAuth });
      const result = await getResult();
      expect(result.statusCode).toBe(200);
      expect(result.data.ok).toBe(true);
      expect(result.data.rendered.markdownCard).toContain("PR #42 Pre-Flight Scorecard");
      expect(result.data.rendered.markdownCard).toContain("- **Status:** Ready for Review [OK]");
      expect(result.data.rendered.cockpitHtmlSnippet).toContain("coreblow-chat-view");
      expect(result.data.rendered.structuredBlocks.viewId).toBe("view-pr-1");

      await microkernel.registry.stopAll();
    });
  });

  describe("Sovereign Release Readiness Endpoint Integration", () => {
    it("handles GET /api/corehub/release/readiness with 100% healthy microkernel and returns valid manifest", async () => {
      const microkernel = createMicrokernelServiceRegistry({
        stateDir: testDir,
        coryDir,
      });
      await microkernel.registry.startAll();
      microkernel.provider.registry.register(
        { id: "mock", name: "Mock", chat: async () => ({}) as any },
        ["m1"],
      );

      const { req, res, getResult } = createMockReqRes({
        method: "GET",
        url: "/api/corehub/release/readiness",
      });

      const handled = await handleCoreHubRoute(req, res, microkernel);
      expect(handled).toBe(true);

      const result = await getResult();
      expect(result.statusCode).toBe(200);
      expect(result.data.ok).toBe(true);
      expect(result.data.manifest).toBeDefined();

      const manifest = result.data.manifest;
      expect(manifest.product).toBe("CoreBlow Sovereign Agent-OS");
      expect(manifest.version).toBe("2.0.0");
      expect(manifest.releaseChannel).toBe("ga");
      expect(manifest.totalKernelServices).toBe(12);
      expect(manifest.kernelServiceNames).toHaveLength(12);
      expect(manifest.allGatesPassed).toBe(true);
      expect(manifest.manifestSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(manifest.gateResults).toHaveLength(5);

      const healthGate = manifest.gateResults.find(
        (g: { gate: string; passed: boolean }) => g.gate === "microkernel_health",
      );
      expect(healthGate?.passed).toBe(true);

      await microkernel.registry.stopAll();
    });

    it("handles GET /api/corehub/v2/release/readiness alias route identically", async () => {
      const microkernel = createMicrokernelServiceRegistry({
        stateDir: testDir,
        coryDir,
      });
      await microkernel.registry.startAll();
      microkernel.provider.registry.register(
        { id: "mock", name: "Mock", chat: async () => ({}) as any },
        ["m1"],
      );

      const { req, res, getResult } = createMockReqRes({
        method: "GET",
        url: "/api/corehub/v2/release/readiness",
      });

      const handled = await handleCoreHubRoute(req, res, microkernel);
      expect(handled).toBe(true);

      const result = await getResult();
      expect(result.statusCode).toBe(200);
      expect(result.data.ok).toBe(true);
      expect(result.data.manifest.allGatesPassed).toBe(true);
      expect(result.data.manifest.product).toBe("CoreBlow Sovereign Agent-OS");

      await microkernel.registry.stopAll();
    });

    it("fails microkernel_health gate when a required service is down or degraded", async () => {
      const microkernel = createMicrokernelServiceRegistry({
        stateDir: testDir,
        coryDir,
      });
      await microkernel.registry.startAll();

      // Intentionally stop one required service
      await microkernel.registry.stop("rag-runtime");

      const { req, res, getResult } = createMockReqRes({
        method: "GET",
        url: "/api/corehub/release/readiness",
      });

      const handled = await handleCoreHubRoute(req, res, microkernel);
      expect(handled).toBe(true);

      const result = await getResult();
      expect(result.statusCode).toBe(200);
      expect(result.data.ok).toBe(true);
      expect(result.data.manifest.allGatesPassed).toBe(false);

      const healthGate = result.data.manifest.gateResults.find(
        (g: { gate: string }) => g.gate === "microkernel_health",
      );
      expect(healthGate?.passed).toBe(false);
      expect(
        healthGate?.violations?.some((v: string) => v.includes("rag-runtime")),
      ).toBe(true);

      await microkernel.registry.stopAll();
    });

    it("supports query parameter overrides for release channel and version", async () => {
      const microkernel = createMicrokernelServiceRegistry({
        stateDir: testDir,
        coryDir,
      });
      await microkernel.registry.startAll();

      const { req, res, getResult } = createMockReqRes({
        method: "GET",
        url: "/api/corehub/release/readiness?channel=preview&version=2.1.0-alpha",
      });

      const handled = await handleCoreHubRoute(req, res, microkernel);
      expect(handled).toBe(true);

      const result = await getResult();
      expect(result.statusCode).toBe(200);
      expect(result.data.manifest.releaseChannel).toBe("preview");
      expect(result.data.manifest.version).toBe("2.1.0-alpha");

      await microkernel.registry.stopAll();
    });

    it("sets permissive CORS and handles OPTIONS preflight for release readiness", async () => {
      const microkernel = createMicrokernelServiceRegistry({
        stateDir: testDir,
        coryDir,
      });

      const { req: optReq, res: optRes, getResult: getOptResult } = createMockReqRes({
        method: "OPTIONS",
        url: "/api/corehub/release/readiness",
      });

      const handledOpt = await handleCoreHubRoute(optReq, optRes, microkernel);
      expect(handledOpt).toBe(true);

      const optResult = await getOptResult();
      expect(optResult.statusCode).toBe(204);
      expect(optResult.headers["access-control-allow-origin"]).toBe("*");
      expect(optResult.headers["access-control-allow-methods"]).toContain("GET");
    });

    it("evaluates options stagedFilePaths and sourceSnippets through the endpoint", async () => {
      const microkernel = createMicrokernelServiceRegistry({
        stateDir: testDir,
        coryDir,
      });
      await microkernel.registry.startAll();

      const { req, res, getResult } = createMockReqRes({
        method: "GET",
        url: "/api/corehub/release/readiness",
      });

      const handled = await handleCoreHubRoute(req, res, microkernel, {
        stagedFilePaths: [".env"],
        sourceSnippets: ["const leaked = 'sk-ant-api03-1234567890abcdef';"],
      });
      expect(handled).toBe(true);

      const result = await getResult();
      expect(result.statusCode).toBe(200);
      expect(result.data.ok).toBe(true);
      expect(result.data.manifest.allGatesPassed).toBe(false);

      const artifactGate = result.data.manifest.gateResults.find(
        (g: { gate: string }) => g.gate === "private_artifact_exclusion",
      );
      expect(artifactGate?.passed).toBe(false);

      const secGate = result.data.manifest.gateResults.find(
        (g: { gate: string }) => g.gate === "security_invariants",
      );
      expect(secGate?.passed).toBe(false);

      await microkernel.registry.stopAll();
    });

    it("falls back to querying individual services health when registry property is omitted", async () => {
      const microkernel = createMicrokernelServiceRegistry({
        stateDir: testDir,
        coryDir,
      });
      await microkernel.registry.startAll();
      microkernel.provider.registry.register(
        { id: "mock", name: "Mock", chat: async () => ({}) as any },
        ["m1"],
      );

      // Create a services object without the .registry property
      const servicesWithoutRegistry = {
        provider: microkernel.provider,
        rag: microkernel.rag,
        tool: microkernel.tool,
        browser: microkernel.browser,
        voice: microkernel.voice,
        cory: microkernel.cory,
        skillSynthesizer: microkernel.skillSynthesizer,
        tierPolicy: microkernel.tierPolicy,
        appStore: microkernel.appStore,
        warRoom: microkernel.warRoom,
        knowledgeScribe: microkernel.knowledgeScribe,
        prWorkflow: microkernel.prWorkflow,
      };

      const { req, res, getResult } = createMockReqRes({
        method: "GET",
        url: "/api/corehub/release/readiness",
      });

      const handled = await handleCoreHubRoute(
        req,
        res,
        servicesWithoutRegistry as unknown as typeof microkernel,
      );
      expect(handled).toBe(true);

      const result = await getResult();
      expect(result.statusCode).toBe(200);
      expect(result.data.ok).toBe(true);
      expect(result.data.manifest.allGatesPassed).toBe(true);

      await microkernel.registry.stopAll();
    });
  });
});
