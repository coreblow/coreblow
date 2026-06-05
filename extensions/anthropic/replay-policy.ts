export type AnthropicReplayPolicy = {
  sanitizeMode: "full";
  sanitizeToolCallIds: boolean;
  toolCallIdMode: "strict";
  preserveNativeAnthropicToolUseIds: boolean;
  preserveSignatures: boolean;
  repairToolUseResultPairing: boolean;
  validateAnthropicTurns: boolean;
  allowSyntheticToolResults: boolean;
};

export function buildAnthropicReplayPolicy(): AnthropicReplayPolicy {
  return {
    sanitizeMode: "full",
    sanitizeToolCallIds: true,
    toolCallIdMode: "strict",
    preserveNativeAnthropicToolUseIds: true,
    preserveSignatures: true,
    repairToolUseResultPairing: true,
    validateAnthropicTurns: true,
    allowSyntheticToolResults: true,
  };
}
