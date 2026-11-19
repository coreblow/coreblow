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
import type { IncomingMessage, ServerResponse } from "node:http";
import os from "node:os";
import path from "node:path";
import { PrWorkflowOrchestratorService } from "../agents/pr-workflow/index.js";
import {
  WarRoomOrchestratorService,
  type WarRoomMember,
  type WarRoomSession,
} from "../agents/war-room/index.js";
import { cleanupBrowserSessionsForLifecycleEnd } from "../browser-lifecycle-cleanup.js";
import { loadConfig, type CoreBlowConfig } from "../config/config.js";
import { compileSovereignReleaseManifest } from "../infra/release/index.js";
import {
  CorySkillSynthesizerService,
  type SkillIngestOptions,
  type SkillLifecycleStatus,
  type TurnTrajectoryRecord,
} from "../learning/index.js";
import {
  CoryBootstrapService,
  CoryKnowledgeScribeService,
  type CoryMemoryLayer,
} from "../memory/index.js";
import { UniversalAgentImporterService, type ExternalAgentSource } from "../migration/index.js";
import {
  listUnifiedSessions,
  getUnifiedSession,
  upsertUnifiedSession,
  deleteUnifiedSession,
  appendTurnToUnifiedSession,
} from "../sessions/unified-session-store.js";
import {
  isCoreHubCapability,
  type CoreHubAppManifest,
  type CoreHubCapability,
} from "../plugins/app-store-contract.js";
import { CoreHubAppStoreRuntime } from "../plugins/app-store-runtime.js";
import { renderChatNativeView, type ChatNativePluginView } from "../plugins/chat-views/index.js";
import {
  compileDesktopStudioSnapshot,
  executeDesktopQuickLaunch,
  evaluateDesktopWorktreeDiff,
  type PairedDesktopAppContext,
} from "./macos-codex-companion-bridge.js";
import {
  runCoreBlowReActLoop,
  autoDiscoverRuntimeEndpoints,
  type ExecutionProfile,
} from "../agents/coreblow-react-engine.js";
import {
  buildStorefrontCatalogView,
  BUILTIN_KERNEL_CAPABILITY_ENTRIES,
  type StorefrontAppCard,
  type StorefrontCatalogEntry,
} from "../plugins/cockpit-storefront-model.js";
import { ExtensionTierPolicy } from "../plugins/extension-tier-policy.js";
import {
  listOfficialExternalPluginCatalogEntries,
  resolveOfficialExternalPluginId,
  resolveOfficialExternalPluginLabel,
  resolveOfficialExternalPluginInstall,
} from "../plugins/official-external-plugin-catalog.js";
import { ProviderRegistry } from "../providers/provider-registry.js";
import { RAGPipeline } from "../rag/rag-pipeline.js";
import { BrowserTool } from "../tools/builtin/browser.js";
import { ToolExecutor } from "../tools/tool-executor.js";
import { ToolRegistry } from "../tools/tool-registry.js";
import { TtsEngine } from "../tts/engine.js";
import type { AuthRateLimiter } from "./auth-rate-limit.js";
import { isLocalDirectRequest, resolveGatewayAuth, type ResolvedGatewayAuth } from "./auth.js";
import {
  authorizeScopedGatewayHttpRequestOrReply,
  resolveTrustedHttpOperatorScopes,
  getHeader,
  type AuthorizedGatewayHttpRequest,
} from "./http-auth-utils.js";
import { sendJson } from "./http-common.js";
import { CLI_DEFAULT_OPERATOR_SCOPES } from "./method-scopes.js";
import { checkBrowserOrigin } from "./origin-check.js";
import { ServiceRegistry, type GatewayService, type ServiceHealth } from "./service-registry.js";

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
      return {
        status: "degraded",
        detail: "Browser runtime degraded or browser binary unavailable",
      };
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
  readonly skillsDir?: string;
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
  readonly warRoomService?: WarRoomOrchestratorService;
  readonly knowledgeScribeService?: CoryKnowledgeScribeService;
  readonly wikiDir?: string;
  readonly prWorkflowService?: PrWorkflowOrchestratorService;
}

export interface MicrokernelServicesResult {
  readonly registry: ServiceRegistry;
  readonly provider: NativeProviderRuntimeService;
  readonly rag: NativeRagRuntimeService;
  readonly tool: NativeToolRuntimeService;
  readonly browser: NativeBrowserRuntimeService;
  readonly voice: NativeVoiceRuntimeService;
  readonly cory: CoryBootstrapService;
  readonly skillSynthesizer: CorySkillSynthesizerService;
  readonly tierPolicy: ExtensionTierPolicy;
  readonly appStore: CoreHubAppStoreRuntime;
  readonly warRoom: WarRoomOrchestratorService;
  readonly knowledgeScribe: CoryKnowledgeScribeService;
  readonly prWorkflow: PrWorkflowOrchestratorService;
}

export type MicrokernelServiceRegistry = MicrokernelServicesResult;

let activeMicrokernel: MicrokernelServicesResult | null = null;

/** Bind the microkernel booted by the gateway so HTTP routes and shutdown can reach it. */
export function setActiveMicrokernel(
  microkernel: MicrokernelServicesResult | null,
): void {
  activeMicrokernel = microkernel;
}

/** Return the microkernel bound to the running gateway, or null when none booted. */
export function getActiveMicrokernel(): MicrokernelServicesResult | null {
  return activeMicrokernel;
}

/**
 * Creates and configures the microkernel services in the Gateway ServiceRegistry.
 * Maintains topological dependency ordering and strictly guards native capabilities as kernel-tier.
 */
