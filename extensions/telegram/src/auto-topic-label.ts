import type { CoreBlowConfig } from "coreblow/plugin-sdk/config-runtime";
import { generateConversationLabel } from "coreblow/plugin-sdk/reply-dispatch-runtime";
export { resolveAutoTopicLabelConfig } from "./auto-topic-label-config.js";

export async function generateTelegramTopicLabel(params: {
  userMessage: string;
  prompt: string;
  cfg: CoreBlowConfig;
  agentId?: string;
  agentDir?: string;
}): Promise<string | null> {
  return await (generateConversationLabel as (p: unknown) => Promise<string | null>)({
    ...params,
    maxLength: 128,
  });
}
