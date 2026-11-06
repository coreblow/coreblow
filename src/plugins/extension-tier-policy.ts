import type { GatewayService, ServiceHealth } from "../gateway/service-registry.js";

export type ExtensionTier = "core" | "corehub_on_demand";

export interface ExtensionTierPolicyOptions {
  customCoreExtensions?: string[];
  customOnDemandExtensions?: string[];
}

export class ExtensionTierPolicy implements GatewayService {
  public readonly name = "extension-tier-policy";
  private isRunning = false;

  private readonly coreExtensions = new Set<string>([
    "telegram",
    "whatsapp",
    "slack",
    "webhooks",
    "browser",
    "browser-runtime",
    "memory-core",
    "cory",
    "cory-memory",
    "cory-skill-synthesizer",
    "cory-knowledge-scribe",
    "war-room-orchestrator",
    "pr-workflow-orchestrator",
    "rag",
    "rag-runtime",
    "tools",
    "tool-runtime",
    "voice",
    "voice-runtime",
    "provider-runtime",
    "openai",
    "anthropic",
    "google",
    "ollama",
    "vllm",
    "xai",
    "deepseek",
    "groq",
    "openrouter",
    "acp",
  ]);

  private readonly onDemandExtensions = new Set<string>([
    // Externalized community channels
    "discord",
    "matrix",
    "twitch",
    "feishu",
    "line",
    "zalo",
    "zalouser",
    "qqbot",
    "mattermost",
    "nextcloud-talk",
    "synology-chat",
    "tlon",
    "nostr",
    "irc",
    "msteams",
    "bluebubbles",
    "bluesky",
    "google-chat",
    "googlechat",
    "imessage",
    "signal",
    "workflow-shell",
    // Providers & connectors
    "voice-call",
    "minimax",
    "modelstudio",
    "kilocode",
    "vercel-ai-gateway",
    "microsoft-foundry",
    "microsoft",
    "zai",
    "openshell",
    "venice",
    "synthetic",
    "qianfan",
    "volcengine",
    "xiaomi",
    "kimi-coding",
    "byteplus",
    "cloudflare-ai-gateway",
    "anthropic-vertex",
    "opencode",
    "opencode-go",
    "brave",
    "nvidia",
    "amazon-bedrock",
    "image-generation-core",
    "speech-core",
    "auto-reply",
    "diagnostics",
    "gemini-auth",
    "link-understanding",
    "media-understanding-core",
    "minimax-auth",
    "qwen-auth",
    "tts",
    "mqtt",
    "diffs",
  ]);

  constructor(options: ExtensionTierPolicyOptions = {}) {
    if (options.customCoreExtensions) {
      for (const id of options.customCoreExtensions) {
        this.registerExtensionTier(id, "core");
      }
    }
    if (options.customOnDemandExtensions) {
      for (const id of options.customOnDemandExtensions) {
        this.registerExtensionTier(id, "corehub_on_demand");
      }
    }
  }

  public async start(): Promise<void> {
    this.isRunning = true;
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
  }

  public health(): ServiceHealth {
    if (!this.isRunning) {
      return { status: "down", detail: "Extension Tier Policy service is stopped." };
    }
    return {
      status: "healthy",
      detail: `Tracking ${this.coreExtensions.size} Core extensions and ${this.onDemandExtensions.size} CoreHub on-demand extensions.`,
    };
  }

  public getExtensionTier(extensionId: string): ExtensionTier {
    const normalized = extensionId
      .toLowerCase()
      .trim()
      .replace(/^extensions\//, "");
    if (this.coreExtensions.has(normalized)) {
      return "core";
    }
    return "corehub_on_demand";
  }

  public isCoreTier(extensionId: string): boolean {
    return this.getExtensionTier(extensionId) === "core";
  }

  public isCoreHubOnDemand(extensionId: string): boolean {
    return this.getExtensionTier(extensionId) === "corehub_on_demand";
  }

  public registerExtensionTier(extensionId: string, tier: ExtensionTier): void {
    const normalized = extensionId
      .toLowerCase()
      .trim()
      .replace(/^extensions\//, "");
    if (tier === "core") {
      this.coreExtensions.add(normalized);
      this.onDemandExtensions.delete(normalized);
    } else {
      this.onDemandExtensions.add(normalized);
      this.coreExtensions.delete(normalized);
    }
  }

  public partitionExtensionList(extensionIds: string[]): {
    core: string[];
    onDemand: string[];
  } {
    const core: string[] = [];
    const onDemand: string[] = [];

    for (const id of extensionIds) {
      if (this.isCoreTier(id)) {
        core.push(id);
      } else {
        onDemand.push(id);
      }
    }

    return { core, onDemand };
  }

  public listCoreExtensions(): string[] {
    return Array.from(this.coreExtensions.values()).sort();
  }

  public listOnDemandExtensions(): string[] {
    return Array.from(this.onDemandExtensions.values()).sort();
  }
}
