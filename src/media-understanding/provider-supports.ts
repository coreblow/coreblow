import type { MediaUnderstandingCapability, MediaUnderstandingProvider } from "./types.js";

export function providerSupportsCapability(
  provider: MediaUnderstandingProvider | undefined,
  capability: MediaUnderstandingCapability,
): boolean {
  if (capability === "audio") return Boolean(provider?.transcribeAudio);
  if (capability === "image") return Boolean(provider?.describeImage || provider?.describeImages);
  return Boolean(provider?.describeVideo);
}
