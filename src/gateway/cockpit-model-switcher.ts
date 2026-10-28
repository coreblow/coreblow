import type { GatewayService, ServiceHealth } from "./service-registry.js";

export type ModelExecutionTier = "local_edge" | "cloud_frontier";

export interface ModelProfile {
  id: string;
  name: string;
  tier: ModelExecutionTier;
  provider: string;
  contextWindow: number;
  costPerInputToken: number;
  costPerOutputToken: number;
  typicalLatencyMs: number;
  rtf?: number;
  isHealthy: boolean;
}

export interface ModelTelemetryMetrics {
  activeModelId: string;
  activeTier: ModelExecutionTier;
  totalTokensIn: number;
  totalTokensOut: number;
  estimatedCostUsd: number;
  averageLatencyMs: number;
  totalCalls: number;
  measuredRtf?: number;
}

export interface CockpitModelSwitcherOptions {
  initialActiveModelId?: string;
  defaultModels?: ModelProfile[];
}

export class CockpitModelSwitcher implements GatewayService {
  public readonly name = "cockpit-model-switcher";
  private isRunning = false;
  private activeModelId: string;
  private readonly models = new Map<string, ModelProfile>();
  private readonly listeners = new Set<(metrics: ModelTelemetryMetrics) => void>();

  private totalTokensIn = 0;
  private totalTokensOut = 0;
  private totalCostUsd = 0;
  private totalLatencyMs = 0;
  private totalCalls = 0;
  private lastMeasuredRtf?: number;

  constructor(options: CockpitModelSwitcherOptions = {}) {
    const defaults: ModelProfile[] = options.defaultModels ?? [
      {
        id: "local/vllm-qwen",
        name: "Qwen 2.5 7B (Local vLLM)",
        tier: "local_edge",
        provider: "vllm",
        contextWindow: 32_768,
        costPerInputToken: 0,
        costPerOutputToken: 0,
        typicalLatencyMs: 45,
        isHealthy: true,
      },
      {
        id: "local/mlx-tts",
        name: "Apple Silicon MLX Speech Engine",
        tier: "local_edge",
        provider: "mlx-tts",
        contextWindow: 4_096,
        costPerInputToken: 0,
        costPerOutputToken: 0,
        typicalLatencyMs: 80,
        rtf: 0.35,
        isHealthy: true,
      },
      {
        id: "cloud/claude-3-7-sonnet",
        name: "Claude 3.7 Sonnet (Anthropic)",
        tier: "cloud_frontier",
        provider: "anthropic",
        contextWindow: 200_000,
        costPerInputToken: 0.000003,
        costPerOutputToken: 0.000015,
        typicalLatencyMs: 650,
        isHealthy: true,
      },
      {
        id: "cloud/gemini-2-5-pro",
        name: "Gemini 2.5 Pro (Google)",
        tier: "cloud_frontier",
        provider: "gemini",
        contextWindow: 1_000_000,
        costPerInputToken: 0.00000125,
        costPerOutputToken: 0.000005,
        typicalLatencyMs: 700,
        isHealthy: true,
      },
    ];

    for (const m of defaults) {
      this.models.set(m.id, m);
    }
    this.activeModelId = options.initialActiveModelId ?? "local/vllm-qwen";
  }

  public async start(): Promise<void> {
    this.isRunning = true;
  }

  public async stop(): Promise<void> {
    this.listeners.clear();
    this.isRunning = false;
  }

  public health(): ServiceHealth {
    if (!this.isRunning) {
      return { status: "down", detail: "Cockpit Model Switcher is stopped." };
    }
    const active = this.models.get(this.activeModelId);
    return {
      status: active?.isHealthy ? "healthy" : "degraded",
      detail: `Active model: '${this.activeModelId}' (${active?.tier ?? "unknown"}). Total registered: ${this.models.size}.`,
    };
  }

  public registerModel(profile: ModelProfile): void {
    this.models.set(profile.id, profile);
  }

  public listModels(): ModelProfile[] {
    return Array.from(this.models.values());
  }

  public getActiveModel(): ModelProfile {
    const active = this.models.get(this.activeModelId);
    if (!active) {
      throw new Error(`Active model '${this.activeModelId}' is not registered.`);
    }
    return active;
  }

  public setActiveModel(modelId: string): ModelProfile {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Cannot switch to model '${modelId}': Not found in registered catalog.`);
    }
    this.activeModelId = modelId;
    this.notifySubscribers();
    return model;
  }

  public recordTurnUsage(params: {
    modelId: string;
    tokensIn: number;
    tokensOut: number;
    latencyMs: number;
    rtf?: number;
  }): void {
    const model = this.models.get(params.modelId);
    if (!model) return;

    this.totalTokensIn += params.tokensIn;
    this.totalTokensOut += params.tokensOut;
    this.totalLatencyMs += params.latencyMs;
    this.totalCalls += 1;

    const callCost =
      params.tokensIn * model.costPerInputToken + params.tokensOut * model.costPerOutputToken;
    this.totalCostUsd += callCost;

    if (typeof params.rtf === "number") {
      this.lastMeasuredRtf = params.rtf;
    }

    this.notifySubscribers();
  }

  public getTelemetryMetrics(): ModelTelemetryMetrics {
    const active = this.models.get(this.activeModelId);
    return {
      activeModelId: this.activeModelId,
      activeTier: active?.tier ?? "local_edge",
      totalTokensIn: this.totalTokensIn,
      totalTokensOut: this.totalTokensOut,
      estimatedCostUsd: Number(this.totalCostUsd.toFixed(6)),
      averageLatencyMs: this.totalCalls > 0 ? Math.round(this.totalLatencyMs / this.totalCalls) : 0,
      totalCalls: this.totalCalls,
      measuredRtf: this.lastMeasuredRtf,
    };
  }

  public subscribe(listener: (metrics: ModelTelemetryMetrics) => void): () => void {
    this.listeners.add(listener);
    listener(this.getTelemetryMetrics());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifySubscribers(): void {
    if (this.listeners.size === 0) return;
    const metrics = this.getTelemetryMetrics();
    for (const listener of this.listeners) {
      try {
        listener(metrics);
      } catch {
        // Listener failure does not disrupt switcher operation
      }
    }
  }
}
