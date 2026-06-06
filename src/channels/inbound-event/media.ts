export type InboundMediaKind = "image" | "audio" | "video" | "file" | string;

export type InboundMediaInput = {
  path?: string;
  url?: string;
  contentType?: string;
  kind?: InboundMediaKind;
  messageId?: string;
  transcribed?: boolean;
};

export type InboundMediaFacts = {
  path?: string;
  url?: string;
  contentType?: string;
  kind?: InboundMediaKind;
  transcribed?: boolean;
  messageId?: string;
};

export type HistoryMediaEntry = Omit<InboundMediaFacts, "transcribed">;

export type InboundMediaDefaults = {
  kind?: InboundMediaKind;
  messageId?: string;
  transcribed?: (media: InboundMediaInput, index: number) => boolean;
};

export type ChannelInboundMediaPayload = {
  MediaPath?: string;
  MediaUrl?: string;
  MediaType?: string;
  MediaPaths?: string[];
  MediaUrls?: string[];
  MediaTypes?: string[];
  MediaTranscribedIndexes?: number[];
};

function cleanString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === "" ? undefined : trimmed;
}

export function toInboundMediaFacts(
  media: readonly InboundMediaInput[],
  defaults: InboundMediaDefaults = {},
): InboundMediaFacts[] {
  return media.map((entry, index) => ({
    path: cleanString(entry.path),
    url: cleanString(entry.url),
    contentType: cleanString(entry.contentType),
    kind: entry.kind ?? defaults.kind,
    transcribed: entry.transcribed ?? defaults.transcribed?.(entry, index) ?? false,
    messageId: cleanString(entry.messageId) ?? defaults.messageId,
  }));
}

export function toHistoryMediaEntries(
  media: readonly InboundMediaInput[],
  defaults: Omit<InboundMediaDefaults, "transcribed"> = {},
): HistoryMediaEntry[] {
  return toInboundMediaFacts(media, defaults).map(({ transcribed: _transcribed, ...entry }) => entry);
}

export function buildChannelInboundMediaPayload(
  media: readonly InboundMediaFacts[],
): ChannelInboundMediaPayload {
  if (media.length === 0) {
    return {};
  }

  const urls = media.map((entry) => entry.path ?? entry.url ?? "");
  const paths = media.map((entry) => entry.path ?? "");
  const types = media.map((entry) => entry.contentType ?? "");
  const transcribed = media.flatMap((entry, index) => entry.transcribed === true ? [index] : []);

  return {
    MediaPath: paths.find((path) => path.length > 0),
    MediaUrl: urls.find((url) => url.length > 0),
    MediaType: types.find((type) => type.length > 0),
    MediaPaths: paths,
    MediaUrls: urls,
    MediaTypes: types,
    MediaTranscribedIndexes: transcribed,
  };
}
