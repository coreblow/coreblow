import type { GatewayService, ServiceHealth } from "../../gateway/service-registry.js";

export interface OpenAiCompatibleProviderSpec {
  id: string;
  name: string;
  defaultBaseUrl: string;
  envKey: string;
  contextWindow: number;
  supportsStreaming: boolean;
  supportsReasoningEffort: boolean;
  supportsToolCalling: boolean;
  aliases?: string[];
  defaultHeaders?: Record<string, string>;
}

export interface ProviderRequestConfig {
  url: string;
  headers: Record<string, string>;
  body: string;
}

export class ConsolidatedOpenAiRegistry implements GatewayService {
  public readonly name = "consolidated-openai-registry";
  private isRunning = false;
  private readonly providers = new Map<string, OpenAiCompatibleProviderSpec>();
  private readonly aliasMap = new Map<string, string>();

  constructor(customProviders?: OpenAiCompatibleProviderSpec[]) {
    const builtins: OpenAiCompatibleProviderSpec[] = [
      {
        id: "vllm",
        name: "vLLM Local Server",
        defaultBaseUrl: "http://127.0.0.1:8000/v1",
        envKey: "VLLM_API_KEY",
        contextWindow: 32_768,
        supportsStreaming: true,
        supportsReasoningEffort: false,
        supportsToolCalling: true,
        aliases: ["local-vllm", "vllm-local"],
      },
      {
        id: "ollama",
        name: "Ollama Local Engine",
        defaultBaseUrl: "http://127.0.0.1:11434/v1",
        envKey: "OLLAMA_API_KEY",
        contextWindow: 32_768,
        supportsStreaming: true,
        supportsReasoningEffort: false,
        supportsToolCalling: true,
        aliases: ["local-ollama", "ollama-local"],
      },
      {
        id: "deepseek",
        name: "DeepSeek Platform",
        defaultBaseUrl: "https://api.deepseek.com/v1",
        envKey: "DEEPSEEK_API_KEY",
        contextWindow: 64_000,
        supportsStreaming: true,
        supportsReasoningEffort: true,
        supportsToolCalling: true,
        aliases: ["deepseek-ai"],
      },
      {
        id: "groq",
        name: "Groq LPU Acceleration",
        defaultBaseUrl: "https://api.groq.com/openai/v1",
        envKey: "GROQ_API_KEY",
        contextWindow: 128_000,
        supportsStreaming: true,
        supportsReasoningEffort: false,
        supportsToolCalling: true,
      },
      {
        id: "xai",
        name: "xAI Grok Platform",
        defaultBaseUrl: "https://api.x.ai/v1",
        envKey: "XAI_API_KEY",
        contextWindow: 131_072,
        supportsStreaming: true,
        supportsReasoningEffort: true,
        supportsToolCalling: true,
        aliases: ["grok"],
      },
      {
        id: "openrouter",
        name: "OpenRouter Unified Gateway",
        defaultBaseUrl: "https://openrouter.ai/api/v1",
        envKey: "OPENROUTER_API_KEY",
        contextWindow: 128_000,
        supportsStreaming: true,
        supportsReasoningEffort: true,
        supportsToolCalling: true,
        defaultHeaders: {
          "HTTP-Referer": "https://coreblow.com",
          "X-Title": "CoreBlow Agent-OS",
        },
      },
      {
        id: "moonshot",
        name: "Moonshot AI Kimi",
        defaultBaseUrl: "https://api.moonshot.cn/v1",
        envKey: "MOONSHOT_API_KEY",
        contextWindow: 128_000,
        supportsStreaming: true,
        supportsReasoningEffort: false,
        supportsToolCalling: true,
        aliases: ["kimi"],
      },
      {
        id: "together",
        name: "Together AI Inference",
        defaultBaseUrl: "https://api.together.xyz/v1",
        envKey: "TOGETHER_API_KEY",
        contextWindow: 128_000,
        supportsStreaming: true,
        supportsReasoningEffort: false,
        supportsToolCalling: true,
      },
      {
        id: "chutes",
        name: "Chutes AI Decentralized Compute",
        defaultBaseUrl: "https://chutes.ai/v1",
        envKey: "CHUTES_API_KEY",
        contextWindow: 64_000,
        supportsStreaming: true,
        supportsReasoningEffort: false,
        supportsToolCalling: true,
      },
    ];

    for (const spec of builtins) {
      this.registerProvider(spec);
    }
    if (customProviders) {
      for (const spec of customProviders) {
        this.registerProvider(spec);
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
      return { status: "down", detail: "Consolidated OpenAI Registry is stopped." };
    }
    return {
      status: "healthy",
      detail: `Operating normally with ${this.providers.size} registered providers and ${this.aliasMap.size} aliases.`,
    };
  }

  public registerProvider(spec: OpenAiCompatibleProviderSpec): void {
    const normalizedId = spec.id.toLowerCase().trim();
    this.providers.set(normalizedId, spec);
    this.aliasMap.set(normalizedId, normalizedId);

    if (spec.aliases) {
      for (const alias of spec.aliases) {
        this.aliasMap.set(alias.toLowerCase().trim(), normalizedId);
      }
    }
  }

  public resolveProvider(idOrAlias: string): OpenAiCompatibleProviderSpec | undefined {
    const key = idOrAlias.toLowerCase().trim();
    const primaryId = this.aliasMap.get(key) ?? key;
    return this.providers.get(primaryId);
  }

  public listProviders(): OpenAiCompatibleProviderSpec[] {
    return Array.from(this.providers.values());
  }

  public buildRequestConfig(params: {
    providerId: string;
    model: string;
    payload: Record<string, unknown>;
    apiKey?: string;
    baseUrlOverride?: string;
    customHeaders?: Record<string, string>;
  }): ProviderRequestConfig {
    const spec = this.resolveProvider(params.providerId);
    if (!spec) {
      throw new Error(`Cannot build request: Provider '${params.providerId}' is not registered.`);
    }

    const baseUrl = params.baseUrlOverride ?? spec.defaultBaseUrl;
    const cleanBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    const url = `${cleanBase}/chat/completions`;

    const token = params.apiKey ?? process.env[spec.envKey] ?? "placeholder-local-token";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...spec.defaultHeaders,
      ...params.customHeaders,
    };

    const finalPayload = {
      model: params.model,
      ...params.payload,
    };

    return {
      url,
      headers,
      body: JSON.stringify(finalPayload),
    };
  }
}
