/**
 * CoreBlow — Microkernel Bootstrap Coordinator
 *
 * Coordinates Hybrid OOP + DOP Microkernel services within Gateway's ServiceRegistry:
 * 1. AI Provider Runtime (Native OOP GatewayService wrapping ProviderRegistry)
 * 2. Vector/RAG & Knowledge Runtime (Native OOP GatewayService wrapping RAGPipeline)
 * 3. Tool Runtime (Native OOP GatewayService wrapping ToolRegistry & ToolExecutor)
 * 4. Browser Runtime (Native OOP GatewayService wrapping session cleanup)
 * 5. Voice Runtime (Native OOP GatewayService wrapping TtsEngine)
 * 6. Cory Built-in Memory (Native OOP GatewayService + DOP Markdown storage)
 * 7. Extension Tier Policy (OOP GatewayService: Core vs CoreHub On-Demand)
 * 8. CoreHub App Store Runtime (OOP GatewayService: 7-pillar contract, staging, lifecycle, consent)
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { ServiceRegistry, type GatewayService, type ServiceHealth } from "./service-registry.js";
import { CoryBootstrapService } from "../memory/cory.js";
import { ExtensionTierPolicy } from "../plugins/extension-tier-policy.js";
import { CoreHubAppStoreRuntime } from "../plugins/app-store-runtime.js";
import {
  buildStorefrontCatalogView,
  BUILTIN_KERNEL_CAPABILITY_ENTRIES,
  type StorefrontAppCard,
  type StorefrontCatalogEntry,
} from "../plugins/cockpit-storefront-model.js";
import {
  isCoreHubCapability,
  type CoreHubAppManifest,
  type CoreHubCapability,
} from "../plugins/app-store-contract.js";
import {
  listOfficialExternalPluginCatalogEntries,
  resolveOfficialExternalPluginId,
  resolveOfficialExternalPluginLabel,
  resolveOfficialExternalPluginInstall,
} from "../plugins/official-external-plugin-catalog.js";
import { ProviderRegistry } from "../providers/provider-registry.js";
import { RAGPipeline } from "../rag/rag-pipeline.js";
import { ToolRegistry } from "../tools/tool-registry.js";
import { ToolExecutor } from "../tools/tool-executor.js";
import { BrowserTool } from "../tools/builtin/browser.js";
import { cleanupBrowserSessionsForLifecycleEnd } from "../browser-lifecycle-cleanup.js";
import { TtsEngine } from "../tts/engine.js";
import { loadConfig, type CoreBlowConfig } from "../config/config.js";
import {
  isLocalDirectRequest,
  resolveGatewayAuth,
  type ResolvedGatewayAuth,
} from "./auth.js";
import { checkBrowserOrigin } from "./origin-check.js";
import {
  authorizeScopedGatewayHttpRequestOrReply,
  resolveTrustedHttpOperatorScopes,
  getHeader,
  type AuthorizedGatewayHttpRequest,
} from "./http-auth-utils.js";
import { CLI_DEFAULT_OPERATOR_SCOPES } from "./method-scopes.js";
import { sendJson } from "./http-common.js";
import type { AuthRateLimiter } from "./auth-rate-limit.js";

// ── Native Kernel Capability Services (OOP GatewayService Adapters) ──

export interface NativeProviderRuntimeOptions {
  readonly registry?: ProviderRegistry;
  readonly activeProvider?: string;
  readonly activeModel?: string;
  readonly isConfigured?: boolean;
}

export class NativeProviderRuntimeService implements GatewayService {
  readonly name = "provider-runtime";
  public readonly registry: ProviderRegistry;
  public activeProvider?: string;
  public activeModel?: string;
  public isConfigured?: boolean;
  private isStarted = false;

  constructor(options?: ProviderRegistry | NativeProviderRuntimeOptions) {
    if (options instanceof ProviderRegistry) {
      this.registry = options;
    } else {
      this.registry = options?.registry ?? new ProviderRegistry();
      this.activeProvider = options?.activeProvider;
      this.activeModel = options?.activeModel;
      this.isConfigured = options?.isConfigured;
    }
  }

  async start(): Promise<void> {
    this.isStarted = true;
  }

  async stop(): Promise<void> {
    this.isStarted = false;
  }

  health(): ServiceHealth {
    if (!this.isStarted) {
      return { status: "down", detail: "Provider runtime stopped" };
    }
    if (this.isConfigured === false) {
      return {
        status: "degraded",
        detail: `Provider "${this.activeProvider ?? "unconfigured"}" has no API key configured (model: ${this.activeModel ?? "unknown"})`,
      };
    }
    const providers = this.registry.list();
    if (providers.length === 0 && !this.activeProvider) {
      return { status: "degraded", detail: "No AI model providers registered" };
    }
    if (providers.length > 0) {
      const healthyCount = providers.filter((p) => p.enabled && p.healthy).length;
      if (healthyCount === 0) {
        return { status: "degraded", detail: "All registered providers unhealthy or disabled" };
      }
      return {
        status: "healthy",
        detail: `${healthyCount} of ${providers.length} providers active`,
      };
    }
    return {
      status: "healthy",
      detail: `Provider "${this.activeProvider}" (${this.activeModel ?? "default"}) active and operational`,
    };
  }
}

export class NativeRagRuntimeService implements GatewayService {
  readonly name = "rag-runtime";
  public readonly pipeline: RAGPipeline;
  public isOperational = true;
  private isStarted = false;

  constructor(pipeline?: RAGPipeline) {
    this.pipeline = pipeline ?? new RAGPipeline();
  }

  async start(): Promise<void> {
    this.isStarted = true;
  }

  async stop(): Promise<void> {
    this.isStarted = false;
    this.pipeline.clear();
  }

  health(): ServiceHealth {
    if (!this.isStarted) {
      return { status: "down", detail: "RAG runtime stopped" };
    }
    if (!this.isOperational) {
      return {
        status: "degraded",
        detail: "RAG knowledge pipeline degraded or embedding backend unavailable",
      };
    }
    const stats = this.pipeline.stats();
    return {
      status: "healthy",
      detail: `RAG vector and document knowledge pipeline active (${stats.totalChunks} chunks indexed, backend: ${stats.embeddingProvider})`,
    };
  }
}

export class NativeToolRuntimeService implements GatewayService {
  readonly name = "tool-runtime";
  public readonly registry: ToolRegistry;
  public readonly executor: ToolExecutor;
  public isOperational = true;
  private isStarted = false;

  constructor(registry?: ToolRegistry, executor?: ToolExecutor) {
    this.registry = registry ?? new ToolRegistry();
    this.executor = executor ?? new ToolExecutor(this.registry);
  }

  async start(): Promise<void> {
    this.isStarted = true;
  }

  async stop(): Promise<void> {
    this.isStarted = false;
  }

  health(): ServiceHealth {
    if (!this.isStarted) {
      return { status: "down", detail: "Tool runtime stopped" };
    }
    if (!this.isOperational) {
      return { status: "degraded", detail: "Tool runtime degraded or execution unavailable" };
    }
    return { status: "healthy", detail: `${this.registry.listNames().length} tools registered` };
  }
}

export interface NativeBrowserRuntimeOptions {
  readonly tool?: BrowserTool;
  readonly getActiveSessionKeys?: () => string[];
}

export class NativeBrowserRuntimeService implements GatewayService {
  readonly name = "browser-runtime";
  public readonly tool: BrowserTool;
  public isOperational = true;
  private isStarted = false;
  private readonly trackedSessionKeys = new Set<string>();
  private readonly getActiveSessionKeys?: () => string[];

  constructor(options?: BrowserTool | NativeBrowserRuntimeOptions | (() => string[])) {
    if (options instanceof BrowserTool) {
      this.tool = options;
    } else if (typeof options === "function") {
      this.getActiveSessionKeys = options;
      this.tool = new BrowserTool();
    } else {
      this.tool = options?.tool ?? new BrowserTool();
      this.getActiveSessionKeys = options?.getActiveSessionKeys;
    }
  }

  trackSession(sessionKey: string): void {
    const trimmed = sessionKey.trim();
    if (trimmed) this.trackedSessionKeys.add(trimmed);
  }

  untrackSession(sessionKey: string): void {
    this.trackedSessionKeys.delete(sessionKey.trim());
  }

  getTrackedSessionCount(): number {
    const keys = new Set<string>([
      ...this.trackedSessionKeys,
      ...(this.getActiveSessionKeys ? this.getActiveSessionKeys() : []),
      ...this.tool.listPages().map((p) => p.id),
    ]);
    return keys.size;
  }

  async start(): Promise<void> {
    this.isStarted = true;
  }

  async stop(): Promise<void> {
    const allKeys = new Set<string>([
      ...this.trackedSessionKeys,
      ...(this.getActiveSessionKeys ? this.getActiveSessionKeys() : []),
      ...this.tool.listPages().map((p) => p.id),
    ]);

    // Clean up active pages and disconnect tool
    for (const page of this.tool.listPages()) {
      this.tool.closePage(page.id);
    }
    await this.tool.disconnect().catch(() => {});

    if (allKeys.size > 0) {
      await cleanupBrowserSessionsForLifecycleEnd({
        sessionKeys: Array.from(allKeys),
      }).catch(() => {
        // Best effort cleanup
      });
      this.trackedSessionKeys.clear();
    }
    this.isStarted = false;
  }

  health(): ServiceHealth {
    if (!this.isStarted) {
      return { status: "down", detail: "Browser runtime stopped" };
    }
    if (!this.isOperational) {
      return { status: "degraded", detail: "Browser runtime degraded or browser binary unavailable" };
    }
    const pageCount = this.tool.listPages().length;
    const isConnected = this.tool.isConnected();
    const detail = isConnected
      ? `Browser connected via CDP (${pageCount} active pages)`
      : `Browser runtime active (${pageCount} open pages, CDP standalone)`;
    return { status: "healthy", detail };
  }
}

export class NativeVoiceRuntimeService implements GatewayService {
  readonly name = "voice-runtime";
  public readonly engine: TtsEngine;
  public isOperational = true;
  private isStarted = false;

  constructor(engine?: TtsEngine) {
    this.engine = engine ?? new TtsEngine();
  }

  async start(): Promise<void> {
    this.isStarted = true;
  }

  async stop(): Promise<void> {
    this.isStarted = false;
    this.engine.clearCache();
  }

  health(): ServiceHealth {
    if (!this.isStarted) {
      return { status: "down", detail: "Voice runtime stopped" };
    }
    if (!this.isOperational) {
      return { status: "degraded", detail: "Voice synthesis engine degraded" };
    }
    const voices = this.engine.listVoices();
    if (voices.length === 0) {
      return { status: "degraded", detail: "No TTS voices available" };
    }
    return { status: "healthy", detail: `${voices.length} TTS voices active` };
  }
}

export interface MicrokernelServiceRegistryOptions {
  readonly stateDir?: string;
  readonly coryDir?: string;
  readonly catalogPath?: string;
  readonly catalogEntries?: readonly StorefrontCatalogEntry[];
  readonly providerRegistry?: ProviderRegistry;
  readonly activeProvider?: string;
  readonly activeModel?: string;
  readonly isProviderConfigured?: boolean;
  readonly ragPipeline?: RAGPipeline;
  readonly toolRegistry?: ToolRegistry;
  readonly toolExecutor?: ToolExecutor;
  readonly ttsEngine?: TtsEngine;
  readonly browserTool?: BrowserTool;
  readonly getActiveSessionKeys?: () => string[];
  readonly auth?: ResolvedGatewayAuth;
  readonly trustedProxies?: readonly string[];
  readonly allowRealIpFallback?: boolean;
  readonly rateLimiter?: AuthRateLimiter;
}

export interface MicrokernelServicesResult {
  readonly registry: ServiceRegistry;
  readonly provider: NativeProviderRuntimeService;
  readonly rag: NativeRagRuntimeService;
  readonly tool: NativeToolRuntimeService;
  readonly browser: NativeBrowserRuntimeService;
  readonly voice: NativeVoiceRuntimeService;
  readonly cory: CoryBootstrapService;
  readonly tierPolicy: ExtensionTierPolicy;
  readonly appStore: CoreHubAppStoreRuntime;
}

/**
 * Creates and configures the microkernel services in the Gateway ServiceRegistry.
 * Maintains topological dependency ordering and strictly guards native capabilities as kernel-tier.
 */
