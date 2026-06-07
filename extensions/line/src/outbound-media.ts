export type LineOutboundMediaKind = "image" | "video" | "audio";

export type LineOutboundMediaResolved = {
  mediaKind: LineOutboundMediaKind;
  mediaUrl: string;
  previewImageUrl?: string;
  durationMs?: number;
  trackingId?: string;
};

export async function resolveLineOutboundMedia(
  mediaUrl: string,
  params: {
    mediaKind?: LineOutboundMediaKind;
    previewImageUrl?: string;
    durationMs?: number;
    trackingId?: string;
  } = {},
): Promise<LineOutboundMediaResolved> {
  const trimmed = mediaUrl.trim();
  if (!trimmed) {
    throw new Error("LINE media URL is required.");
  }
  return {
    mediaKind: params.mediaKind ?? "image",
    mediaUrl: trimmed,
    previewImageUrl: params.previewImageUrl?.trim() || undefined,
    durationMs: params.durationMs,
    trackingId: params.trackingId?.trim() || undefined,
  };
}
