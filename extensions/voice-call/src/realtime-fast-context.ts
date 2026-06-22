import type { CoreConfig } from "./core-bridge.js";
import type { VoiceCallRealtimeFastContextConfig } from "./config.js";

type Logger = {
  debug?: (message: string) => void;
};

export type RealtimeVoiceFastContextConsultResult =
  | { handled: false }
  | {
      handled: true;
      answer: string;
      sources?: Array<{ source: "memory" | "sessions"; summary: string }>;
    };

export async function resolveRealtimeFastContextConsult(params: {
  cfg: CoreConfig;
  agentId: string;
  sessionKey: string;
  config: VoiceCallRealtimeFastContextConfig;
  args: unknown;
  logger: Logger;
}): Promise<RealtimeVoiceFastContextConsultResult> {
  params.logger.debug?.(
    `[voice-call] fast context unavailable in this CoreBlow build for agent=${params.agentId} session=${params.sessionKey}`,
  );
  return { handled: false };
}