export function createMicrokernelServiceRegistry(
  options: MicrokernelServiceRegistryOptions = {},
): MicrokernelServicesResult {
  const registry = new ServiceRegistry();
  const stateDir = options.stateDir ?? path.join(os.homedir(), ".coreblow");
  const coryDir = options.coryDir ?? path.join(stateDir, "memory");

  const provider = new NativeProviderRuntimeService({
    registry: options.providerRegistry,
    activeProvider: options.activeProvider,
    activeModel: options.activeModel,
    isConfigured: options.isProviderConfigured,
  });
  const rag = new NativeRagRuntimeService(options.ragPipeline);
  const tool = new NativeToolRuntimeService(options.toolRegistry, options.toolExecutor);
  const browser = new NativeBrowserRuntimeService({
    tool: options.browserTool,
    getActiveSessionKeys: options.getActiveSessionKeys,
  });
  const voice = new NativeVoiceRuntimeService(options.ttsEngine);
  const cory = new CoryBootstrapService({ stateDir: coryDir });
  const tierPolicy = new ExtensionTierPolicy();
  const appStore = new CoreHubAppStoreRuntime({
    baseDir: stateDir,
    tierPolicy,
  });

  // Explicit registration with deterministic topological dependencies:
  // 1. AI provider runtime (0 deps)
  registry.register("provider-runtime", provider, []);
  // 2. Vector/RAG knowledge runtime (dep: provider-runtime)
  registry.register("rag-runtime", rag, ["provider-runtime"]);
  // 3. Tool runtime (dep: provider-runtime)
  registry.register("tool-runtime", tool, ["provider-runtime"]);
  // 4. Browser runtime (dep: tool-runtime)
  registry.register("browser-runtime", browser, ["tool-runtime"]);
  // 5. Voice runtime (0 deps)
  registry.register("voice-runtime", voice, []);
  // 6. Cory built-in memory (dep: provider-runtime ONLY, never CoreHub)
  registry.register("cory-memory", cory, ["provider-runtime"]);
  // 7. Extension tier policy (0 deps)
  registry.register("extension-tier-policy", tierPolicy, []);
  // 8. CoreHub app store runtime (dep: extension-tier-policy)
  registry.register("corehub-app-store", appStore, ["extension-tier-policy"]);

  return {
    registry,
    provider,
    rag,
    tool,
    browser,
    voice,
    cory,
    tierPolicy,
    appStore,
  };
}

