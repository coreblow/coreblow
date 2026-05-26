import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  DEFAULT_MANAGED_IMAGE_ATTACHMENT_LIMITS,
  attachManagedOutgoingImagesToMessage,
  cleanupManagedOutgoingImageRecords,
  createManagedOutgoingImageBlocks,
  resolveManagedImageAttachmentLimits,
} from "./managed-image-attachments.js";

const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lw0tVwAAAABJRU5ErkJggg==";

async function readRecords(stateDir: string): Promise<Array<Record<string, unknown>>> {
  const recordsDir = path.join(stateDir, "media", "outgoing", "records");
  const names = await fs.readdir(recordsDir);
  return await Promise.all(
    names.map(async (name) => JSON.parse(await fs.readFile(path.join(recordsDir, name), "utf-8"))),
  );
}

describe("managed image attachments", () => {
  let stateDir: string;

  beforeEach(async () => {
    stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "coreblow-managed-images-"));
  });

  afterEach(async () => {
    await fs.rm(stateDir, { recursive: true, force: true });
  });

  test("keeps the public limit shape", () => {
    expect(resolveManagedImageAttachmentLimits()).toEqual(DEFAULT_MANAGED_IMAGE_ATTACHMENT_LIMITS);
    expect(resolveManagedImageAttachmentLimits({ maxBytes: 1024 })).toEqual({
      ...DEFAULT_MANAGED_IMAGE_ATTACHMENT_LIMITS,
      maxBytes: 1024,
    });
  });

  test("creates managed outgoing image blocks from image data URLs", async () => {
    const blocks = await createManagedOutgoingImageBlocks({
      sessionKey: "agent:main:main",
      mediaUrls: [`data:image/png;base64,${TINY_PNG_BASE64}`],
      stateDir,
    });

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      type: "image",
      alt: "Generated image 1",
      mimeType: "image/png",
      width: 1,
      height: 1,
    });
    expect(String(blocks[0]?.url)).toContain("/api/chat/media/outgoing/agent%3Amain%3Amain/");

    const records = await readRecords(stateDir);
    expect(records[0]).toMatchObject({
      sessionKey: "agent:main:main",
      messageId: null,
      retentionClass: "transient",
      alt: "Generated image 1",
    });
  });

  test("promotes managed image records when attached to a persisted message", async () => {
    const blocks = await createManagedOutgoingImageBlocks({
      sessionKey: "agent:main:main",
      mediaUrls: [`data:image/png;base64,${TINY_PNG_BASE64}`],
      stateDir,
    });

    await attachManagedOutgoingImagesToMessage({
      messageId: "message-1",
      blocks,
      stateDir,
    });

    const records = await readRecords(stateDir);
    expect(records[0]).toMatchObject({
      messageId: "message-1",
      retentionClass: "history",
    });
  });

  test("skips non-image data URLs", async () => {
    const blocks = await createManagedOutgoingImageBlocks({
      sessionKey: "agent:main:main",
      mediaUrls: ["data:text/plain;base64,aGVsbG8="],
      stateDir,
    });

    expect(blocks).toStrictEqual([]);
  });

  test("cleans up expired transient records and keeps history records", async () => {
    const transientBlocks = await createManagedOutgoingImageBlocks({
      sessionKey: "agent:main:main",
      mediaUrls: [`data:image/png;base64,${TINY_PNG_BASE64}`],
      stateDir,
    });
    const historyBlocks = await createManagedOutgoingImageBlocks({
      sessionKey: "agent:main:main",
      mediaUrls: [`data:image/png;base64,${TINY_PNG_BASE64}`],
      stateDir,
      messageId: "message-1",
    });
    expect(transientBlocks).toHaveLength(1);
    expect(historyBlocks).toHaveLength(1);

    const result = await cleanupManagedOutgoingImageRecords({
      stateDir,
      nowMs: Date.now() + 60 * 60 * 1000,
      transientTtlMs: 1,
    });

    expect(result).toEqual({
      deletedRecordCount: 1,
      deletedFileCount: 1,
      retainedCount: 1,
    });
    expect(await readRecords(stateDir)).toHaveLength(1);
  });
});
