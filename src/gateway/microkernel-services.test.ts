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

  it("registers all 8 microkernel services with deterministic topological dependencies", () => {
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
    expect(microkernel.tierPolicy.name).toBe("extension-tier-policy");
    expect(microkernel.appStore.name).toBe("corehub-app-store");

    const list = microkernel.registry.list();
    expect(list).toHaveLength(8);

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

    const tierPolicyEntry = list.find((s) => s.name === "extension-tier-policy")!;
    expect(tierPolicyEntry.deps).toEqual([]);

    const appStoreEntry = list.find((s) => s.name === "corehub-app-store")!;
    expect(appStoreEntry.deps).toEqual(["extension-tier-policy"]);
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
    expect(microkernel.tierPolicy.health().status).toBe("down");
    expect(microkernel.appStore.health().status).toBe("down");

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
      "extension-tier-policy",
      "corehub-app-store",
    ]);

    // 3. Verify health status after start
    expect(microkernel.rag.health().status).toBe("healthy");
    expect(microkernel.tool.health().status).toBe("healthy");
    expect(microkernel.browser.health().status).toBe("healthy");
    expect(microkernel.voice.health().status).toBe("healthy");
    expect(microkernel.cory.health().status).toBe("healthy");
    expect(microkernel.tierPolicy.health().status).toBe("healthy");
    expect(microkernel.appStore.health().status).toBe("healthy");

    // Provider registry without registered models reports truthful degradation
    expect(microkernel.provider.health().status).toBe("degraded");
    expect(microkernel.provider.health().detail).toBe("No AI model providers registered");

    // Register a mock provider and verify healthy status
    microkernel.provider.registry.register(
      { id: "mock", name: "Mock", chat: async () => ({} as any) },
      ["m1"],
    );
    expect(microkernel.provider.health().status).toBe("healthy");

    // 4. Stop all services in reverse-order
    const stopResult = await microkernel.registry.stopAll();
    expect(stopResult.failed).toHaveLength(0);

    const appStoreIndex = stopResult.stopped.indexOf("corehub-app-store");
    const tierPolicyIndex = stopResult.stopped.indexOf("extension-tier-policy");
    expect(appStoreIndex).toBeLessThan(tierPolicyIndex);

    const coryIndex = stopResult.stopped.indexOf("cory-memory");
    const providerIndex = stopResult.stopped.indexOf("provider-runtime");
    expect(coryIndex).toBeLessThan(providerIndex);

    const browserIndex = stopResult.stopped.indexOf("browser-runtime");
    const toolIndex = stopResult.stopped.indexOf("tool-runtime");
    expect(browserIndex).toBeLessThan(toolIndex);

    // 5. Verify down status after stop
    expect(microkernel.provider.health().status).toBe("down");
    expect(microkernel.rag.health().status).toBe("down");
    expect(microkernel.tool.health().status).toBe("down");
    expect(microkernel.browser.health().status).toBe("down");
    expect(microkernel.voice.health().status).toBe("down");
    expect(microkernel.tierPolicy.health().status).toBe("down");
    expect(microkernel.appStore.health().status).toBe("down");
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

      const { req: anonSpoofReq, res: anonSpoofRes, getResult: getAnonSpoofResult } = createMockReqRes({
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
      const { req: grantReq, res: grantRes, getResult: getGrantResult } = createMockReqRes({
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
      const { req: revokeReq, res: revokeRes, getResult: getRevokeResult } = createMockReqRes({
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
      const { req: anonReq, res: anonRes, getResult: getAnonResult } = createMockReqRes({
        method: "POST",
        url: "/api/corehub/rollback",
        body: { pluginId: "telegram" },
      });
      await handleCoreHubRoute(anonReq, anonRes, microkernel, { auth: testAuth });
      expect((await getAnonResult()).statusCode).toBe(401);

      // 2. Unauthorized scope -> 403
      const { req: unauthReq, res: unauthRes, getResult: getUnauthResult } = createMockReqRes({
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
      const { req: failingReq, res: failingRes, getResult: getFailingResult } = createMockReqRes({
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
      const { req: successReq, res: successRes, getResult: getSuccessResult } = createMockReqRes({
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
      const { req: optReq, res: optRes, getResult: getOptResult } = createMockReqRes({
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
      const { req: storeReq, res: storeRes, getResult: getStoreResult } = createMockReqRes({
        method: "GET",
        url: "/api/corehub/storefront",
      });
      await handleCoreHubRoute(storeReq, storeRes, microkernel, { auth: testAuth });
      const storeResult = await getStoreResult();
      expect(storeResult.statusCode).toBe(200);
      expect(storeResult.headers["access-control-allow-origin"]).toBe("*");

      await microkernel.registry.stopAll();
    });
  });
});
