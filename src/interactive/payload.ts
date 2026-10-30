export type InteractiveButtonStyle = "primary" | "secondary" | "success" | "danger";

export type InteractiveReplyButton = {
  label: string;
  value: string;
  style?: InteractiveButtonStyle;
  url?: string;
};

export type InteractiveReplyOption = {
  label: string;
  value: string;
};

export type InteractiveReplyTextBlock = {
  type: "text";
  text: string;
};

export type InteractiveReplyButtonsBlock = {
  type: "buttons";
  buttons: InteractiveReplyButton[];
};

export type InteractiveReplySelectBlock = {
  type: "select";
  placeholder?: string;
  options: InteractiveReplyOption[];
};

export type InteractiveReplyBlock =
  | InteractiveReplyTextBlock
  | InteractiveReplyButtonsBlock
  | InteractiveReplySelectBlock;

export type InteractiveReply = {
  blocks: InteractiveReplyBlock[];
};

export type MessagePresentationButton = InteractiveReplyButton;

export type MessagePresentationOption = InteractiveReplyOption;

export type MessagePresentationTextBlock = {
  type: "text";
  text: string;
};

export type MessagePresentationContextBlock = {
  type: "context";
  text: string;
};

export type MessagePresentationDividerBlock = {
  type: "divider";
};

export type MessagePresentationButtonsBlock = {
  type: "buttons";
  buttons: MessagePresentationButton[];
};

export type MessagePresentationSelectBlock = {
  type: "select";
  placeholder?: string;
  options: MessagePresentationOption[];
};

export type MessagePresentationBlock =
  | MessagePresentationTextBlock
  | MessagePresentationContextBlock
  | MessagePresentationDividerBlock
  | MessagePresentationButtonsBlock
  | MessagePresentationSelectBlock;

export type MessagePresentationTone = "info" | "success" | "warn" | "error";

export type MessagePresentation = {
  title?: string;
  tone?: MessagePresentationTone;
  blocks: MessagePresentationBlock[];
};

function readTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeButtonStyle(value: unknown): InteractiveButtonStyle | undefined {
  const style = readTrimmedString(value)?.toLowerCase();
  return style === "primary" || style === "secondary" || style === "success" || style === "danger"
    ? style
    : undefined;
}

function normalizeInteractiveButton(raw: unknown): InteractiveReplyButton | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return undefined;
  }
  const record = raw as Record<string, unknown>;
  const label = readTrimmedString(record.label) ?? readTrimmedString(record.text);
  const value =
    readTrimmedString(record.value) ??
    readTrimmedString(record.callbackData) ??
    readTrimmedString(record.callback_data);
  if (!label || !value) {
    return undefined;
  }
  return {
    label,
    value,
    style: normalizeButtonStyle(record.style),
  };
}

function normalizeInteractiveOption(raw: unknown): InteractiveReplyOption | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return undefined;
  }
  const record = raw as Record<string, unknown>;
  const label = readTrimmedString(record.label) ?? readTrimmedString(record.text);
  const value = readTrimmedString(record.value);
  if (!label || !value) {
    return undefined;
  }
  return { label, value };
}

function normalizeInteractiveBlock(raw: unknown): InteractiveReplyBlock | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return undefined;
  }
  const record = raw as Record<string, unknown>;
  const type = readTrimmedString(record.type)?.toLowerCase();
  if (type === "text") {
    const text = readTrimmedString(record.text);
    return text ? { type: "text", text } : undefined;
  }
  if (type === "buttons") {
    const buttons = Array.isArray(record.buttons)
      ? record.buttons
          .map((entry) => normalizeInteractiveButton(entry))
          .filter((entry): entry is InteractiveReplyButton => Boolean(entry))
      : [];
    return buttons.length > 0 ? { type: "buttons", buttons } : undefined;
  }
  if (type === "select") {
    const options = Array.isArray(record.options)
      ? record.options
          .map((entry) => normalizeInteractiveOption(entry))
          .filter((entry): entry is InteractiveReplyOption => Boolean(entry))
      : [];
    return options.length > 0
      ? {
          type: "select",
          placeholder: readTrimmedString(record.placeholder),
          options,
        }
      : undefined;
  }
  return undefined;
}

function normalizePresentationTone(value: unknown): MessagePresentationTone | undefined {
  const tone = readTrimmedString(value)?.toLowerCase();
  return tone === "info" || tone === "success" || tone === "warn" || tone === "error"
    ? tone
    : undefined;
}

function normalizePresentationBlock(raw: unknown): MessagePresentationBlock | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return undefined;
  }
  const record = raw as Record<string, unknown>;
  const type = readTrimmedString(record.type)?.toLowerCase();
  if (type === "text" || type === "context") {
    const text = readTrimmedString(record.text);
    return text ? { type, text } : undefined;
  }
  if (type === "divider") {
    return { type: "divider" };
  }
  if (type === "buttons") {
    const buttons = Array.isArray(record.buttons)
      ? record.buttons
          .map((entry) => normalizeInteractiveButton(entry))
          .filter((entry): entry is MessagePresentationButton => Boolean(entry))
      : [];
    return buttons.length > 0 ? { type: "buttons", buttons } : undefined;
  }
  if (type === "select") {
    const options = Array.isArray(record.options)
      ? record.options
          .map((entry) => normalizeInteractiveOption(entry))
          .filter((entry): entry is MessagePresentationOption => Boolean(entry))
      : [];
    return options.length > 0
      ? {
          type: "select",
          placeholder: readTrimmedString(record.placeholder),
          options,
        }
      : undefined;
  }
  return undefined;
}

