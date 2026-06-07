import type { ReplyPayload } from "../runtime-api.js";
import type { LineChannelData } from "./types.js";

export function parseLineDirectives(payload: ReplyPayload): ReplyPayload {
  const text = payload.text;
  if (!text) {
    return payload;
  }
  const lineData: LineChannelData = {
    ...(payload.channelData?.line as LineChannelData | undefined),
  };
  const quickRepliesMatch = text.match(/\[\[quick_replies:\s*([^\]]+)\]\]/i);
  if (!quickRepliesMatch) {
    return payload;
  }
  const quickReplies = quickRepliesMatch[1]
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (quickReplies.length === 0) {
    return payload;
  }
  return {
    ...payload,
    text: text.replace(quickRepliesMatch[0], "").trim(),
    channelData: {
      ...payload.channelData,
      line: {
        ...lineData,
        quickReplies: [...(lineData.quickReplies ?? []), ...quickReplies],
      },
    },
  };
}
