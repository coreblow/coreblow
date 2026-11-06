/**
 * CoreBlow — Sovereign Local Voice Companion Telemetry & RTF Guard
 *
 * Implements pure Data-Oriented Programming (DOP) contracts for
 * Real-Time Factor (RTF) calculations, sovereign latency certifications (RTF <= 0.4),
 * and voice companion wake-shortcut state transitions.
 */

export const SOVEREIGN_RTF_TARGET = 0.4;

export type VoiceCompanionBackend = "apple-mlx-neural" | "local-onnx" | "cloud-fallback";

export interface VoiceSynthesisTelemetry {
  readonly utteranceLengthChars: number;
  readonly audioDurationMs: number;
  readonly synthesisLatencyMs: number;
  readonly rtf: number;
  readonly meetsSovereignTarget: boolean;
  readonly backend: VoiceCompanionBackend;
}

export interface ComputeVoiceRtfParams {
  readonly audioDurationMs: number;
  readonly synthesisLatencyMs: number;
  readonly utteranceLengthChars?: number;
  readonly backend?: VoiceCompanionBackend;
}

/**
 * Computes RTF = synthesisLatencyMs / Math.max(1, audioDurationMs)
 * and certifies meetsSovereignTarget: rtf <= 0.4
 */
export function computeVoiceRealTimeFactor(params: ComputeVoiceRtfParams): VoiceSynthesisTelemetry {
  const audioDurationMs = Math.max(1, params.audioDurationMs);
  const synthesisLatencyMs = Math.max(0, params.synthesisLatencyMs);
  const rtf = Number((synthesisLatencyMs / audioDurationMs).toFixed(4));
  const meetsSovereignTarget = rtf <= SOVEREIGN_RTF_TARGET;

  return Object.freeze({
    utteranceLengthChars: params.utteranceLengthChars ?? 0,
    audioDurationMs: params.audioDurationMs,
    synthesisLatencyMs: params.synthesisLatencyMs,
    rtf,
    meetsSovereignTarget,
    backend: params.backend ?? "apple-mlx-neural",
  });
}

// ── Wake-Shortcut Companion State Machine ──────────────────────────────────

export type VoiceCompanionWakeShortcut =
  | "double_tap_option"
  | "push_to_talk"
  | "wake_phrase"
  | "hotkey";

export type VoiceCompanionState = "idle" | "listening" | "synthesizing" | "speaking" | "degraded";

export interface VoiceCompanionSession {
  readonly sessionId: string;
  readonly state: VoiceCompanionState;
  readonly wakeShortcut: VoiceCompanionWakeShortcut;
  readonly activeBackend: VoiceCompanionBackend;
  readonly consecutiveDegradedCount: number;
  readonly lastTelemetry?: VoiceSynthesisTelemetry;
  readonly updatedAtMs: number;
}

export type VoiceCompanionEvent =
  | { readonly type: "WAKE_TRIGGERED"; readonly shortcut?: VoiceCompanionWakeShortcut }
  | { readonly type: "SPEECH_RECOGNIZED"; readonly text: string }
  | { readonly type: "SYNTHESIS_STARTED" }
  | { readonly type: "SYNTHESIS_FINISHED"; readonly telemetry: VoiceSynthesisTelemetry }
  | { readonly type: "PLAYBACK_FINISHED" }
  | { readonly type: "RESET" };

export function createVoiceCompanionSession(
  params: {
    readonly sessionId?: string;
    readonly wakeShortcut?: VoiceCompanionWakeShortcut;
    readonly backend?: VoiceCompanionBackend;
  } = {},
): VoiceCompanionSession {
  return Object.freeze({
    sessionId: params.sessionId ?? `companion-${Date.now()}`,
    state: "idle",
    wakeShortcut: params.wakeShortcut ?? "double_tap_option",
    activeBackend: params.backend ?? "apple-mlx-neural",
    consecutiveDegradedCount: 0,
    updatedAtMs: Date.now(),
  });
}

export function transitionVoiceCompanionState(
  session: VoiceCompanionSession,
  event: VoiceCompanionEvent,
): VoiceCompanionSession {
  const now = Date.now();
  switch (event.type) {
    case "WAKE_TRIGGERED":
      return Object.freeze({
        ...session,
        state: "listening",
        wakeShortcut: event.shortcut ?? session.wakeShortcut,
        updatedAtMs: now,
      });

    case "SPEECH_RECOGNIZED":
      return Object.freeze({
        ...session,
        state: "synthesizing",
        updatedAtMs: now,
      });

    case "SYNTHESIS_STARTED":
      return Object.freeze({
        ...session,
        state: "synthesizing",
        updatedAtMs: now,
      });

    case "SYNTHESIS_FINISHED": {
      const isDegraded = !event.telemetry.meetsSovereignTarget;
      const consecutiveDegradedCount = isDegraded ? session.consecutiveDegradedCount + 1 : 0;
      const nextState: VoiceCompanionState =
        consecutiveDegradedCount >= 3 ? "degraded" : "speaking";
      const nextBackend: VoiceCompanionBackend =
        nextState === "degraded" ? "cloud-fallback" : session.activeBackend;

      return Object.freeze({
        ...session,
        state: nextState,
        activeBackend: nextBackend,
        consecutiveDegradedCount,
        lastTelemetry: event.telemetry,
        updatedAtMs: now,
      });
    }

    case "PLAYBACK_FINISHED":
    case "RESET":
      return Object.freeze({
        ...session,
        state: "idle",
        updatedAtMs: now,
      });

    default:
      return session;
  }
}