export function normalizeMessagePresentation(raw: unknown): MessagePresentation | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return undefined;
  }
  const record = raw as Record<string, unknown>;
  const blocks = Array.isArray(record.blocks)
    ? record.blocks
        .map((entry) => normalizePresentationBlock(entry))
        .filter((entry): entry is MessagePresentationBlock => Boolean(entry))
    : [];
  const title = readTrimmedString(record.title);
  if (!title && blocks.length === 0) {
    return undefined;
  }
  return {
    ...(title ? { title } : {}),
    ...(normalizePresentationTone(record.tone) ? { tone: normalizePresentationTone(record.tone) } : {}),
    blocks,
  };
}

export function hasMessagePresentationBlocks(value: unknown): value is MessagePresentation {
  return Boolean(normalizeMessagePresentation(value));
}

export function normalizeInteractiveReply(raw: unknown): InteractiveReply | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return undefined;
  }
  const record = raw as Record<string, unknown>;
  const blocks = Array.isArray(record.blocks)
    ? record.blocks
        .map((entry) => normalizeInteractiveBlock(entry))
        .filter((entry): entry is InteractiveReplyBlock => Boolean(entry))
    : [];
  return blocks.length > 0 ? { blocks } : undefined;
}

export function hasInteractiveReplyBlocks(value: unknown): value is InteractiveReply {
  return Boolean(normalizeInteractiveReply(value));
}

export function renderMessagePresentationFallbackText(params: {
  presentation?: MessagePresentation;
  emptyFallback?: string | null;
  text?: string | null;
}): string {
  const lines: string[] = [];
  const text = typeof params.text === "string" && params.text.trim() ? params.text.trim() : "";
  if (text) {
    lines.push(text);
  }
  const presentation = params.presentation;
  if (!presentation) {
    return lines.join("\n\n");
  }
  if (presentation.title) {
    lines.push(presentation.title);
  }
  for (const block of presentation.blocks) {
    if (block.type === "text" || block.type === "context") {
      lines.push(block.text);
      continue;
    }
    if (block.type === "buttons") {
      const labels = block.buttons
        .map((button) => {
          const btn = button as { url?: string; webApp?: { url?: string }; web_app?: { url?: string } };
          const targetUrl = btn.url ?? btn.webApp?.url ?? btn.web_app?.url;
          return targetUrl ? `${button.label}: ${targetUrl}` : button.label;
        })
        .filter(Boolean);
      if (labels.length > 0) {
        lines.push(labels.map((label) => `- ${label}`).join("\n"));
      }
      continue;
    }
    if (block.type === "select") {
      const labels = block.options.map((option) => option.label).filter(Boolean);
      if (labels.length > 0) {
        const heading = block.placeholder ? `${block.placeholder}:` : "Options:";
        lines.push(`${heading}\n${labels.map((label) => `- ${label}`).join("\n")}`);
      }
    }
  }
  const rendered = lines.join("\n\n");
  const fallback = typeof params.emptyFallback === "string" && params.emptyFallback.trim() ? params.emptyFallback.trim() : "";
  return rendered || fallback || "";
}

export function hasReplyChannelData(value: unknown): value is Record<string, unknown> {
  return Boolean(
    value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0,
  );
}

export function hasReplyContent(params: {
  text?: string | null;
  mediaUrl?: string | null;
  mediaUrls?: ReadonlyArray<string | null | undefined>;
  interactive?: unknown;
  presentation?: unknown;
  hasChannelData?: boolean;
  extraContent?: boolean;
}): boolean {
  return Boolean(
    params.text?.trim() ||
    params.mediaUrl?.trim() ||
    params.mediaUrls?.some((entry) => Boolean(entry?.trim())) ||
    hasInteractiveReplyBlocks(params.interactive) ||
    hasMessagePresentationBlocks(params.presentation) ||
    params.hasChannelData ||
    params.extraContent,
  );
}

export function hasReplyPayloadContent(
  payload: {
    text?: string | null;
    mediaUrl?: string | null;
    mediaUrls?: ReadonlyArray<string | null | undefined>;
    interactive?: unknown;
    presentation?: unknown;
    channelData?: unknown;
  },
  options?: {
    trimText?: boolean;
    hasChannelData?: boolean;
    extraContent?: boolean;
  },
): boolean {
  return hasReplyContent({
    text: options?.trimText ? payload.text?.trim() : payload.text,
    mediaUrl: payload.mediaUrl,
    mediaUrls: payload.mediaUrls,
    interactive: payload.interactive,
    presentation: payload.presentation,
    hasChannelData: options?.hasChannelData ?? hasReplyChannelData(payload.channelData),
    extraContent: options?.extraContent,
  });
}

export function resolveInteractiveTextFallback(params: {
  text?: string;
  interactive?: InteractiveReply;
}): string | undefined {
  const text = readTrimmedString(params.text);
  if (text) {
    return params.text;
  }
  const interactiveText = (params.interactive?.blocks ?? [])
    .filter((block): block is InteractiveReplyTextBlock => block.type === "text")
    .map((block) => block.text.trim())
    .filter(Boolean)
    .join("\n\n");
  return interactiveText || params.text;
}
