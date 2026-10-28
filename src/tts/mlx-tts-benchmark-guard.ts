import type { GatewayService, ServiceHealth } from "../gateway/service-registry.js";

export type TtsEngineType = "apple-silicon-mlx" | "cloud-fallback" | "system-say";

export interface TtsSynthesisSample {
  sampleId: string;
  timestamp: number;
  textLength: number;
  audioDurationMs: number;
  synthesisTimeMs: number;
  rtf: number; // Real-Time Factor: synthesisTimeMs / audioDurationMs
  engine: TtsEngineType;
  thermalThrottled: boolean;
}

export interface MlxTtsGuardConfig {
  maxTargetRtf?: number; // default 0.40 (PRD requirement: RTF <= 0.4)
  sampleWindowSize?: number; // default 30
  consecutiveSlowThreshold?: number; // default 3
}

export class MlxTtsBenchmarkGuard implements GatewayService {
  public readonly name = "mlx-tts-benchmark-guard";
  private isRunning = false;

  private readonly maxTargetRtf: number;
  private readonly sampleWindowSize: number;
  private readonly consecutiveSlowThreshold: number;

  private readonly samples: TtsSynthesisSample[] = [];
  private consecutiveSlowCount = 0;
  private isDegradedFallbackActive = false;

  constructor(config: MlxTtsGuardConfig = {}) {
    this.maxTargetRtf = config.maxTargetRtf ?? 0.40;
    this.sampleWindowSize = config.sampleWindowSize ?? 30;
    this.consecutiveSlowThreshold = config.consecutiveSlowThreshold ?? 3;
  }

  public async start(): Promise<void> {
    this.isRunning = true;
    this.isDegradedFallbackActive = false;
  }

  public async stop(): Promise<void> {
    this.samples.length = 0;
    this.isRunning = false;
  }

  public health(): ServiceHealth {
    if (!this.isRunning) {
      return { status: "down", detail: "MLX TTS Benchmark Guard is stopped." };
    }
    const avgRtf = this.getAverageRtf();
    if (this.isDegradedFallbackActive) {
      return {
        status: "degraded",
        detail: `MLX engine degraded due to slow RTF (${avgRtf.toFixed(3)} > ${this.maxTargetRtf}) or thermal throttling.`,
      };
    }
    return {
      status: "healthy",
      detail: `MLX TTS operating at RTF ${avgRtf.toFixed(3)} (target <= ${this.maxTargetRtf}). Certified samples: ${this.samples.length}.`,
    };
  }

  public recordSample(params: {
    audioDurationMs: number;
    synthesisTimeMs: number;
    textLength: number;
    thermalThrottled?: boolean;
    engine?: TtsEngineType;
  }): TtsSynthesisSample {
    if (params.audioDurationMs <= 0) {
      throw new Error("audioDurationMs must be greater than 0 to compute Real-Time Factor (RTF).");
    }

    const rtf = Number((params.synthesisTimeMs / params.audioDurationMs).toFixed(4));
    const thermalThrottled = Boolean(params.thermalThrottled);
    const engine = params.engine ?? (this.isDegradedFallbackActive ? "cloud-fallback" : "apple-silicon-mlx");

    const sample: TtsSynthesisSample = {
      sampleId: `sample-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      textLength: params.textLength,
      audioDurationMs: params.audioDurationMs,
      synthesisTimeMs: params.synthesisTimeMs,
      rtf,
      engine,
      thermalThrottled,
    };

    this.samples.push(sample);
    if (this.samples.length > this.sampleWindowSize) {
      this.samples.shift();
    }

    if (thermalThrottled || rtf > this.maxTargetRtf) {
      this.consecutiveSlowCount += 1;
      if (this.consecutiveSlowCount >= this.consecutiveSlowThreshold) {
        this.isDegradedFallbackActive = true;
      }
    } else {
      this.consecutiveSlowCount = 0;
      this.isDegradedFallbackActive = false;
    }

    return sample;
  }

  public getAverageRtf(): number {
    if (this.samples.length === 0) return 0;
    const sum = this.samples.reduce((acc, s) => acc + s.rtf, 0);
    return Number((sum / this.samples.length).toFixed(4));
  }

  public isCertifiedRtfTargetMet(): boolean {
    if (this.samples.length === 0) return true; // optimistic before initial run
    return this.getAverageRtf() <= this.maxTargetRtf && !this.isDegradedFallbackActive;
  }

  public resolveRecommendedEngine(): TtsEngineType {
    if (this.isDegradedFallbackActive) {
      return "cloud-fallback";
    }
    return "apple-silicon-mlx";
  }

  public resetFallback(): void {
    this.consecutiveSlowCount = 0;
    this.isDegradedFallbackActive = false;
  }

  public getSamples(): TtsSynthesisSample[] {
    return [...this.samples];
  }
}