/**
 * Resolves the storefront catalog entries from disk or built-in official catalogs.
 */
export function loadStorefrontCatalogEntries(
  customCatalogPath?: string,
): readonly StorefrontCatalogEntry[] {
  let loadedEntries: StorefrontCatalogEntry[] = [];
  const candidatePaths = [
    customCatalogPath,
    process.env.COREHUB_CATALOG_PATH,
    path.resolve(process.cwd(), "../coreblow-split/corehub/catalog.json"),
    path.resolve(process.cwd(), "coreblow-split/corehub/catalog.json"),
    path.resolve(os.homedir(), "coreblow-split/corehub/catalog.json"),
    path.resolve(os.homedir(), ".coreblow/corehub/catalog.json"),
  ].filter((p): p is string => typeof p === "string" && p.length > 0);

  for (const candidate of candidatePaths) {
    try {
      if (fs.existsSync(candidate)) {
        const raw = fs.readFileSync(candidate, "utf8");
        const parsed = JSON.parse(raw);
        const entries = Array.isArray(parsed) ? parsed : parsed.entries;
        if (Array.isArray(entries)) {
          loadedEntries = entries.map((e) => ({
            id: String(e.id ?? e.name ?? "").trim(),
            name: e.name ? String(e.name) : undefined,
            summary: e.summary ? String(e.summary) : e.description ? String(e.description) : undefined,
            description: e.description ? String(e.description) : undefined,
            version: e.version ? String(e.version) : "1.0.0",
            capabilities: Array.isArray(e.capabilities) ? e.capabilities : [],
            publisher: e.publisher,
            installSpec: e.install?.npmSpec ?? e.installSpec ?? (e.id ? `corehub:${e.id}` : undefined),
            hotReloadSafe: Boolean(e.hotReloadSafe),
          }));
          break;
        }
      }
    } catch {
      // Continue to next candidate
    }
  }

  // Fallback to official catalog definitions if no catalog file was found
  if (loadedEntries.length === 0) {
    loadedEntries = listOfficialExternalPluginCatalogEntries().map((entry) => {
      const id = resolveOfficialExternalPluginId(entry) ?? entry.name ?? "";
      const label = resolveOfficialExternalPluginLabel(entry) ?? entry.name ?? id;
      const install = resolveOfficialExternalPluginInstall(entry);
      return {
        id,
        name: label,
        summary: entry.description ?? "",
        description: entry.description ?? "",
        version: install?.npmSpec?.split("@").pop() ?? "1.0.0",
        capabilities: [],
        installSpec: install?.npmSpec ?? (id ? `corehub:${id}` : undefined),
        hotReloadSafe: false,
      };
    });
  }

  // Prepend built-in kernel capability entries (avoiding duplicate IDs)
  const existingIds = new Set(loadedEntries.map((e) => e.id));
  const kernelEntries = BUILTIN_KERNEL_CAPABILITY_ENTRIES.filter((k) => !existingIds.has(k.id));
  return Object.freeze([...kernelEntries, ...loadedEntries]);
}

function parseJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const text = Buffer.concat(chunks).toString("utf8").trim();
        resolve(text ? (JSON.parse(text) as Record<string, unknown>) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

export function resolveCoreHubOperatorScopes(
  req: IncomingMessage,
  requestAuth: AuthorizedGatewayHttpRequest,
): string[] {
  // 1. If established gateway auth explicitly trusts declared operator scopes (e.g. trusted-proxy):
  if (requestAuth.trustDeclaredOperatorScopes) {
    return resolveTrustedHttpOperatorScopes(req, requestAuth);
  }

  // 2. If authenticated via shared secret (token/password), grant default admin scopes,
  // but honor voluntary scope narrowing if the operator provided an explicit scopes header:
  if (requestAuth.authMethod === "token" || requestAuth.authMethod === "password") {
    const declaredHeader = getHeader(req, "x-coreblow-scopes");
    if (declaredHeader !== undefined) {
      return declaredHeader
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [...CLI_DEFAULT_OPERATOR_SCOPES];
  }

  // 3. For any other unprivileged or untrusted identity:
  // Delegate strictly to resolveTrustedHttpOperatorScopes (which returns [] when trustDeclaredOperatorScopes is false),
  // preventing manually spoofed x-coreblow-scopes headers from elevating privileges.
  return resolveTrustedHttpOperatorScopes(req, requestAuth);
}

export interface HandleCoreHubRouteOptions {
  readonly catalogEntries?: readonly StorefrontCatalogEntry[];
  readonly catalogPath?: string;
  readonly auth?: ResolvedGatewayAuth;
  readonly cfg?: CoreBlowConfig;
  readonly trustedProxies?: string[];
  readonly allowRealIpFallback?: boolean;
  readonly rateLimiter?: AuthRateLimiter;
}

/**
 * Handles CoreHub Storefront HTTP API requests:
 * - GET  /api/corehub/storefront
 * - POST /api/corehub/consent (Authenticated & Authorized operator.admin, non-wildcard CORS)
 * - POST /api/corehub/rollback (Authenticated & Authorized operator.admin, non-wildcard CORS)
 */
export async function handleCoreHubRoute(
  req: IncomingMessage,
  res: ServerResponse,
  services: {
    cory: CoryBootstrapService;
    tierPolicy: ExtensionTierPolicy;
    appStore: CoreHubAppStoreRuntime;
    provider?: NativeProviderRuntimeService;
    rag?: NativeRagRuntimeService;
    tool?: NativeToolRuntimeService;
    browser?: NativeBrowserRuntimeService;
    voice?: NativeVoiceRuntimeService;
  },
  options: HandleCoreHubRouteOptions = {},
): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const pathname = url.pathname;
  const method = (req.method ?? "GET").toUpperCase();

  if (!pathname.startsWith("/api/corehub/")) {
    return false;
  }

  const isMutation =
    pathname === "/api/corehub/consent" ||
    pathname === "/api/corehub/rollback" ||
    pathname === "/api/corehub/install" ||
    pathname === "/api/corehub/activate";
  const cfg = options.cfg ?? loadConfig();

  // Validate browser origin for CORS / cross-origin protection
  const checkOrigin = (): boolean => {
    const originHeader = getHeader(req, "origin");
    if (!originHeader) {
      return true; // Non-browser or direct curl/CLI invocation
    }
    const originCheck = checkBrowserOrigin({
      requestHost: getHeader(req, "host"),
      origin: originHeader,
      allowedOrigins: cfg.gateway?.controlUi?.allowedOrigins,
      allowHostHeaderOriginFallback:
        cfg.gateway?.controlUi?.dangerouslyAllowHostHeaderOriginFallback === true,
      isLocalClient: isLocalDirectRequest(
        req,
        options.trustedProxies ?? cfg.gateway?.trustedProxies,
        options.allowRealIpFallback ?? cfg.gateway?.allowRealIpFallback,
      ),
    });
    if (!originCheck.ok) {
      sendJson(res, 403, { ok: false, error: "Origin not allowed" });
      return false;
    }
    res.setHeader("Access-Control-Allow-Origin", originHeader);
    res.setHeader("Vary", "Origin");
    return true;
  };

  if (method === "OPTIONS") {
    if (isMutation) {
      if (!checkOrigin()) return true;
      res.statusCode = 204;
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-CoreBlow-Scopes");
      res.setHeader("Vary", "Origin");
      res.end();
      return true;
    }
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.end();
    return true;
  }

  // GET /api/corehub/status
  if (method === "GET" && pathname === "/api/corehub/status") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    sendJson(res, 200, {
      ok: true,
      loadedApps: services.appStore.getLoadedAppIds(),
      installedApps: services.appStore.getInstalledAppIds(),
      activatedApps: services.appStore.getActivatedAppIds(),
    });
    return true;
  }

  // GET /api/corehub/storefront
  if (method === "GET" && pathname === "/api/corehub/storefront") {
    const searchQuery = url.searchParams.get("q") ?? url.searchParams.get("search") ?? undefined;
    const tierParam = url.searchParams.get("tier");
    const tierFilter = tierParam === "core" || tierParam === "corehub_on_demand" ? tierParam : "all";

    const catalogEntries = options.catalogEntries ?? loadStorefrontCatalogEntries(options.catalogPath);
    const consentLedger = services.appStore.getConsentLedger();
    const tierPolicy = services.tierPolicy;

    const cards = buildStorefrontCatalogView({
      catalogEntries,
      consentLedger,
      tierPolicy,
      searchQuery,
      tierFilter,
    });

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    sendJson(res, 200, {
      ok: true,
      cards,
      apps: cards,
      health: {
        cory: services.cory.health(),
        appStore: services.appStore.health(),
        tierPolicy: services.tierPolicy.health(),
        ...(services.provider ? { provider: services.provider.health() } : {}),
        ...(services.rag ? { rag: services.rag.health() } : {}),
        ...(services.tool ? { tool: services.tool.health() } : {}),
        ...(services.browser ? { browser: services.browser.health() } : {}),
        ...(services.voice ? { voice: services.voice.health() } : {}),
      },
    });
    return true;
  }

  // Privileged Mutations: Origin verification + Authentication + Admin Scope Authorization
  if (isMutation) {
    if (!checkOrigin()) {
      return true;
    }

    const auth =
      options.auth ??
      resolveGatewayAuth({ authConfig: cfg.gateway?.auth, env: process.env });

    const authResult = await authorizeScopedGatewayHttpRequestOrReply({
      req,
      res,
      auth,
      trustedProxies: options.trustedProxies ?? cfg.gateway?.trustedProxies,
      allowRealIpFallback: options.allowRealIpFallback ?? cfg.gateway?.allowRealIpFallback,
      rateLimiter: options.rateLimiter,
      operatorMethod: "plugin.install",
      resolveOperatorScopes: resolveCoreHubOperatorScopes,
    });

    if (!authResult) {
      return true; // Sent 401 Unauthorized or 403 Forbidden
    }

    // Derive operator identity strictly from authenticated credentials (never trust body.operator)
    const operator = authResult.requestAuth.authMethod
      ? `gateway:${authResult.requestAuth.authMethod}`
      : "authenticated-operator";

    // POST /api/corehub/consent
    if (pathname === "/api/corehub/consent") {
      try {
        const body = await parseJsonBody(req);
        const pluginId = typeof body.pluginId === "string" ? body.pluginId.trim() : "";
        if (!pluginId) {
          sendJson(res, 400, { ok: false, error: "Missing required 'pluginId' field." });
          return true;
        }

        const action = typeof body.action === "string" ? body.action.toLowerCase() : undefined;
        const isGrant = body.grant !== false && action !== "revoke";

        const ledger = services.appStore.getConsentLedger();

        if (!isGrant) {
          ledger.revokeConsent(pluginId);
          sendJson(res, 200, { ok: true, pluginId, revoked: true });
          return true;
        }

        const rawCaps = Array.isArray(body.capabilities) ? body.capabilities : [];
        const capabilities: CoreHubCapability[] = rawCaps.filter(isCoreHubCapability);

        const consentRecord = ledger.grantConsent(pluginId, capabilities, operator);
        sendJson(res, 200, { ok: true, pluginId, consent: consentRecord });
        return true;
      } catch (err) {
        sendJson(res, 400, {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
        return true;
      }
    }

    // POST /api/corehub/rollback
    if (pathname === "/api/corehub/rollback") {
      try {
        const body = await parseJsonBody(req);
        const pluginId = typeof body.pluginId === "string" ? body.pluginId.trim() : "";
        if (!pluginId) {
          sendJson(res, 400, { ok: false, error: "Missing required 'pluginId' field." });
          return true;
        }

        const targetVersion =
          typeof body.targetVersion === "string"
            ? body.targetVersion
            : typeof body.version === "string"
              ? body.version
              : undefined;

        const success = services.appStore.rollbackApp(pluginId, targetVersion);
        if (success) {
          sendJson(res, 200, { ok: true, pluginId, targetVersion });
        } else {
          sendJson(res, 400, {
            ok: false,
            error: "Rollback failed or no backup available.",
            pluginId,
          });
        }
        return true;
      } catch (err) {
        sendJson(res, 400, {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
        return true;
      }
    }

    // POST /api/corehub/install
    if (pathname === "/api/corehub/install") {
      try {
        const body = await parseJsonBody(req);
        const manifest = body.manifest as CoreHubAppManifest;
        if (!manifest || !manifest.id) {
          sendJson(res, 400, { ok: false, error: "Missing required 'manifest' field." });
          return true;
        }
        const archiveBuffer = typeof body.archiveBase64 === "string"
          ? Buffer.from(body.archiveBase64, "base64")
          : Buffer.alloc(0);
        const result = services.appStore.installAppFromBuffer({
          archiveBuffer,
          manifest,
          grantCapabilities: body.grantCapabilities === true,
          operator,
        });
        sendJson(res, 200, { ok: true, pluginId: manifest.id, ...result });
        return true;
      } catch (err) {
        sendJson(res, 400, {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
        return true;
      }
    }

    // POST /api/corehub/activate
    if (pathname === "/api/corehub/activate") {
      try {
        const body = await parseJsonBody(req);
        const pluginId = typeof body.pluginId === "string" ? body.pluginId.trim() : "";
        const manifest = body.manifest as CoreHubAppManifest;
        if (!pluginId || !manifest) {
          sendJson(res, 400, { ok: false, error: "Missing required 'pluginId' or 'manifest' field." });
          return true;
        }
        const activation = await services.appStore.enableApp(pluginId, manifest, {
          forceImmediate: body.forceImmediate !== false,
        });
        sendJson(res, 200, { ok: true, pluginId, activation });
        return true;
      } catch (err) {
        sendJson(res, 400, {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
        return true;
      }
    }
  }

  sendJson(res, 404, { ok: false, error: "CoreHub route not found", pathname });
  return true;
}
