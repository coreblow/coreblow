import type {
  CapabilityConsentLedger,
  CoreHubCapability,
  PluginLifecycleState,
} from "./app-store-contract.js";
import { isCoreHubCapability } from "./app-store-contract.js";
import type { ExtensionTier, ExtensionTierPolicy } from "./extension-tier-policy.js";

export interface StorefrontCatalogEntry {
  readonly id: string;
  readonly name?: string;
  readonly summary?: string;
  readonly description?: string;
  readonly version?: string;
  readonly category?: string;
  readonly tier?: string;
  readonly installed?: boolean;
  readonly author?: string;
  readonly capabilities?: readonly string[];
  readonly publisher?: {
    readonly displayName?: string;
    readonly handle?: string;
    readonly name?: string;
  };
  readonly hotReloadSafe?: boolean;
}

export const BUILTIN_KERNEL_CAPABILITY_ENTRIES: readonly StorefrontCatalogEntry[] = Object.freeze([
  {
    id: "cory-memory",
    name: "Cory Built-in Memory",
    summary: "Native hierarchical agent memory and workspace context.",
    description: "Native hierarchical agent memory and workspace context.",
    version: "1.0.0",
    capabilities: [],
    publisher: { displayName: "CoreBlow Kernel", name: "CoreBlow" },
    hotReloadSafe: true,
  },
  {
    id: "cory-skill-synthesizer",
    name: "Cory EvoLoop Skill Synthesizer",
    summary: "Closed-loop skill synthesizer and self-learning engine for CoreBlow.",
    description: "Closed-loop skill synthesizer and self-learning engine for CoreBlow.",
    version: "1.0.0",
    capabilities: [],
    publisher: { displayName: "CoreBlow Kernel", name: "CoreBlow" },
    hotReloadSafe: true,
  },
  {
    id: "cory-knowledge-scribe",
    name: "Cory Knowledge Scribe & Memory Wiki",
    summary:
      "Browsable memory wiki, zero-stall prepared compaction, and reusable knowledge scribe engine.",
    description:
      "Browsable memory wiki, zero-stall prepared compaction, and reusable knowledge scribe engine.",
    version: "1.0.0",
    capabilities: [],
    publisher: { displayName: "CoreBlow Kernel", name: "CoreBlow" },
    hotReloadSafe: true,
  },
  {
    id: "war-room-orchestrator",
    name: "Multi-Agent War Room Orchestrator",
    summary: "Collective multi-agent war room, lead agent routing, and Kanban DAG orchestration.",
    description:
      "Collective multi-agent war room, lead agent routing, and Kanban DAG orchestration.",
    version: "1.0.0",
    capabilities: [],
    publisher: { displayName: "CoreBlow Kernel", name: "CoreBlow" },
    hotReloadSafe: true,
  },
  {
    id: "pr-workflow-orchestrator",
    name: "Autonomous Git & PR Workflow Orchestrator",
    description:
      "Automated git diff analysis, pre-flight gate enforcement, PR blueprint compilation, and approval management.",
    category: "agents",
    tier: "core",
    installed: true,
    author: "CoreBlow Sovereign Team",
    version: "1.0.0",
    capabilities: ["git-workflow", "pr-blueprint", "pre-flight-gates", "operator-approval"],
  },
  {
    id: "provider-runtime",
    name: "AI Provider Runtime",
    summary: "Native AI model provider runtime and streaming execution.",
    description: "Native AI model provider runtime and streaming execution.",
    version: "1.0.0",
    capabilities: [],
    publisher: { displayName: "CoreBlow Kernel", name: "CoreBlow" },
    hotReloadSafe: true,
  },
  {
    id: "rag-runtime",
    name: "Vector & Document RAG Runtime",
    summary: "Native vector/RAG and document knowledge runtime.",
    description: "Native vector/RAG and document knowledge runtime.",
    version: "1.0.0",
    capabilities: [],
    publisher: { displayName: "CoreBlow Kernel", name: "CoreBlow" },
    hotReloadSafe: true,
  },
  {
    id: "tool-runtime",
    name: "Native Tool Runtime",
    summary: "Native tool execution, sandboxing, and policy enforcement.",
    description: "Native tool execution, sandboxing, and policy enforcement.",
    version: "1.0.0",
    capabilities: [],
    publisher: { displayName: "CoreBlow Kernel", name: "CoreBlow" },
    hotReloadSafe: true,
  },
  {
    id: "browser-runtime",
    name: "Native Browser Runtime",
    summary: "Native browser automation and CDP session management.",
    description: "Native browser automation and CDP session management.",
    version: "1.0.0",
    capabilities: [],
    publisher: { displayName: "CoreBlow Kernel", name: "CoreBlow" },
    hotReloadSafe: true,
  },
  {
    id: "voice-runtime",
    name: "Native Voice Runtime",
    summary: "Native speech synthesis and TTS voice engine.",
    description: "Native speech synthesis and TTS voice engine.",
    version: "1.0.0",
    capabilities: [],
    publisher: { displayName: "CoreBlow Kernel", name: "CoreBlow" },
    hotReloadSafe: true,
  },
]);