export function createMicrokernelServiceRegistry(
  options: MicrokernelServiceRegistryOptions = {},
): MicrokernelServicesResult {
  const registry = new ServiceRegistry();
  const stateDir =
    options.stateDir ?? process.env.COREBLOW_STATE_DIR ?? path.join(os.homedir(), ".coreblow");
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
  const skillsDir = options.skillsDir ?? options.stateDir ?? path.join(stateDir, "skills");
  const skillSynthesizer = new CorySkillSynthesizerService({
    stateDir: skillsDir,
    coryService: cory,
  });
  const tierPolicy = new ExtensionTierPolicy();
  const appStore = new CoreHubAppStoreRuntime({
    baseDir: stateDir,
    tierPolicy,
  });
  const warRoom =
    options.warRoomService ??
    new WarRoomOrchestratorService({
      skillSynthesizer,
      providerRuntime: provider,
    });
  const knowledgeScribe =
    options.knowledgeScribeService ??
    new CoryKnowledgeScribeService({
      cory,
      skillSynthesizer,
      wikiDir: options.wikiDir,
    });
  const prWorkflow = options.prWorkflowService ?? new PrWorkflowOrchestratorService();

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
  // 7. Cory skill synthesizer (dep: cory-memory)
  registry.register("cory-skill-synthesizer", skillSynthesizer, ["cory-memory"]);
  // 8. Extension tier policy (0 deps)
  registry.register("extension-tier-policy", tierPolicy, []);
  // 9. CoreHub app store runtime (dep: extension-tier-policy)
  registry.register("corehub-app-store", appStore, ["extension-tier-policy"]);
  // 10. War Room orchestrator (deps: cory-skill-synthesizer, provider-runtime)
  registry.register("war-room-orchestrator", warRoom, [
    "cory-skill-synthesizer",
    "provider-runtime",
  ]);
  // 11. Cory knowledge scribe & memory wiki (deps: cory-memory, cory-skill-synthesizer)
  registry.register("cory-knowledge-scribe", knowledgeScribe, [
    "cory-memory",
    "cory-skill-synthesizer",
  ]);
  // 12. Autonomous Git & PR Workflow Orchestrator (deps: tool-runtime, war-room-orchestrator)
  registry.register("pr-workflow-orchestrator", prWorkflow, [
    "tool-runtime",
    "war-room-orchestrator",
  ]);

  return {
    registry,
    provider,
    rag,
    tool,
    browser,
    voice,
    cory,
    skillSynthesizer,
    tierPolicy,
    appStore,
    warRoom,
    knowledgeScribe,
    prWorkflow,
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
            summary: e.summary
              ? String(e.summary)
              : e.description
                ? String(e.description)
                : undefined,
            description: e.description ? String(e.description) : undefined,
            version: e.version ? String(e.version) : "1.0.0",
            capabilities: Array.isArray(e.capabilities) ? e.capabilities : [],
            publisher: e.publisher,
            installSpec:
              e.install?.npmSpec ?? e.installSpec ?? (e.id ? `corehub:${e.id}` : undefined),
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
  readonly stagedFilePaths?: readonly string[];
  readonly sourceSnippets?: readonly string[];
}

/**
 * Handles CoreHub Storefront HTTP API requests:
 * - GET  /api/corehub/storefront
 * - GET  /api/corehub/release/readiness (and /api/corehub/v2/release/readiness)
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
    skillSynthesizer?: CorySkillSynthesizerService;
    warRoom?: WarRoomOrchestratorService;
    knowledgeScribe?: CoryKnowledgeScribeService;
    importer?: UniversalAgentImporterService;
    prWorkflow?: PrWorkflowOrchestratorService;
    registry?: ServiceRegistry;
  },
  options: HandleCoreHubRouteOptions = {},
): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const rawPathname = url.pathname;
  let normalizedPath = rawPathname.startsWith("/api/corehub/v2/")
    ? "/api/corehub/" + rawPathname.slice("/api/corehub/v2/".length)
    : rawPathname === "/api/corehub/v2"
      ? "/api/corehub"
      : rawPathname;

  if (normalizedPath === "/quick-launch" || normalizedPath === "/api/corehub/quick-launch") {
    normalizedPath = "/api/corehub/desktop/quick-launch";
  } else if (normalizedPath === "/diff-inspector" || normalizedPath === "/api/corehub/diff-inspector") {
    normalizedPath = "/api/corehub/desktop/diff-inspector";
  } else if (normalizedPath === "/chat/react" || normalizedPath === "/api/corehub/chat/react") {
    normalizedPath = "/api/corehub/chat/react";
  } else if (
    normalizedPath === "/desktop/state" ||
    normalizedPath === "/state" ||
    normalizedPath === "/api/corehub/state"
  ) {
    normalizedPath = "/api/corehub/desktop/state";
  } else if (normalizedPath.startsWith("/api/corehub/cory/")) {
    normalizedPath = "/api/cory/" + normalizedPath.slice("/api/corehub/cory/".length);
  }
  const pathname = normalizedPath;
  const method = (req.method ?? "GET").toUpperCase();

  if (!pathname.startsWith("/api/corehub/") && !pathname.startsWith("/api/cory/")) {
    return false;
  }

  const isMutation =
    pathname === "/api/corehub/consent" ||
    pathname === "/api/corehub/rollback" ||
    pathname === "/api/corehub/install" ||
    pathname === "/api/corehub/activate" ||
    pathname === "/api/corehub/skills/ingest" ||
    pathname === "/api/corehub/skills/outcome" ||
    pathname === "/api/corehub/skills/lock" ||
    (pathname.startsWith("/api/corehub/war-room") && method === "POST") ||
    (pathname.startsWith("/api/corehub/warroom") && method === "POST") ||
    pathname === "/api/corehub/memory-wiki/scribe" ||
    pathname === "/api/corehub/import-agent" ||
    (pathname === "/api/corehub/pr-workflow/drafts" && method === "POST") ||
    pathname === "/api/corehub/pr-workflow/approve" ||
    pathname === "/api/corehub/pr-workflow/commit" ||
    pathname === "/api/corehub/chat-views/render" ||
    pathname === "/api/corehub/desktop/quick-launch" ||
    pathname === "/api/corehub/desktop/diff-inspector" ||
    pathname === "/api/corehub/chat/react" ||
    (pathname === "/api/corehub/sessions" && method === "POST") ||
    (pathname.startsWith("/api/corehub/sessions/") && method === "DELETE");
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
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-CoreBlow-Scopes",
      );
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

  // GET /api/corehub/desktop/state
  if (method === "GET" && pathname === "/api/corehub/desktop/state") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    try {
      const snapshot = await compileDesktopStudioSnapshot({
        services: services as unknown as MicrokernelServicesResult,
      });
      sendJson(res, 200, { ok: true, snapshot });
      return true;
    } catch (err) {
      sendJson(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
      return true;
    }
  }

  // GET /api/corehub/release/readiness (and /api/corehub/v2/release/readiness)
  if (method === "GET" && pathname === "/api/corehub/release/readiness") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

    // 1. Query live service health across the 12 canonical services
    const activeServices: Array<{
      name: string;
      healthy: boolean;
      status: string;
      detail?: string;
    }> = [];

    if (services.registry) {
      for (const entry of services.registry.getHealth()) {
        activeServices.push({
          name: entry.name,
          healthy: entry.status === "healthy",
          status: entry.status,
          detail: entry.detail,
        });
      }
    } else {
      const serviceList: Array<[string, { health(): { status: string; detail?: string } } | undefined]> = [
        ["provider-runtime", services.provider],
        ["rag-runtime", services.rag],
        ["tool-runtime", services.tool],
        ["browser-runtime", services.browser],
        ["voice-runtime", services.voice],
        ["cory-memory", services.cory],
        ["cory-skill-synthesizer", services.skillSynthesizer],
        ["extension-tier-policy", services.tierPolicy],
        ["corehub-app-store", services.appStore],
        ["war-room-orchestrator", services.warRoom],
        ["cory-knowledge-scribe", services.knowledgeScribe],
        ["pr-workflow-orchestrator", services.prWorkflow],
      ];
      for (const [name, svc] of serviceList) {
        if (svc) {
          const h = svc.health();
          activeServices.push({
            name,
            healthy: h.status === "healthy",
            status: h.status,
            detail: h.detail,
          });
        } else {
          activeServices.push({
            name,
            healthy: false,
            status: "down",
            detail: "Service not available",
          });
        }
      }
    }

    // 2. Load catalog entry count
    const catalogEntries =
      options.catalogEntries ?? loadStorefrontCatalogEntries(options.catalogPath);
    const coreHubArtifactCount = catalogEntries.length;

    // 3. Query parameter overrides
    const version = url.searchParams.get("version") ?? undefined;
    const releaseChannel =
      url.searchParams.get("channel") ?? url.searchParams.get("releaseChannel") ?? "ga";

    // 4. Compile sovereign release manifest
    const manifest = compileSovereignReleaseManifest({
      activeServices,
      serviceRegistry: services.registry,
      coreHubArtifactCount,
      version,
      releaseChannel,
      stagedFilePaths: options.stagedFilePaths ?? [],
      sourceSnippets: options.sourceSnippets ?? [],
    });

    sendJson(res, 200, {
      ok: true,
      manifest,
    });
    return true;
  }

  // GET /api/corehub/storefront
  if (method === "GET" && pathname === "/api/corehub/storefront") {
    const searchQuery = url.searchParams.get("q") ?? url.searchParams.get("search") ?? undefined;
    const tierParam = url.searchParams.get("tier");
    const tierFilter =
      tierParam === "core" || tierParam === "corehub_on_demand" ? tierParam : "all";

    const catalogEntries =
      options.catalogEntries ?? loadStorefrontCatalogEntries(options.catalogPath);
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
        ...(services.skillSynthesizer
          ? { skillSynthesizer: services.skillSynthesizer.health() }
          : {}),
        ...(services.warRoom ? { warRoom: services.warRoom.health() } : {}),
        ...(services.knowledgeScribe ? { knowledgeScribe: services.knowledgeScribe.health() } : {}),
        ...(services.prWorkflow ? { prWorkflow: services.prWorkflow.health() } : {}),
      },
    });
    return true;
  }

  // GET /api/corehub/skills/learned (and /api/corehub/v2/skills/learned)
  if (method === "GET" && pathname === "/api/corehub/skills/learned") {
    if (!services.skillSynthesizer) {
      sendJson(res, 503, { ok: false, error: "Cory Skill Synthesizer service not available" });
      return true;
    }

    const auth =
      options.auth ?? resolveGatewayAuth({ authConfig: cfg.gateway?.auth, env: process.env });

    const authResult = await authorizeScopedGatewayHttpRequestOrReply({
      req,
      res,
      auth,
      trustedProxies: options.trustedProxies ?? cfg.gateway?.trustedProxies,
      allowRealIpFallback: options.allowRealIpFallback ?? cfg.gateway?.allowRealIpFallback,
      rateLimiter: options.rateLimiter,
      operatorMethod: "skills.status",
      resolveOperatorScopes: resolveCoreHubOperatorScopes,
    });

    if (!authResult) {
      return true;
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

    const statusParam = url.searchParams.get("status");
    const status =
      statusParam === "all" ? undefined : (statusParam as SkillLifecycleStatus | undefined);
    const query = url.searchParams.get("q") ?? url.searchParams.get("query");

    const skills = query
      ? await services.skillSynthesizer.matchSkillsForQuery(query)
      : await services.skillSynthesizer.listSkills(status ? { status } : undefined);

    sendJson(res, 200, {
      ok: true,
      count: skills.length,
      skills,
    });
    return true;
  }

  // GET /api/corehub/war-room/rooms or /api/corehub/warroom/rooms
  if (method === "GET" && (pathname === "/api/corehub/war-room/rooms" || pathname === "/api/corehub/warroom/rooms")) {
    if (!services.warRoom) {
      sendJson(res, 503, { ok: false, error: "War Room Orchestrator service not available" });
      return true;
    }

    const auth =
      options.auth ?? resolveGatewayAuth({ authConfig: cfg.gateway?.auth, env: process.env });

    const authResult = await authorizeScopedGatewayHttpRequestOrReply({
      req,
      res,
      auth,
      trustedProxies: options.trustedProxies ?? cfg.gateway?.trustedProxies,
      allowRealIpFallback: options.allowRealIpFallback ?? cfg.gateway?.allowRealIpFallback,
      rateLimiter: options.rateLimiter,
      operatorMethod: "agents.list",
      resolveOperatorScopes: resolveCoreHubOperatorScopes,
    });

    if (!authResult) {
      return true;
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    let rooms = services.warRoom.listWarRooms();
    if (rooms.length === 0 && (pathname === "/api/corehub/warroom/rooms" || url.searchParams.get("autoCreate") === "true")) {
      services.warRoom.createWarRoom({
        roomId: "coreblow-squad",
        title: "CoreBlow Squad",
        purpose: "Unified Autonomous Multi-Agent Squad",
      });
      rooms = services.warRoom.listWarRooms();
    }
    sendJson(res, 200, {
      ok: true,
      count: rooms.length,
      rooms,
    });
    return true;
  }

  // GET /api/corehub/warroom/:roomId/messages or /api/corehub/war-room/:roomId/messages
  const warRoomMessagesGetMatch = /^\/api\/corehub\/(?:war-room|warroom)\/([^/]+)\/messages$/.exec(pathname);
  if (method === "GET" && warRoomMessagesGetMatch) {
    const roomId = decodeURIComponent(warRoomMessagesGetMatch[1]);
    if (!services.warRoom) {
      sendJson(res, 503, { ok: false, error: "War Room Orchestrator service not available" });
      return true;
    }

    const auth =
      options.auth ?? resolveGatewayAuth({ authConfig: cfg.gateway?.auth, env: process.env });

    const authResult = await authorizeScopedGatewayHttpRequestOrReply({
      req,
      res,
      auth,
      trustedProxies: options.trustedProxies ?? cfg.gateway?.trustedProxies,
      allowRealIpFallback: options.allowRealIpFallback ?? cfg.gateway?.allowRealIpFallback,
      rateLimiter: options.rateLimiter,
      operatorMethod: "agents.list",
      resolveOperatorScopes: resolveCoreHubOperatorScopes,
    });

    if (!authResult) {
      return true;
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

    let room = services.warRoom.getWarRoom(roomId);
    if (!room && (roomId === "coreblow-squad" || roomId === "default")) {
      room = services.warRoom.createWarRoom({
        roomId: "coreblow-squad",
        title: "CoreBlow Squad",
        purpose: "Unified Autonomous Multi-Agent Squad",
      });
    }

    if (!room) {
      sendJson(res, 404, { ok: false, error: `War room "${roomId}" not found.` });
      return true;
    }

    sendJson(res, 200, {
      ok: true,
      roomId: room.roomId,
      title: room.title,
      purpose: room.purpose,
      leadAgentId: room.leadAgentId,
      messages: room.messages ?? [],
      members: room.members,
      kanbanBoard: room.kanbanBoard,
      pendingApprovals: room.pendingApprovals,
      screenFeed: services.warRoom.getScreenFeed(roomId, 50),
    });
    return true;
  }

  // GET /api/corehub/warroom/:roomId/screen/stream or /api/corehub/war-room/:roomId/screen/stream
  const warRoomScreenStreamMatch = /^\/api\/corehub\/(?:war-room|warroom)\/([^/]+)\/screen\/stream$/.exec(pathname);
  if (method === "GET" && warRoomScreenStreamMatch) {
    const roomId = decodeURIComponent(warRoomScreenStreamMatch[1]);
    if (!services.warRoom) {
      sendJson(res, 503, { ok: false, error: "War Room Orchestrator service not available" });
      return true;
    }

    const auth =
      options.auth ?? resolveGatewayAuth({ authConfig: cfg.gateway?.auth, env: process.env });

    const authResult = await authorizeScopedGatewayHttpRequestOrReply({
      req,
      res,
      auth,
      trustedProxies: options.trustedProxies ?? cfg.gateway?.trustedProxies,
      allowRealIpFallback: options.allowRealIpFallback ?? cfg.gateway?.allowRealIpFallback,
      rateLimiter: options.rateLimiter,
      operatorMethod: "agents.list",
      resolveOperatorScopes: resolveCoreHubOperatorScopes,
    });

    if (!authResult) {
      return true;
    }

    let room = services.warRoom.getWarRoom(roomId);
    if (!room && (roomId === "coreblow-squad" || roomId === "default")) {
      room = services.warRoom.createWarRoom({
        roomId: "coreblow-squad",
        title: "CoreBlow Squad",
        purpose: "Unified Autonomous Multi-Agent Squad",
      });
    }

    if (!room) {
      sendJson(res, 404, { ok: false, error: `War room "${roomId}" not found.` });
      return true;
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    const initialFrames = services.warRoom.getScreenFeed(roomId, 40);
    for (const frame of initialFrames) {
      res.write(`data: ${JSON.stringify({ frame })}\n\n`);
    }

    const unsubscribe = services.warRoom.subscribeScreenStream(roomId, (frame) => {
      try {
        res.write(`data: ${JSON.stringify({ frame })}\n\n`);
      } catch {
        // stream closed
      }
    });

    const heartbeat = setInterval(() => {
      try {
        res.write(": keepalive\n\n");
      } catch {
        clearInterval(heartbeat);
      }
    }, 15000);

    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
      res.end();
    });

    return true;
  }

  // GET /api/corehub/memory-wiki
  if (method === "GET" && pathname === "/api/corehub/memory-wiki") {
    if (!services.knowledgeScribe) {
      sendJson(res, 503, { ok: false, error: "Cory Knowledge Scribe service not available" });
      return true;
    }

    const auth =
      options.auth ?? resolveGatewayAuth({ authConfig: cfg.gateway?.auth, env: process.env });

    const authResult = await authorizeScopedGatewayHttpRequestOrReply({
      req,
      res,
      auth,
      trustedProxies: options.trustedProxies ?? cfg.gateway?.trustedProxies,
      allowRealIpFallback: options.allowRealIpFallback ?? cfg.gateway?.allowRealIpFallback,
      rateLimiter: options.rateLimiter,
      operatorMethod: "doctor.memory.status",
      resolveOperatorScopes: resolveCoreHubOperatorScopes,
    });

    if (!authResult) {
      return true;
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    const workspaceId = url.searchParams.get("workspaceId") ?? undefined;
    const scope = workspaceId ? { workspaceId } : undefined;
    const snapshot = await services.knowledgeScribe.getMemoryWikiSnapshot(scope);
    sendJson(res, 200, {
      ok: true,
      pages: snapshot.pages,
      auditPanel: snapshot.auditPanel,
    });
    return true;
  }

  // GET /api/cory/search (and /api/corehub/cory/search)
  if (method === "GET" && (pathname === "/api/cory/search" || pathname === "/api/corehub/cory/search")) {
    const auth =
      options.auth ?? resolveGatewayAuth({ authConfig: cfg.gateway?.auth, env: process.env });

    const authResult = await authorizeScopedGatewayHttpRequestOrReply({
      req,
      res,
      auth,
      trustedProxies: options.trustedProxies ?? cfg.gateway?.trustedProxies,
      allowRealIpFallback: options.allowRealIpFallback ?? cfg.gateway?.allowRealIpFallback,
      rateLimiter: options.rateLimiter,
      operatorMethod: "doctor.memory.status",
      resolveOperatorScopes: resolveCoreHubOperatorScopes,
    });

    if (!authResult) {
      return true;
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

    const query = url.searchParams.get("q") ?? url.searchParams.get("query") ?? "";
    const topKParam = url.searchParams.get("topK") ?? url.searchParams.get("limit");
    const topK = topKParam ? Math.max(1, parseInt(topKParam, 10)) : 8;
    const workspaceId = url.searchParams.get("workspaceId") ?? undefined;
    const userScope = url.searchParams.get("userScope") ?? undefined;
    const scope = workspaceId || userScope ? { workspaceId, userScope } : undefined;

    const result = await services.cory.retriever.retrieve({
      query,
      scope,
      topK,
    });

    sendJson(res, 200, {
      ok: true,
      hits: result.hits,
      degraded: result.degraded,
      semanticUsed: result.semanticUsed,
      count: result.hits.length,
    });
    return true;
  }

  // GET /api/cory/layers (and /api/corehub/cory/layers)
  if (method === "GET" && (pathname === "/api/cory/layers" || pathname === "/api/corehub/cory/layers")) {
    const auth =
      options.auth ?? resolveGatewayAuth({ authConfig: cfg.gateway?.auth, env: process.env });

    const authResult = await authorizeScopedGatewayHttpRequestOrReply({
      req,
      res,
      auth,
      trustedProxies: options.trustedProxies ?? cfg.gateway?.trustedProxies,
      allowRealIpFallback: options.allowRealIpFallback ?? cfg.gateway?.allowRealIpFallback,
      rateLimiter: options.rateLimiter,
      operatorMethod: "doctor.memory.status",
      resolveOperatorScopes: resolveCoreHubOperatorScopes,
    });

    if (!authResult) {
      return true;
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

    const layer = url.searchParams.get("layer") as CoryMemoryLayer | null;
    const workspaceId = url.searchParams.get("workspaceId") ?? undefined;
    const userScope = url.searchParams.get("userScope") ?? undefined;
    const scope = workspaceId || userScope ? { workspaceId, userScope } : undefined;

    const items = layer
      ? services.cory.memoryStore.listLayerItems(layer, scope)
      : services.cory.memoryStore.loadAllCanonicalItems();

    sendJson(res, 200, {
      ok: true,
      count: items.length,
      items,
    });
    return true;
  }

  // GET /api/corehub/pr-workflow/drafts
  if (method === "GET" && pathname === "/api/corehub/pr-workflow/drafts") {
    if (!services.prWorkflow) {
      sendJson(res, 503, { ok: false, error: "PR Workflow Orchestrator service not available" });
      return true;
    }

    const auth =
      options.auth ?? resolveGatewayAuth({ authConfig: cfg.gateway?.auth, env: process.env });

    const authResult = await authorizeScopedGatewayHttpRequestOrReply({
      req,
      res,
      auth,
      trustedProxies: options.trustedProxies ?? cfg.gateway?.trustedProxies,
      allowRealIpFallback: options.allowRealIpFallback ?? cfg.gateway?.allowRealIpFallback,
      rateLimiter: options.rateLimiter,
      operatorMethod: "agents.list",
      resolveOperatorScopes: resolveCoreHubOperatorScopes,
    });

    if (!authResult) {
      return true;
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    const workspaceId = url.searchParams.get("workspaceId") ?? undefined;
    const drafts = services.prWorkflow.listPullRequestDrafts(workspaceId);
    sendJson(res, 200, {
      ok: true,
      drafts,
    });
    return true;
  }

  // GET /api/corehub/sessions (Unified Session Store list & search)
  if (method === "GET" && pathname === "/api/corehub/sessions") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    const q = url.searchParams.get("q") ?? undefined;
    const limit = url.searchParams.get("limit") ? parseInt(url.searchParams.get("limit")!, 10) : undefined;
    const sessions = listUnifiedSessions({ query: q, limit });
    sendJson(res, 200, {
      ok: true,
      count: sessions.length,
      sessions,
    });
    return true;
  }

  // GET /api/corehub/sessions/:id
  if (method === "GET" && pathname.startsWith("/api/corehub/sessions/")) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, DELETE, OPTIONS");
    const id = pathname.slice("/api/corehub/sessions/".length).trim();
    const session = getUnifiedSession(id);
    if (!session) {
      sendJson(res, 404, { ok: false, error: `Session "${id}" not found` });
      return true;
    }
    sendJson(res, 200, { ok: true, session });
    return true;
  }

  // Privileged Mutations: Origin verification + Authentication + Admin Scope Authorization
  if (isMutation) {
    if (!checkOrigin()) {
      return true;
    }

    const auth =
      options.auth ?? resolveGatewayAuth({ authConfig: cfg.gateway?.auth, env: process.env });

    const operatorMethod = pathname.startsWith("/api/corehub/skills/")
      ? "skills.install"
      : pathname.startsWith("/api/corehub/war-room/") ||
          pathname.startsWith("/api/corehub/warroom/") ||
          pathname.startsWith("/api/corehub/import-agent") ||
          pathname === "/api/corehub/pr-workflow/drafts" ||
          pathname === "/api/corehub/pr-workflow/approve" ||
    pathname === "/api/corehub/pr-workflow/commit" ||
          pathname.startsWith("/api/corehub/desktop/")
        ? "agents.create"
        : pathname === "/api/corehub/chat-views/render"
          ? "plugins.view"
          : "plugin.install";

    const authResult = await authorizeScopedGatewayHttpRequestOrReply({
      req,
      res,
      auth,
      trustedProxies: options.trustedProxies ?? cfg.gateway?.trustedProxies,
      allowRealIpFallback: options.allowRealIpFallback ?? cfg.gateway?.allowRealIpFallback,
      rateLimiter: options.rateLimiter,
      operatorMethod,
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
        if (!pluginId || !/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(pluginId) || pluginId.includes("..") || pluginId.includes("/") || pluginId.includes("\\")) {
          sendJson(res, 400, {
            ok: false,
            error: `Invalid pluginId "${pluginId}": must be a safe alphanumeric identifier without path traversal characters.`,
          });
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
        if (!manifest || !manifest.id || typeof manifest.id !== "string") {
          sendJson(res, 400, { ok: false, error: "Missing required 'manifest' field." });
          return true;
        }
        const pluginId = manifest.id.trim();
        if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(pluginId) || pluginId.includes("..") || pluginId.includes("/") || pluginId.includes("\\")) {
          sendJson(res, 400, {
            ok: false,
            error: `Invalid pluginId "${pluginId}": must be a safe alphanumeric identifier without path traversal characters.`,
          });
          return true;
        }
        const archiveBuffer =
          typeof body.archiveBase64 === "string"
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
        if (!pluginId || !manifest || !/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(pluginId) || pluginId.includes("..") || pluginId.includes("/") || pluginId.includes("\\")) {
          sendJson(res, 400, {
            ok: false,
            error: `Invalid pluginId "${pluginId}": must be a safe alphanumeric identifier without path traversal characters.`,
          });
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

    // POST /api/corehub/skills/ingest
    if (pathname === "/api/corehub/skills/ingest") {
      if (!services.skillSynthesizer) {
        sendJson(res, 503, { ok: false, error: "Cory Skill Synthesizer service not available" });
        return true;
      }
      try {
        const body = (await parseJsonBody(req)) as Record<string, unknown>;
        const rawTraj = (body.trajectory ?? body) as Record<string, unknown>;
        if (!rawTraj || typeof rawTraj !== "object") {
          sendJson(res, 400, { ok: false, error: "Missing trajectory record in request body." });
          return true;
        }

        const rawSteps = Array.isArray(rawTraj.steps)
          ? rawTraj.steps
          : Array.isArray(rawTraj.toolSteps)
            ? rawTraj.toolSteps
            : [];

        const normalizedSteps = rawSteps.map((step: Record<string, unknown>) => ({
          toolName: String(step.toolName ?? "tool"),
          input: step.input ?? step.argsSummary,
          output: step.output ?? step.outputSummary,
          isError: step.isError === true || step.succeeded === false,
          succeeded: step.succeeded === true || step.isError === false,
          executionDurationMs:
            typeof step.executionDurationMs === "number"
              ? step.executionDurationMs
              : typeof step.durationMs === "number"
                ? step.durationMs
                : undefined,
          errorCode: typeof step.errorCode === "string" ? step.errorCode : undefined,
        }));

        const finalOutcome: "success" | "failure" | "aborted" | "partial" | boolean =
          typeof rawTraj.finalOutcome === "string" &&
          (rawTraj.finalOutcome === "success" ||
            rawTraj.finalOutcome === "failure" ||
            rawTraj.finalOutcome === "aborted" ||
            rawTraj.finalOutcome === "partial")
            ? rawTraj.finalOutcome
            : typeof rawTraj.finalOutcome === "boolean"
              ? rawTraj.finalOutcome
              : rawTraj.succeeded === true || rawTraj.verificationPassed === true
                ? "success"
                : "failure";

        const userGoal = String(
          rawTraj.userGoal ?? rawTraj.taskSummary ?? "Synthesized Task Skill",
        );
        const userCorrectionText =
          typeof rawTraj.userCorrectionText === "string"
            ? rawTraj.userCorrectionText
            : typeof rawTraj.userCorrection === "string"
              ? rawTraj.userCorrection
              : typeof rawTraj.correctionDetails === "string"
                ? rawTraj.correctionDetails
                : undefined;

        const trajectory: TurnTrajectoryRecord = {
          ...rawTraj,
          id: String(rawTraj.id ?? `traj_${Date.now()}`),
          userGoal,
          steps: normalizedSteps,
          finalOutcome,
          userCorrectionText,
        };

        const ingestOptions = (
          typeof body.options === "object" && body.options !== null ? body.options : undefined
        ) as SkillIngestOptions | undefined;
        const result = await services.skillSynthesizer.ingestTrajectory(trajectory, ingestOptions);

        if (!result.ok && result.error === "ZONE_0_BLOCKED") {
          sendJson(res, 403, {
            ...result,
            code: "ZONE_0_BLOCKED",
            error: result.reason ?? "Zone 0 public trajectory rejected",
          });
          return true;
        }

        if (!result.ok && result.status === "rejected") {
          sendJson(res, 400, {
            ...result,
            code: result.error ?? "INGEST_REJECTED",
            error: result.reason ?? "Trajectory ingestion rejected",
          });
          return true;
        }

        sendJson(res, 200, result);
        return true;
      } catch (err) {
        sendJson(res, 400, {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
        return true;
      }
    }

    // POST /api/corehub/skills/outcome
    if (pathname === "/api/corehub/skills/outcome") {
      if (!services.skillSynthesizer) {
        sendJson(res, 503, { ok: false, error: "Cory Skill Synthesizer service not available" });
        return true;
      }
      try {
        const body = (await parseJsonBody(req)) as Record<string, unknown>;
        const skillId = typeof body.skillId === "string" ? body.skillId.trim() : "";
        if (!skillId) {
          sendJson(res, 400, { ok: false, error: "Missing required 'skillId' field." });
          return true;
        }

        const rawOutcome =
          body.outcome ??
          (body.succeeded === true ? "success" : body.succeeded === false ? "failure" : undefined);
        const outcome = rawOutcome === "failure" ? "failure" : "success";

        const updatedSkill = await services.skillSynthesizer.recordSkillOutcome(skillId, outcome);
        sendJson(res, 200, {
          ok: true,
          skillId: updatedSkill.id,
          status: updatedSkill.status,
          version: updatedSkill.version,
          fitness: updatedSkill.metrics,
          skill: updatedSkill,
        });
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const statusCode = msg.includes("SKILL_NOT_FOUND") ? 404 : 400;
        sendJson(res, statusCode, {
          ok: false,
          error: msg,
        });
        return true;
      }
    }

    // POST /api/corehub/skills/lock
    if (pathname === "/api/corehub/skills/lock") {
      if (!services.skillSynthesizer) {
        sendJson(res, 503, { ok: false, error: "Cory Skill Synthesizer service not available" });
        return true;
      }
      try {
        const body = (await parseJsonBody(req)) as Record<string, unknown>;
        const skillId = typeof body.skillId === "string" ? body.skillId.trim() : "";
        if (!skillId) {
          sendJson(res, 400, { ok: false, error: "Missing required 'skillId' field." });
          return true;
        }
        const locked = body.locked !== false;
        const updatedSkill = await (services.skillSynthesizer as any).setSkillLock(skillId, locked);
        sendJson(res, 200, {
          ok: true,
          skillId,
          locked: updatedSkill?.locked === true,
          skill: updatedSkill,
        });
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const statusCode = msg.includes("SKILL_NOT_FOUND") || msg.includes("not found") ? 404 : 400;
        sendJson(res, statusCode, { ok: false, error: msg });
        return true;
      }
    }

    // POST /api/corehub/war-room/rooms or /api/corehub/warroom/rooms
    if (pathname === "/api/corehub/war-room/rooms" || pathname === "/api/corehub/warroom/rooms") {
      if (!services.warRoom) {
        sendJson(res, 503, { ok: false, error: "War Room Orchestrator service not available" });
        return true;
      }
      try {
        const body = (await parseJsonBody(req)) as Record<string, unknown>;
        const title = typeof body.title === "string" ? body.title.trim() : "";
        const purpose = typeof body.purpose === "string" ? body.purpose.trim() : "";
        if (!title || !purpose) {
          sendJson(res, 400, { ok: false, error: "Missing required 'title' or 'purpose' field." });
          return true;
        }
        const roomId = typeof body.roomId === "string" ? body.roomId.trim() : undefined;
        const leadAgentId =
          typeof body.leadAgentId === "string" ? body.leadAgentId.trim() : undefined;
        const members = Array.isArray(body.members) ? (body.members as WarRoomMember[]) : undefined;
        const inheritedSkills = Array.isArray(body.inheritedSkills)
          ? (body.inheritedSkills as string[])
          : undefined;
        const room = services.warRoom.createWarRoom({
          roomId,
          title,
          purpose,
          leadAgentId,
          members,
          inheritedSkills,
        });
        sendJson(res, 200, { ok: true, roomId: room.roomId, room });
        return true;
      } catch (err) {
        sendJson(res, 400, { ok: false, error: err instanceof Error ? err.message : String(err) });
        return true;
      }
    }

    // POST /api/corehub/warroom/:roomId/messages or /api/corehub/war-room/:roomId/messages
    const warRoomMessagesPostMatch = /^\/api\/corehub\/(?:war-room|warroom)\/([^/]+)\/messages$/.exec(pathname);
    if (method === "POST" && warRoomMessagesPostMatch) {
      const roomId = decodeURIComponent(warRoomMessagesPostMatch[1]);
      if (!services.warRoom) {
        sendJson(res, 503, { ok: false, error: "War Room Orchestrator service not available" });
        return true;
      }
      try {
        const body = (await parseJsonBody(req)) as Record<string, unknown>;
        const content = typeof body.content === "string" ? body.content.trim() : "";
        if (!content) {
          sendJson(res, 400, { ok: false, error: "Missing required 'content' field." });
          return true;
        }
        const senderName = typeof body.senderName === "string" ? body.senderName.trim() : undefined;
        const cwd = typeof body.cwd === "string" ? body.cwd : undefined;
        const maxHandoffDepth = typeof body.maxHandoffDepth === "number" ? body.maxHandoffDepth : undefined;

        let room = services.warRoom.getWarRoom(roomId);
        if (!room && (roomId === "coreblow-squad" || roomId === "default")) {
          room = services.warRoom.createWarRoom({
            roomId: "coreblow-squad",
            title: "CoreBlow Squad",
            purpose: "Unified Autonomous Multi-Agent Squad",
          });
        }
        if (!room) {
          sendJson(res, 404, { ok: false, error: `War room "${roomId}" not found.` });
          return true;
        }

        const result = await services.warRoom.postSquadMessage(room.roomId, {
          content,
          senderName,
          cwd,
          maxHandoffDepth,
        });

        sendJson(res, 200, {
          ok: true,
          userMessage: result.userMessage,
          replies: result.replies,
          room: result.room,
        });
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        sendJson(res, 400, { ok: false, error: msg });
        return true;
      }
    }

    // POST /api/corehub/warroom/:roomId/approvals/:approvalId or /api/corehub/war-room/:roomId/approvals/:approvalId
    const warRoomApprovalPostMatch = /^\/api\/corehub\/(?:war-room|warroom)\/([^/]+)\/approvals\/([^/]+)$/.exec(pathname);
    if (method === "POST" && warRoomApprovalPostMatch) {
      const roomId = decodeURIComponent(warRoomApprovalPostMatch[1]);
      const approvalId = decodeURIComponent(warRoomApprovalPostMatch[2]);
      if (!services.warRoom) {
        sendJson(res, 503, { ok: false, error: "War Room Orchestrator service not available" });
        return true;
      }
      try {
        const body = (await parseJsonBody(req)) as Record<string, unknown>;
        const decision = body.decision === "approved" || body.decision === "denied" ? body.decision : undefined;
        if (!decision) {
          sendJson(res, 400, { ok: false, error: "Missing or invalid 'decision' (expected 'approved' | 'denied')." });
          return true;
        }

        const resolved = services.warRoom.resolveChildApproval(roomId, approvalId, decision);
        sendJson(res, 200, { ok: true, approval: resolved });
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const statusCode = msg.includes("not found") ? 404 : 400;
        sendJson(res, statusCode, { ok: false, error: msg });
        return true;
      }
    }

    // POST /api/corehub/war-room/delegate
    if (pathname === "/api/corehub/war-room/delegate" || pathname === "/api/corehub/warroom/delegate") {
      if (!services.warRoom) {
        sendJson(res, 503, { ok: false, error: "War Room Orchestrator service not available" });
        return true;
      }
      try {
        const body = (await parseJsonBody(req)) as Record<string, unknown>;
        const roomId = typeof body.roomId === "string" ? body.roomId.trim() : "";
        const prompt =
          typeof body.prompt === "string"
            ? body.prompt.trim()
            : typeof body.message === "string"
              ? body.message.trim()
              : "";
        if (!roomId || !prompt) {
          sendJson(res, 400, { ok: false, error: "Missing required 'roomId' or 'prompt' field." });
          return true;
        }
        const result = await services.warRoom.routeMessageViaLead(roomId, prompt);
        sendJson(res, 200, { ok: true, ...result });
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const statusCode = msg.includes("not found") ? 404 : 400;
        sendJson(res, statusCode, { ok: false, error: msg });
        return true;
      }
    }

    // POST /api/corehub/war-room/fork or /api/corehub/warroom/fork
    if (pathname === "/api/corehub/war-room/fork" || pathname === "/api/corehub/warroom/fork") {
      if (!services.warRoom) {
        sendJson(res, 503, { ok: false, error: "War Room Orchestrator service not available" });
        return true;
      }
      try {
        const body = (await parseJsonBody(req)) as Record<string, unknown>;
        const roomId = typeof body.roomId === "string" ? body.roomId.trim() : "";
        const topicTitle =
          typeof body.topicTitle === "string"
            ? body.topicTitle.trim()
            : typeof body.title === "string"
              ? body.title.trim()
              : "";
        if (!roomId || !topicTitle) {
          sendJson(res, 400, {
            ok: false,
            error: "Missing required 'roomId' or 'topicTitle' field.",
          });
          return true;
        }
        const result = services.warRoom.forkSiblingThread(roomId, topicTitle);
        sendJson(res, 200, { ok: true, ...result });
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const statusCode = msg.includes("not found") ? 404 : 400;
        sendJson(res, statusCode, { ok: false, error: msg });
        return true;
      }
    }

    // POST /api/corehub/memory-wiki/scribe
    if (pathname === "/api/corehub/memory-wiki/scribe") {
      if (!services.knowledgeScribe) {
        sendJson(res, 503, { ok: false, error: "Cory Knowledge Scribe service not available" });
        return true;
      }
      try {
        const body = (await parseJsonBody(req)) as Record<string, unknown>;
        const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
        const title = typeof body.title === "string" ? body.title.trim() : "";
        if (!sessionId || !title) {
          sendJson(res, 400, {
            ok: false,
            error: "Missing required 'sessionId' or 'title' field.",
          });
          return true;
        }

        const rawScope = body.scope as Record<string, unknown> | undefined;
        const trustZone = (rawScope?.trustZone ?? body.trustZone) as string | undefined;
        const isPublicChannel = (rawScope?.isPublicChannel ?? body.isPublicChannel) as
          | boolean
          | undefined;

        if (trustZone === "public" || isPublicChannel === true) {
          sendJson(res, 403, {
            ok: false,
            error: "ZONE_0_BLOCKED: Public channels cannot mutate durable memory wiki pages.",
          });
          return true;
        }

        const category = typeof body.category === "string" ? (body.category as any) : undefined;
        const insights = Array.isArray(body.insights) ? (body.insights as string[]) : [];
        const decisions = Array.isArray(body.decisions) ? (body.decisions as string[]) : undefined;
        const constraints = Array.isArray(body.constraints)
          ? (body.constraints as string[])
          : undefined;
        const scope = rawScope as any;

        const page = await services.knowledgeScribe.captureScribeNote({
          sessionId,
          title,
          category,
          insights,
          decisions,
          constraints,
          scope,
        });

        sendJson(res, 200, { ok: true, page });
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const statusCode = msg.includes("ZONE_0_BLOCKED") ? 403 : 400;
        sendJson(res, statusCode, { ok: false, error: msg });
        return true;
      }
    }

    // POST /api/corehub/import-agent
    if (pathname === "/api/corehub/import-agent") {
      try {
        const body = (await parseJsonBody(req)) as Record<string, unknown>;
        const source =
          typeof body.source === "string" ? (body.source.trim() as ExternalAgentSource) : undefined;
        const sourceDir = typeof body.sourceDir === "string" ? body.sourceDir.trim() : "";
        if (!source || !sourceDir) {
          sendJson(res, 400, {
            ok: false,
            error: "Missing required 'source' or 'sourceDir' field.",
          });
          return true;
        }

        const dryRun = body.dryRun !== false;
        const workspaceId =
          typeof body.workspaceId === "string" ? body.workspaceId.trim() : undefined;
        const importer = services.importer ?? new UniversalAgentImporterService();

        if (dryRun) {
          const bundle = await importer.previewImport({ source, sourceDir });
          sendJson(res, 200, { ok: true, bundle });
          return true;
        }

        const bundle = await importer.applyImport({
          source,
          sourceDir,
          workspaceId,
          cory: services.cory,
          skillSynthesizer: services.skillSynthesizer,
        });
        sendJson(res, 200, { ok: true, bundle });
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        sendJson(res, 400, { ok: false, error: msg });
        return true;
      }
    }

    // POST /api/corehub/pr-workflow/drafts
    if (pathname === "/api/corehub/pr-workflow/drafts") {
      if (!services.prWorkflow) {
        sendJson(res, 503, { ok: false, error: "PR Workflow Orchestrator service not available" });
        return true;
      }
      try {
        const body = (await parseJsonBody(req)) as Record<string, unknown>;
        const draft = services.prWorkflow.createPullRequestDraft(body as any);
        sendJson(res, 201, { ok: true, draft });
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const statusCode = msg.includes("ZONE_0_BLOCKED") ? 403 : 400;
        sendJson(res, statusCode, { ok: false, error: msg });
        return true;
      }
    }

    // POST /api/corehub/pr-workflow/approve
    if (pathname === "/api/corehub/pr-workflow/approve") {
      if (!services.prWorkflow) {
        sendJson(res, 503, { ok: false, error: "PR Workflow Orchestrator service not available" });
        return true;
      }
      try {
        const body = (await parseJsonBody(req)) as Record<string, unknown>;
        const prId = typeof body.prId === "string" ? body.prId.trim() : "";
        const approverId =
          typeof body.approverId === "string" && body.approverId.trim()
            ? body.approverId.trim()
            : operator;
        const draft = services.prWorkflow.approvePullRequestDraft({ prId, approverId });
        sendJson(res, 200, { ok: true, draft });
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const statusCode = msg.includes("ZONE_0_BLOCKED") ? 403 : 400;
        sendJson(res, statusCode, { ok: false, error: msg });
        return true;
      }
    }

    // POST /api/corehub/pr-workflow/commit
    if (pathname === "/api/corehub/pr-workflow/commit") {
      if (!services.prWorkflow) {
        sendJson(res, 503, { ok: false, error: "PR Workflow Orchestrator service not available" });
        return true;
      }
      try {
        const body = (await parseJsonBody(req)) as Record<string, unknown>;
        const prId = typeof body.prId === "string" ? body.prId.trim() : "";
        const approverId =
          typeof body.approverId === "string" && body.approverId.trim()
            ? body.approverId.trim()
            : operator;
        const cwd = typeof body.cwd === "string" ? body.cwd : undefined;
        const commitMessage = typeof body.commitMessage === "string" ? body.commitMessage : undefined;
        const createBranch = body.createBranch === true;
        const branchName = typeof body.branchName === "string" ? body.branchName : undefined;

        const result = await services.prWorkflow.commitApprovedPullRequestDraft({
          prId,
          approverId,
          cwd,
          commitMessage,
          createBranch,
          branchName,
        });
        sendJson(res, 200, { ok: true, result });
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const statusCode = msg.includes("ZONE_0_BLOCKED") ? 403 : 400;
        sendJson(res, statusCode, { ok: false, error: msg });
        return true;
      }
    }

    // POST /api/corehub/chat-views/render
    if (pathname === "/api/corehub/chat-views/render") {
      try {
        const body = (await parseJsonBody(req)) as Record<string, unknown>;
        const view = (body.view ?? body) as ChatNativePluginView;
        const rendered = renderChatNativeView(view);
        sendJson(res, 200, { ok: true, rendered });
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        sendJson(res, 400, { ok: false, error: msg });
        return true;
      }
    }

    // POST /api/corehub/desktop/quick-launch
    if (pathname === "/api/corehub/desktop/quick-launch") {
      try {
        const body = (await parseJsonBody(req)) as Record<string, unknown>;
        const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
        if (!prompt) {
          sendJson(res, 400, { ok: false, error: "Missing required 'prompt' field." });
          return true;
        }
        const pairedApp =
          body.pairedApp && typeof body.pairedApp === "object"
            ? (body.pairedApp as PairedDesktopAppContext)
            : undefined;
        const spawnWarRoom = body.spawnWarRoom === true;

        const result = await executeDesktopQuickLaunch(
          services as unknown as MicrokernelServicesResult,
          {
            prompt,
            pairedApp,
            spawnWarRoom,
          },
        );

        let reActResult = undefined;
        if (body.autonomousReAct === true || body.react === true) {
          reActResult = await runCoreBlowReActLoop({
            prompt,
            executionProfile: (typeof body.executionProfile === "string"
              ? body.executionProfile
              : "Full access") as ExecutionProfile,
            defaultCwd: typeof body.cwd === "string" ? body.cwd : undefined,
          });
        }

        sendJson(res, 200, { ...result, ...(reActResult ? { reActResult } : {}) });
        return true;
      } catch (err) {
        sendJson(res, 400, { ok: false, error: err instanceof Error ? err.message : String(err) });
        return true;
      }
    }

    // POST /api/corehub/chat/react (supports real-time SSE streaming for Desktop Studio)
    if (pathname === "/api/corehub/chat/react") {
      try {
        const acceptHeader = (Array.isArray(req.headers.accept) ? req.headers.accept.join(", ") : req.headers.accept) || "";
        const isSse = acceptHeader.toLowerCase().includes("text/event-stream");

        const body = (await parseJsonBody(req)) as Record<string, unknown>;
        const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
        if (!prompt) {
          sendJson(res, 400, { ok: false, error: "Missing required 'prompt' field." });
          return true;
        }
        const executionProfile =
          typeof body.executionProfile === "string"
            ? (body.executionProfile as ExecutionProfile)
            : "Full access";
        const defaultCwd = typeof body.cwd === "string" ? body.cwd : undefined;
        const model = typeof body.model === "string" ? body.model : undefined;
        const providerUrl = typeof body.providerUrl === "string" ? body.providerUrl : undefined;
        const apiKey = typeof body.apiKey === "string" ? body.apiKey : undefined;
        const customApiKey = typeof body.customApiKey === "string" ? body.customApiKey : undefined;
        const effectiveApiKey = apiKey ?? customApiKey;
        const anthropicApiKey = typeof body.anthropicApiKey === "string" ? body.anthropicApiKey : undefined;
        const openAiApiKey = typeof body.openAiApiKey === "string" ? body.openAiApiKey : undefined;
        const geminiApiKey = typeof body.geminiApiKey === "string" ? body.geminiApiKey : undefined;
        const groqApiKey = typeof body.groqApiKey === "string" ? body.groqApiKey : undefined;
        const localOllamaUrl = typeof body.localOllamaUrl === "string" ? body.localOllamaUrl : undefined;
        const maxTurns = typeof body.maxTurns === "number" ? body.maxTurns : undefined;
        const messages = Array.isArray(body.messages) ? (body.messages as any[]) : undefined;
        const trustZone = typeof body.trustZone === "string" ? body.trustZone : undefined;
        const userScope = typeof body.userScope === "string" ? body.userScope : undefined;
        const runId = typeof body.runId === "string" ? body.runId : undefined;
        const sessionId = typeof body.sessionId === "string" ? body.sessionId : undefined;

        if (isSse && body.stream !== false) {
          res.writeHead(200, {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          });

          const result = await runCoreBlowReActLoop({
            prompt,
            messages,
            executionProfile,
            defaultCwd,
            model,
            providerUrl,
            apiKey: effectiveApiKey,
            anthropicApiKey,
            openAiApiKey,
            geminiApiKey,
            groqApiKey,
            localOllamaUrl,
            maxTurns,
            runId,
            sessionId,
            trustZone,
            userScope,
            onProgressStep: (step) => {
              res.write(`data: ${JSON.stringify({ step })}\n\n`);
            },
          });

          for (const step of result.toolSteps) {
            res.write(`data: ${JSON.stringify({ toolStep: step, step })}\n\n`);
          }

          res.write(
            `data: ${JSON.stringify({
              choices: [
                {
                  delta: { content: result.reply },
                  finish_reason: result.ok ? "stop" : "error",
                },
              ],
              toolSteps: result.toolSteps,
              reply: result.reply,
              ok: result.ok,
            })}\n\n`,
          );

          try {
            appendTurnToUnifiedSession({
              sessionId,
              prompt,
              reply: result.reply,
              toolSteps: result.toolSteps,
              cwd: defaultCwd,
              executionProfile,
              model,
              surface: "desktop",
            });
          } catch {}

          res.write("data: [DONE]\n\n");
          res.end();
          return true;
        }

        const result = await runCoreBlowReActLoop({
          prompt,
          messages,
          executionProfile,
          defaultCwd,
          model,
          providerUrl,
          apiKey: effectiveApiKey,
          anthropicApiKey,
          openAiApiKey,
          geminiApiKey,
          groqApiKey,
          localOllamaUrl,
          maxTurns,
          runId,
          sessionId,
          trustZone,
          userScope,
        });

        try {
          appendTurnToUnifiedSession({
            sessionId,
            prompt,
            reply: result.reply,
            toolSteps: result.toolSteps,
            cwd: defaultCwd,
            executionProfile,
            model,
            surface: "desktop",
          });
        } catch {}

        sendJson(res, 200, result);
        return true;
      } catch (err) {
        const errMsg = err instanceof Error ? (err.stack ?? err.message) : String(err);
        console.error(`[chat/react] error: ${errMsg}`);
        if (res.headersSent) {
          res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
          res.write("data: [DONE]\n\n");
          res.end();
          return true;
        }
        sendJson(res, 400, { ok: false, error: err instanceof Error ? err.message : String(err) });
        return true;
      }
    }

    // POST /api/corehub/sessions (Create or upsert session thread)
    if (method === "POST" && pathname === "/api/corehub/sessions") {
      try {
        const body = (await parseJsonBody(req)) as Record<string, unknown>;
        const id =
          typeof body.id === "string" && body.id.trim().length > 0
            ? body.id.trim()
            : `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const saved = upsertUnifiedSession({
          id,
          title: typeof body.title === "string" ? body.title : undefined,
          messages: Array.isArray(body.messages) ? body.messages : undefined,
          cwd: typeof body.cwd === "string" ? body.cwd : undefined,
          executionProfile: typeof body.executionProfile === "string" ? body.executionProfile : undefined,
          model: typeof body.model === "string" ? body.model : undefined,
          surface: typeof body.surface === "string" ? (body.surface as any) : "desktop",
        });
        sendJson(res, 200, { ok: true, session: saved });
        return true;
      } catch (err) {
        sendJson(res, 400, { ok: false, error: err instanceof Error ? err.message : String(err) });
        return true;
      }
    }

    // DELETE /api/corehub/sessions/:id
    if (method === "DELETE" && pathname.startsWith("/api/corehub/sessions/")) {
      const id = pathname.slice("/api/corehub/sessions/".length).trim();
      const deleted = deleteUnifiedSession(id);
      sendJson(res, 200, { ok: true, deleted, id });
      return true;
    }

    // POST /api/corehub/desktop/diff-inspector
    if (pathname === "/api/corehub/desktop/diff-inspector") {
      try {
        const body = (await parseJsonBody(req)) as Record<string, unknown>;
        const diffText = typeof body.diffText === "string" ? body.diffText : "";
        const branchName = typeof body.branchName === "string" ? body.branchName : "main";
        const prId = typeof body.prId === "string" ? body.prId : undefined;
        const changedFiles = Array.isArray(body.changedFiles)
          ? (body.changedFiles as string[])
          : undefined;

        const diffView = evaluateDesktopWorktreeDiff({
          diffText,
          branchName,
          prId,
          changedFiles,
        });
        sendJson(res, 200, { ok: true, diffView });
        return true;
      } catch (err) {
        sendJson(res, 400, { ok: false, error: err instanceof Error ? err.message : String(err) });
        return true;
      }
    }
  }

  sendJson(res, 404, { ok: false, error: "CoreHub route not found", pathname });
  return true;
}
