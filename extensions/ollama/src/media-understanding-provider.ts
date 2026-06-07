import {
  describeImageWithModel,
  describeImagesWithModel,
  type MediaUnderstandingProvider,
} from "coreblow/plugin-sdk/media-understanding";
import { OLLAMA_PROVIDER_ID } from "./discovery-shared.js";

export const ollamaMediaUnderstandingProvider: MediaUnderstandingProvider = {
  id: OLLAMA_PROVIDER_ID,
  capabilities: ["image"],
  describeImage: describeImageWithModel,
  describeImages: describeImagesWithModel,
};
