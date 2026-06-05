import { chunkTextForOutbound } from "./channel-api.js";

function sanitizeForPlainText(text: string): string {
  return text.replace(/\r\n?/gu, "\n");
}

export const ircOutboundBaseAdapter = {
  deliveryMode: "direct" as const,
  chunker: chunkTextForOutbound,
  chunkerMode: "markdown" as const,
  textChunkLimit: 350,
  sanitizeText: ({ text }: { text: string }) => sanitizeForPlainText(text),
};
