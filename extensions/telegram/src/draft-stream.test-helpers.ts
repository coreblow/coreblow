// @ts-nocheck
import { vi } from "vitest";

type DraftPreviewMode = "message" | "draft";

export type TestDraftStream = {
  update: ReturnType<typeof vi.fn>;
  flush: ReturnType<typeof vi.fn>;
  messageId: ReturnType<typeof vi.fn>;
  previewMode: ReturnType<typeof vi.fn>;
  previewRevision: ReturnType<typeof vi.fn>;
  lastDeliveredText: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  materialize: ReturnType<typeof vi.fn>;
  forceNewMessage: ReturnType<typeof vi.fn>;
  sendMayHaveLanded: ReturnType<typeof vi.fn>;
  setMessageId: (value: number | undefined) => void;
};

export function createTestDraftStream(params?: {
  messageId?: number;
  previewMode?: DraftPreviewMode;
  onUpdate?: (text: string) => void;
  onStop?: () => void | Promise<void>;
  clearMessageIdOnForceNew?: boolean;
}): TestDraftStream {
  let messageId = params?.messageId;
  let previewRevision = 0;
  let lastDeliveredText = "";
  return {
    update: vi.fn().mockImplementation((text: string) => {
      previewRevision += 1;
      lastDeliveredText = text.trimEnd();
      params?.onUpdate?.(text);
    }),
    flush: vi.fn().mockResolvedValue(undefined),
    messageId: vi.fn().mockImplementation(() => messageId),
    previewMode: vi.fn().mockReturnValue(params?.previewMode ?? "message"),
    previewRevision: vi.fn().mockImplementation(() => previewRevision),
    lastDeliveredText: vi.fn().mockImplementation(() => lastDeliveredText),
    clear: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockImplementation(async () => {
      await params?.onStop?.();
    }),
    materialize: vi.fn().mockImplementation(async () => messageId),
    forceNewMessage: vi.fn().mockImplementation(() => {
      if (params?.clearMessageIdOnForceNew) {
        messageId = undefined;
      }
    }),
    sendMayHaveLanded: vi.fn().mockReturnValue(false),
    setMessageId: (value: number | undefined) => {
      messageId = value;
    },
  };
}

export function createSequencedTestDraftStream(startMessageId = 1001): TestDraftStream {
  let activeMessageId: number | undefined;
  let nextMessageId = startMessageId;
  let previewRevision = 0;
  let lastDeliveredText = "";
  return {
    update: vi.fn().mockImplementation((text: string) => {
      if (activeMessageId == null) {
        activeMessageId = nextMessageId++;
      }
      previewRevision += 1;
      lastDeliveredText = text.trimEnd();
    }),
    flush: vi.fn().mockResolvedValue(undefined),
    messageId: vi.fn().mockImplementation(() => activeMessageId),
    previewMode: vi.fn().mockReturnValue("message"),
    previewRevision: vi.fn().mockImplementation(() => previewRevision),
    lastDeliveredText: vi.fn().mockImplementation(() => lastDeliveredText),
    clear: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    materialize: vi.fn().mockImplementation(async () => activeMessageId),
    forceNewMessage: vi.fn().mockImplementation(() => {
      activeMessageId = undefined;
    }),
    sendMayHaveLanded: vi.fn().mockReturnValue(false),
    setMessageId: (value: number | undefined) => {
      activeMessageId = value;
    },
  };
}
