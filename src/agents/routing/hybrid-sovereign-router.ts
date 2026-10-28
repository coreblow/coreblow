import type { GatewayService, ServiceHealth } from "../../gateway/service-registry.js";

export type DataPrivacyClassification = "PUBLIC" | "INTERNAL" | "SOVEREIGN_LOCAL_ONLY";
export type TaskComplexity = "simple" | "standard" | "complex" | "reasoning_heavy";

export interface RoutingQuery {
  prompt: string;
  classification: DataPrivacyClassification;
  complexity?: TaskComplexity;
  estimatedTokens?: number;
  confidenceScore?: number; // 0.0 to 1.0 (tau)
}

export interface RoutingDecision {
  targetTier: "local_edge" | "cloud_frontier";
  selectedProvider: string;
  model: string;
  reason: string;
  privacyEnforced: boolean;
  circuitBreakerActive: boolean;
}

export interface HybridRouterOptions {
  confidenceThreshold?: number; // tau, default 0.75
  failureThresholdForFallback?: number; // default 3
  localDefaultModel?: string;
  cloudDefaultModel?: string;
}

export class SovereigntyViolationError extends Error {
  constructor(message: string) {
    super(`[SOVEREIGN_AI_VIOLATION] Data Sovereignty Policy: ${message}`);
    this.name = "SovereigntyViolationError";
  }
}

export class HybridSovereignRouter implements GatewayService {
  public readonly name = "hybrid-sovereign-router";
  private isRunning = false;

  private readonly confidenceThreshold: number;
  private readonly failureThreshold: number;
  private readonly localDefaultModel: string;
  private readonly cloudDefaultModel: string;

  private readonly consecutiveFailures = new Map<string, number>();
  private totalRoutedLocal = 0;
  private totalRoutedCloud = 0;
  private totalCircuitBreakerFallbacks = 0;

  constructor(options: HybridRouterOptions = {}) {
    this.confidenceThreshold = options.confidenceThreshold ?? 0.75;
    this.failureThreshold = options.failureThresholdForFallback ?? 3;
    this.localDefaultModel = options.localDefaultModel ?? "vllm/qwen2.5-7b";
    this.cloudDefaultModel = options.cloudDefaultModel ?? "anthropic/claude-3-7-sonnet";
  }

  public async start(): Promise<void> {
    this.isRunning = true;
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
  }

  public health(): ServiceHealth {
    if (!this.isRunning) {
      return { status: "down", detail: "Hybrid Sovereign Router is stopped." };
    }
    const anyTripped = Array.from(this.consecutiveFailures.values()).some(
      (count) => count >= this.failureThreshold,
    );
    return {
      status: anyTripped ? "degraded" : "healthy",
      detail: `Local routes: ${this.totalRoutedLocal}, Cloud routes: ${this.totalRoutedCloud}, Fallbacks: ${this.totalCircuitBreakerFallbacks}.`,
    };
  }

  public route(query: RoutingQuery): RoutingDecision {
    if (!this.isRunning) {
      throw new Error("Cannot route: HybridSovereignRouter is not running.");
    }

    const { classification, complexity = "standard", confidenceScore = 0.5 } = query;

    // Invariant 1: SOVEREIGN_LOCAL_ONLY never leaves local edge
    if (classification === "SOVEREIGN_LOCAL_ONLY") {
      this.totalRoutedLocal += 1;
      return {
        targetTier: "local_edge",
        selectedProvider: "vllm",
        model: this.localDefaultModel,
        reason: "Strict SOVEREIGN_LOCAL_ONLY data classification enforced.",
        privacyEnforced: true,
        circuitBreakerActive: false,
      };
    }

    // Invariant 2: Circuit Breaker fallback for Cloud Frontier
    const cloudProvider = this.cloudDefaultModel.split("/")[0] ?? "anthropic";
    const cloudFailures = this.consecutiveFailures.get(cloudProvider) ?? 0;
    const isCloudTripped = cloudFailures >= this.failureThreshold;

    if (isCloudTripped) {
      this.totalRoutedLocal += 1;
      this.totalCircuitBreakerFallbacks += 1;
      return {
        targetTier: "local_edge",
        selectedProvider: "vllm",
        model: this.localDefaultModel,
        reason: `Cloud provider '${cloudProvider}' circuit breaker tripped (${cloudFailures} failures). Degraded local fallback engaged.`,
        privacyEnforced: true,
        circuitBreakerActive: true,
      };
    }

    // Invariant 3: Zero-Cost Edge optimization
    if (complexity === "simple" || confidenceScore >= this.confidenceThreshold) {
      this.totalRoutedLocal += 1;
      return {
        targetTier: "local_edge",
        selectedProvider: "vllm",
        model: this.localDefaultModel,
        reason: `Zero-Cost Edge optimization (confidence=${confidenceScore.toFixed(2)} >= tau=${this.confidenceThreshold}).`,
        privacyEnforced: true,
        circuitBreakerActive: false,
      };
    }

    // Invariant 4: Cloud Frontier for high reasoning complexity
    this.totalRoutedCloud += 1;
    return {
      targetTier: "cloud_frontier",
      selectedProvider: cloudProvider,
      model: this.cloudDefaultModel,
      reason: `High reasoning complexity '${complexity}' routed to cloud frontier.`,
      privacyEnforced: false,
      circuitBreakerActive: false,
    };
  }

  public recordProviderFailure(provider: string): void {
    const current = this.consecutiveFailures.get(provider) ?? 0;
    this.consecutiveFailures.set(provider, current + 1);
  }

  public recordProviderSuccess(provider: string): void {
    this.consecutiveFailures.set(provider, 0);
  }

  public isCircuitBreakerTripped(provider: string): boolean {
    return (this.consecutiveFailures.get(provider) ?? 0) >= this.failureThreshold;
  }

  public resetCircuitBreaker(provider: string): void {
    this.consecutiveFailures.delete(provider);
  }

  public getRouterStats(): {
    totalRoutedLocal: number;
    totalRoutedCloud: number;
    totalCircuitBreakerFallbacks: number;
  } {
    return {
      totalRoutedLocal: this.totalRoutedLocal,
      totalRoutedCloud: this.totalRoutedCloud,
      totalCircuitBreakerFallbacks: this.totalCircuitBreakerFallbacks,
    };
  }
}