export interface StorefrontAppCard {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly tier: ExtensionTier;
  readonly isKernel: boolean;
  readonly lifecycleState: PluginLifecycleState;
  readonly requiredCapabilities: readonly CoreHubCapability[];
  readonly consentGranted: boolean;
  readonly hotReloadSafe: boolean;
  readonly canRollback: boolean;
  readonly installSpec: string;
  readonly version: string;
  readonly publisher?: string;
}

export interface BuildStorefrontCatalogViewParams {
  readonly catalogEntries: readonly StorefrontCatalogEntry[];
  readonly installedStates?: Readonly<Record<string, PluginLifecycleState>>;
  readonly consentLedger?: CapabilityConsentLedger;
  readonly tierPolicy?: ExtensionTierPolicy;
  readonly backupVersions?: Readonly<Record<string, readonly string[]>>;
  readonly searchQuery?: string;
  readonly tierFilter?: "all" | ExtensionTier;
}

export function buildStorefrontCatalogView(
  params: BuildStorefrontCatalogViewParams,
): readonly StorefrontAppCard[] {
  const {
    catalogEntries,
    installedStates = {},
    consentLedger,
    tierPolicy,
    backupVersions = {},
    searchQuery,
    tierFilter = "all",
  } = params;

  const cards: StorefrontAppCard[] = [];
  const normalizedQuery = searchQuery?.toLowerCase().trim();

  for (const entry of catalogEntries) {
    const rawId = entry.id.trim();
    const shortId = rawId.replace(/^@coreblow\//, "");

    // 1. Determine Tier
    const tier: ExtensionTier = tierPolicy
      ? tierPolicy.getExtensionTier(shortId)
      : "corehub_on_demand";
    const isKernel = tier === "core";

    // Tier filter check
    if (tierFilter !== "all" && tier !== tierFilter) {
      continue;
    }

    // 2. Lifecycle State
    const lifecycleState: PluginLifecycleState =
      installedStates[rawId] ?? installedStates[shortId] ?? (isKernel ? "active" : "uninstalled");

    // 3. Required Capabilities
    const requiredCapabilities: CoreHubCapability[] = (entry.capabilities ?? []).filter(
      (cap): cap is CoreHubCapability => isCoreHubCapability(cap),
    );

    // 4. Consent status
    let consentGranted = false;
    if (consentLedger) {
      const consentRecord = consentLedger.getConsent(rawId) ?? consentLedger.getConsent(shortId);
      if (consentRecord) {
        const approved = new Set(consentRecord.approvedCapabilities);
        consentGranted = requiredCapabilities.every((cap) => approved.has(cap));
      }
    }

    // 5. Rollback availability (Kernel capabilities are built-in, never rolled back via plugin store)
    const backups = backupVersions[rawId] ?? backupVersions[shortId] ?? [];
    const canRollback = !isKernel && backups.length > 0;

    // 6. Hot-Reload Safety
    const hotReloadSafe = typeof entry.hotReloadSafe === "boolean" ? entry.hotReloadSafe : true;

    // 7. Install Spec (Kernel native capabilities are built into CoreBlow base runtime)
    const installSpec = isKernel
      ? ""
      : rawId.startsWith("@coreblow/")
        ? `corehub:${rawId}`
        : `corehub:@coreblow/${rawId}`;

    const label = entry.name?.trim() || shortId;
    const description =
      entry.summary?.trim() || entry.description?.trim() || `CoreBlow ${shortId} plugin`;
    const version = entry.version?.trim() || "1.0.0";
    const publisher =
      entry.publisher?.displayName ||
      entry.publisher?.name ||
      entry.publisher?.handle ||
      entry.author;

    // 8. Search query filter
    if (normalizedQuery && normalizedQuery.length > 0) {
      const matches =
        rawId.toLowerCase().includes(normalizedQuery) ||
        shortId.toLowerCase().includes(normalizedQuery) ||
        label.toLowerCase().includes(normalizedQuery) ||
        description.toLowerCase().includes(normalizedQuery) ||
        requiredCapabilities.some((cap) => cap.toLowerCase().includes(normalizedQuery));

      if (!matches) {
        continue;
      }
    }

    const card: StorefrontAppCard = {
      id: rawId,
      label,
      description,
      tier,
      isKernel,
      lifecycleState,
      requiredCapabilities: Object.freeze(requiredCapabilities),
      consentGranted,
      hotReloadSafe,
      canRollback,
      installSpec,
      version,
      ...(publisher ? { publisher } : {}),
    };

    cards.push(Object.freeze(card));
  }

  return Object.freeze(cards);
}
