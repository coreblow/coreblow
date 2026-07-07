import { ComponentType } from "discord-api-types/v10";
import { normalizeOptionalString } from "coreblow/plugin-sdk/string-coerce-runtime";
import type { Message } from "../internal/discord.js";
import {
  formatDiscordSnapshotAuthor,
  normalizeDiscordMessageSnapshots,
  resolveDiscordMessageSnapshots,
  resolveDiscordMessageStickers,
  resolveDiscordReferencedForwardMessage,
  resolveDiscordSnapshotStickers,
  type DiscordSnapshotMessage,
} from "./message-forwarded.js";

function buildDiscordAttachmentPlaceholder(attachments?: Array<{ filename?: string }>): string {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return "";
  }
  const names = attachments.map((a) => a.filename).filter(Boolean);
  if (names.length === 0) {
    return "[attachment]";
  }
  return names.map((name) => `[${name}]`).join(" ");
}

function buildDiscordStickerPlaceholder(stickers?: Array<{ name?: string }>): string {
  if (!Array.isArray(stickers) || stickers.length === 0) {
    return "";
  }
  return stickers
    .map((s) => s.name)
    .filter(Boolean)
    .map((name) => `[Sticker: ${name}]`)
    .join(" ");
}

function buildDiscordMediaPlaceholder(params: {
  attachments?: Array<{ filename?: string }>;
  stickers?: Array<{ name?: string }>;
}): string {
  const attachmentText = buildDiscordAttachmentPlaceholder(params.attachments);
  const stickerText = buildDiscordStickerPlaceholder(params.stickers);
  if (attachmentText && stickerText) {
    return `${attachmentText}\n${stickerText}`;
  }
  return attachmentText || stickerText || "";
}

export function resolveDiscordEmbedText(
  embed?: { title?: string | null; description?: string | null } | null,
): string {
  const title = normalizeOptionalString(embed?.title) ?? "";
  const description = normalizeOptionalString(embed?.description) ?? "";
  if (title && description) {
    return `${title}\n${description}`;
  }
  return title || description || "";
}

export function resolveDiscordMessageText(
  message: Message,
  options?: { fallbackText?: string; includeForwarded?: boolean },
): string {
  const embedText = resolveDiscordEmbedText(
    (message.embeds?.[0] as { title?: string | null; description?: string | null } | undefined) ??
      null,
  );
  const componentText = extractDiscordComponentsV2Text(resolveDiscordMessageComponents(message));
  const rawText =
    normalizeOptionalString(message.content) ||
    buildDiscordMediaPlaceholder({
      attachments: message.attachments ?? undefined,
      stickers: resolveDiscordMessageStickers(message),
    }) ||
    embedText ||
    componentText ||
    normalizeOptionalString(options?.fallbackText) ||
    "";
  const baseText = resolveDiscordMentions(rawText, message);
  if (!options?.includeForwarded) {
    return baseText;
  }
  const forwardedText = resolveDiscordForwardedMessagesText(message);
  if (!forwardedText) {
    return baseText;
  }
  if (!baseText) {
    return forwardedText;
  }
  return `${baseText}\n${forwardedText}`;
}

function resolveDiscordMentions(text: string, message: Message): string {
  if (!text.includes("<")) {
    return text;
  }
  const mentions = (message as { mentionedUsers?: Array<{ id: string; globalName?: string; username?: string }> }).mentionedUsers ?? [];
  if (!Array.isArray(mentions) || mentions.length === 0) {
    return text;
  }
  let out = text;
  for (const user of mentions) {
    const label = user.globalName || user.username;
    out = out.replace(new RegExp(`<@!?${user.id}>`, "g"), `@${label}`);
  }
  return out;
}

function resolveDiscordForwardedMessagesText(message: Message): string {
  const snapshots = resolveDiscordMessageSnapshots(message);
  if (snapshots.length > 0) {
    return resolveDiscordForwardedMessagesTextFromSnapshots(snapshots);
  }
  const referencedForward = resolveDiscordReferencedForwardMessage(message);
  if (!referencedForward) {
    return "";
  }
  const referencedText = resolveDiscordMessageText(referencedForward);
  if (!referencedText) {
    return "";
  }
  const authorLabel = formatDiscordSnapshotAuthor(referencedForward.author);
  const heading = authorLabel ? `[Forwarded message from ${authorLabel}]` : "[Forwarded message]";
  return `${heading}\n${referencedText}`;
}

function resolveDiscordMessageComponents(message: Message): unknown {
  const components = (message as { components?: unknown }).components;
  if (components !== undefined) {
    return components;
  }
  try {
    return (message as { rawData?: { components?: unknown } }).rawData?.components;
  } catch {
    return undefined;
  }
}

function extractDiscordComponentsV2Text(components: unknown): string {
  const parts: string[] = [];
  collectDiscordTextDisplayContent(components, parts);
  return parts.join("\n");
}

function collectDiscordTextDisplayContent(value: unknown, parts: string[]): void {
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectDiscordTextDisplayContent(entry, parts);
    }
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  const component = value as {
    type?: unknown;
    content?: unknown;
    components?: unknown;
    component?: unknown;
  };
  if (component.type === ComponentType.TextDisplay) {
    const content = normalizeOptionalString(component.content);
    if (content) {
      parts.push(content);
    }
  }
  collectDiscordTextDisplayContent(component.components, parts);
  collectDiscordTextDisplayContent(component.component, parts);
}

export function resolveDiscordForwardedMessagesTextFromSnapshots(snapshots: unknown): string {
  const forwardedBlocks = normalizeDiscordMessageSnapshots(snapshots)
    .map((snapshot) => buildDiscordForwardedMessageBlock(snapshot.message))
    .filter((entry): entry is string => Boolean(entry));
  if (forwardedBlocks.length === 0) {
    return "";
  }
  return forwardedBlocks.join("\n\n");
}

function buildDiscordForwardedMessageBlock(
  snapshotMessage: DiscordSnapshotMessage | null | undefined,
): string | null {
  if (!snapshotMessage) {
    return null;
  }
  const text = resolveDiscordSnapshotMessageText(snapshotMessage);
  if (!text) {
    return null;
  }
  const authorLabel = formatDiscordSnapshotAuthor(snapshotMessage.author);
  const heading = authorLabel ? `[Forwarded message from ${authorLabel}]` : "[Forwarded message]";
  return `${heading}\n${text}`;
}

function resolveDiscordSnapshotMessageText(snapshot: DiscordSnapshotMessage): string {
  const content = normalizeOptionalString(snapshot.content) ?? "";
  const attachmentText = buildDiscordMediaPlaceholder({
    attachments: snapshot.attachments ?? undefined,
    stickers: resolveDiscordSnapshotStickers(snapshot),
  });
  const embedText = resolveDiscordEmbedText(snapshot.embeds?.[0]);
  const componentText = extractDiscordComponentsV2Text(snapshot.components);
  return content || attachmentText || embedText || componentText || "";
}
