// @ts-nocheck
import { vi , Mock } from "vitest";

type DraftPreviewMode = "message" | "draft";

export type TestDraftStream = {
  update: Mock;
  flush: Mock;
  messageId: Mock;
  previewMode: Mock;
  previewRevision: Mock;
  lastDeliveredText: Mock;
  clear: Mock;
  stop: Mock;
  materialize: Mock;
  forceNewMessage: Mock;
  sendMayHaveLanded: Mock;
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
