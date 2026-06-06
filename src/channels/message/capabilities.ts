import type {
  DurableFinalDeliveryRequirementInput,
  DurableFinalDeliveryRequirementMap,
} from "./types.js";

function setCapability(
  requirements: DurableFinalDeliveryRequirementMap,
  capability: keyof DurableFinalDeliveryRequirementMap,
  enabled: unknown,
): void {
  if (enabled === true) {
    requirements[capability] = true;
  }
}

export function deriveDurableFinalDeliveryRequirements(
  input: DurableFinalDeliveryRequirementInput,
): DurableFinalDeliveryRequirementMap {
  const requirements: DurableFinalDeliveryRequirementMap = {};
  const payload = input.payload ?? {};

  if (typeof payload.text === "string" && payload.text.length > 0) {
    requirements.text = true;
  }
  if (
    typeof payload.mediaUrl === "string" && payload.mediaUrl.length > 0 ||
    Array.isArray(payload.mediaUrls) && payload.mediaUrls.length > 0
  ) {
    requirements.media = true;
  }
  if (typeof payload.replyToId === "string" && payload.replyToId.length > 0) {
    requirements.replyTo = true;
  }
  if (input.threadId !== undefined && input.threadId !== null) {
    requirements.thread = true;
  }
  setCapability(requirements, "silent", input.silent);
  setCapability(requirements, "payload", input.payloadTransport);
  setCapability(requirements, "batch", input.batch);
  setCapability(requirements, "reconcileUnknownSend", input.reconcileUnknownSend);
  setCapability(requirements, "afterSendSuccess", input.afterSendSuccess);
  setCapability(requirements, "afterCommit", input.afterCommit);

  requirements.messageSendingHooks = true;

  for (const [capability, enabled] of Object.entries(input.extraCapabilities ?? {})) {
    setCapability(
      requirements,
      capability as keyof DurableFinalDeliveryRequirementMap,
      enabled,
    );
  }

  return requirements;
}
