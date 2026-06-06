import { CHAT_CHANNEL_ORDER, type ChatChannelId } from "./ids.js";
import { listBundledChannelCatalogEntries } from "./bundled-channel-catalog-read.js";
import {
  getChatChannelMeta,
  type ChatChannelMeta,
} from "./chat-meta.js";

const CHAT_CHANNEL_ID_SET = new Set<string>(CHAT_CHANNEL_ORDER);

function toKnownChannelId(raw: string): ChatChannelId | null {
  return CHAT_CHANNEL_ID_SET.has(raw) ? raw as ChatChannelId : null;
}

export function buildChatChannelMetaById(): Record<ChatChannelId, ChatChannelMeta> {
  const entries = new Map<ChatChannelId, ChatChannelMeta>(
    CHAT_CHANNEL_ORDER.map((id) => [id, getChatChannelMeta(id)]),
  );

  for (const entry of listBundledChannelCatalogEntries()) {
    const id = toKnownChannelId(entry.id);
    if (!id) {
      continue;
    }
    const fallback = getChatChannelMeta(id);
    entries.set(id, {
      ...fallback,
      label: entry.channel.label?.trim() || fallback.label,
      selectionLabel: entry.channel.selectionLabel?.trim() || fallback.selectionLabel,
      detailLabel: entry.channel.detailLabel?.trim() || fallback.detailLabel,
      docsPath: entry.channel.docsPath?.trim() || fallback.docsPath,
      docsLabel: entry.channel.docsLabel?.trim() || fallback.docsLabel,
      blurb: entry.channel.blurb?.trim() || fallback.blurb,
      systemImage: entry.channel.systemImage?.trim() || fallback.systemImage,
    });
  }

  return Object.freeze(Object.fromEntries(entries)) as Record<ChatChannelId, ChatChannelMeta>;
}
