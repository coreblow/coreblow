import type { CoreBlowConfig } from "coreblow/plugin-sdk/telegram-core";

type ReasoningDefault = "on" | "stream" | "off";

const DEFAULT_AGENT_ID = "main";

function normalizeAgentId(value: string | undefined | null): string {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized || DEFAULT_AGENT_ID;
}

export function resolveTelegramConfigReasoningDefault(
  cfg: CoreBlowConfig,
  agentId: string,
): ReasoningDefault {
  const id = normalizeAgentId(agentId);
  const agentDefault = cfg.agents?.list?.find(
    (entry) => normalizeAgentId(entry?.id) === id,
  )?.reasoningDefault;
  return (
    (agentDefault as ReasoningDefault | undefined) ??
    (cfg.agents?.defaults as { reasoningDefault?: ReasoningDefault } | undefined)
      ?.reasoningDefault ??
    "off"
  );
}
