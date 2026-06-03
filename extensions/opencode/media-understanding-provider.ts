import {
  describeImageWithModel,
  describeImagesWithModel,
  type MediaUnderstandingProvider,
} from "coreblow/plugin-sdk/media-understanding";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function stripOpencodeDisabledResponsesReasoningPayload(payload: unknown): void {
  if (!isRecord(payload)) {
    return;
  }
  const reasoning = payload.reasoning;
  if (reasoning === "none") {
    delete payload.reasoning;
    return;
  }
  if (!isRecord(reasoning) || reasoning.effort !== "none") {
    return;
  }
  delete payload.reasoning;
}

export const opencodeMediaUnderstandingProvider: MediaUnderstandingProvider = {
  id: "opencode",
  capabilities: ["image"],
  defaultModels: {
    image: "gpt-5-nano",
  },
  describeImage: describeImageWithModel,
  describeImages: describeImagesWithModel,
};
