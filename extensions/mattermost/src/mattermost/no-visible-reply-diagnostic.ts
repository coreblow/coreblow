import { countOutboundMedia } from "coreblow/plugin-sdk/reply-payload";
import type { ReplyPayload } from "../../runtime-api.js";
import type { MattermostReplyDeliveryOutcome } from "./reply-delivery.js";

export type MattermostNoVisibleReplyViolation = {
  reason: "no-visible-reply-after-final-delivery";
  outcome: MattermostReplyDeliveryOutcome;
  finalTextLength: number;
  mediaUrlCount: number;
};

export function evaluateMattermostNoVisibleReply(params: {
  outcome: MattermostReplyDeliveryOutcome;
  payload: ReplyPayload;
}): MattermostNoVisibleReplyViolation | null {
  if (params.outcome !== "empty") {
    return null;
  }
  const finalText = typeof params.payload.text === "string" ? params.payload.text.trim() : "";
  const mediaUrlCount = countOutboundMedia(params.payload);
  if (finalText.length === 0 && mediaUrlCount === 0) {
    return null;
  }
  return {
    reason: "no-visible-reply-after-final-delivery",
    outcome: params.outcome,
    finalTextLength: finalText.length,
    mediaUrlCount,
  };
}

export function formatMattermostNoVisibleReplyLog(params: {
  violation: MattermostNoVisibleReplyViolation;
  to: string;
  accountId: string;
  agentId: string | undefined;
}): string {
  return (
    `mattermost no-visible-reply: ${params.violation.reason}` +
    ` to=${params.to}` +
    ` accountId=${params.accountId}` +
    ` agentId=${params.agentId ?? "unknown"}` +
    ` outcome=${params.violation.outcome}` +
    ` finalTextLength=${params.violation.finalTextLength}` +
    ` mediaUrlCount=${params.violation.mediaUrlCount}`
  );
}
