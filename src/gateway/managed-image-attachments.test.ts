import fs from "node:fs/promises";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  DEFAULT_MANAGED_IMAGE_ATTACHMENT_LIMITS,
  attachManagedOutgoingImagesToMessage,
  cleanupManagedOutgoingImageRecords,
  createManagedOutgoingImageBlocks,
  handleManagedOutgoingImageHttpRequest,
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

async function expectPathMissing(targetPath: string): Promise<void> {
  try {
    await fs.access(targetPath);
  } catch (error) {
    expect((error as NodeJS.ErrnoException).code).toBe("ENOENT");
    return;
  }
  throw new Error(`expected ${targetPath} to be missing`);
}

async function withManagedImageServer<T>(
  stateDir: string,
  run: (baseUrl: string) => Promise<T>,
): Promise<T> {
  const server = createServer(async (req, res) => {
    const handled = await handleManagedOutgoingImageHttpRequest(req, res, {
      auth: { mode: "token", token: "secret", allowTailscale: false },
      stateDir,
    });
    if (!handled) {
      res.statusCode = 404;
      res.end("not found");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("expected local server address");
    }
    return await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      (server as Server).close((error) => (error ? reject(error) : resolve())),
    );
  }
}

async function writeManagedImageTranscriptFixture(params: {
  stateDir: string;
  sessionKey: string;
  sessionId: string;
  messageId: string;
  blocks: readonly Record<string, unknown>[];
}): Promise<void> {
  const sessionsDir = path.join(params.stateDir, "agents", "main", "sessions");
  const sessionFile = path.join(sessionsDir, `${params.sessionId}.jsonl`);
  await fs.mkdir(sessionsDir, { recursive: true });
  await fs.writeFile(
    path.join(sessionsDir, "sessions.json"),
    `${JSON.stringify({
      [params.sessionKey]: {
        sessionId: params.sessionId,
        updatedAt: Date.now(),
        sessionFile,
      },
    })}\n`,
  );
  await fs.writeFile(
    sessionFile,
    `${JSON.stringify({
      type: "message",
      id: params.messageId,
      message: {
        role: "assistant",
        content: params.blocks,
      },
    })}\n`,
  );
}

describe("managed image attachments", () => {
  let stateDir: string;

  beforeEach(async () => {
    stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "coreblow-managed-images-"));
    vi.stubEnv("COREBLOW_STATE_DIR", stateDir);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
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
    await writeManagedImageTranscriptFixture({
      stateDir,
      sessionKey: "agent:main:main",
      sessionId: "managed-image-session",
      messageId: "message-1",
      blocks: historyBlocks,
    });

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

  test("cleans up history records no longer referenced by transcript messages", async () => {
    const blocks = await createManagedOutgoingImageBlocks({
      sessionKey: "agent:main:main",
      mediaUrls: [`data:image/png;base64,${TINY_PNG_BASE64}`],
      stateDir,
      messageId: "message-1",
    });
    const [record] = await readRecords(stateDir);
    const originalPath = String((record?.original as { path?: unknown } | undefined)?.path ?? "");
    await writeManagedImageTranscriptFixture({
      stateDir,
      sessionKey: "agent:main:main",
      sessionId: "managed-image-session",
      messageId: "message-1",
      blocks: [{ type: "text", text: "image was removed from transcript" }],
    });

    const result = await cleanupManagedOutgoingImageRecords({ stateDir });

    expect(blocks).toHaveLength(1);
    expect(result).toEqual({
      deletedRecordCount: 1,
      deletedFileCount: 1,
      retainedCount: 0,
    });
    await expectPathMissing(originalPath);
    expect(await readRecords(stateDir)).toHaveLength(0);
  });

  test("removes orphan managed originals during cleanup", async () => {
    const blocks = await createManagedOutgoingImageBlocks({
      sessionKey: "agent:main:main",
      mediaUrls: [`data:image/png;base64,${TINY_PNG_BASE64}`],
      stateDir,
      messageId: "message-1",
    });
    await writeManagedImageTranscriptFixture({
      stateDir,
      sessionKey: "agent:main:main",
      sessionId: "managed-image-session",
      messageId: "message-1",
      blocks,
    });
    const orphanPath = path.join(stateDir, "media", "outgoing", "originals", "orphan.png");
    await fs.writeFile(orphanPath, Buffer.from(TINY_PNG_BASE64, "base64"));

    const result = await cleanupManagedOutgoingImageRecords({ stateDir });

    expect(result).toEqual({
      deletedRecordCount: 0,
      deletedFileCount: 1,
      retainedCount: 1,
    });
    await expectPathMissing(orphanPath);
  });

  test("force deletes only matching session records during scoped cleanup", async () => {
    const deletedBlocks = await createManagedOutgoingImageBlocks({
      sessionKey: "agent:main:main",
      mediaUrls: [`data:image/png;base64,${TINY_PNG_BASE64}`],
      stateDir,
      messageId: "message-1",
    });
    const retainedBlocks = await createManagedOutgoingImageBlocks({
      sessionKey: "agent:other:main",
      mediaUrls: [`data:image/png;base64,${TINY_PNG_BASE64}`],
      stateDir,
      messageId: "message-2",
    });
    const records = await readRecords(stateDir);
    const retainedRecord = records.find((record) => record.sessionKey === "agent:other:main");
    const retainedPath = String(
      (retainedRecord?.original as { path?: unknown } | undefined)?.path ?? "",
    );
    await writeManagedImageTranscriptFixture({
      stateDir,
      sessionKey: "agent:other:main",
      sessionId: "managed-other-session",
      messageId: "message-2",
      blocks: retainedBlocks,
    });

    const result = await cleanupManagedOutgoingImageRecords({
      stateDir,
      sessionKey: "agent:main:main",
      forceDeleteSessionRecords: true,
    });

    expect(deletedBlocks).toHaveLength(1);
    expect(result).toEqual({
      deletedRecordCount: 1,
      deletedFileCount: 1,
      retainedCount: 1,
    });
    await expect(fs.access(retainedPath)).resolves.toBeUndefined();
    expect(await readRecords(stateDir)).toHaveLength(1);
  });

  test("serves managed image bytes for authorized history readers", async () => {
    const blocks = await createManagedOutgoingImageBlocks({
      sessionKey: "agent:main:main",
      mediaUrls: [`data:image/png;base64,${TINY_PNG_BASE64}`],
      stateDir,
      messageId: "message-1",
    });
    const url = String(blocks[0]?.url);
    await writeManagedImageTranscriptFixture({
      stateDir,
      sessionKey: "agent:main:main",
      sessionId: "managed-image-session",
      messageId: "message-1",
      blocks,
    });

    await withManagedImageServer(stateDir, async (baseUrl) => {
      const res = await fetch(`${baseUrl}${url}`, {
        headers: { authorization: "Bearer secret" },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/png");
      expect(res.headers.get("cache-control")).toBe("private, max-age=31536000, immutable");
      expect(Buffer.from(await res.arrayBuffer())).toEqual(Buffer.from(TINY_PNG_BASE64, "base64"));
    });
  });

  test("does not serve history records missing transcript image references", async () => {
    const blocks = await createManagedOutgoingImageBlocks({
      sessionKey: "agent:main:main",
      mediaUrls: [`data:image/png;base64,${TINY_PNG_BASE64}`],
      stateDir,
      messageId: "message-1",
    });
    const url = String(blocks[0]?.url);
    await writeManagedImageTranscriptFixture({
      stateDir,
      sessionKey: "agent:main:main",
      sessionId: "managed-image-session",
      messageId: "message-1",
      blocks: [{ type: "text", text: "no managed image block here" }],
    });

    await withManagedImageServer(stateDir, async (baseUrl) => {
      const res = await fetch(`${baseUrl}${url}`, {
        headers: { authorization: "Bearer secret" },
      });

      expect(res.status).toBe(404);
    });
  });

  test("rejects unauthenticated and non-GET media requests", async () => {
    const blocks = await createManagedOutgoingImageBlocks({
      sessionKey: "agent:main:main",
      mediaUrls: [`data:image/png;base64,${TINY_PNG_BASE64}`],
      stateDir,
      messageId: "message-1",
    });
    const url = String(blocks[0]?.url);

    await withManagedImageServer(stateDir, async (baseUrl) => {
      const unauthenticated = await fetch(`${baseUrl}${url}`);
      expect(unauthenticated.status).toBe(401);

      const post = await fetch(`${baseUrl}${url}`, {
        method: "POST",
        headers: { authorization: "Bearer secret" },
      });
      expect(post.status).toBe(405);
      expect(post.headers.get("allow")).toBe("GET");
    });
  });

  test("does not serve transient media records before message attachment", async () => {
    const blocks = await createManagedOutgoingImageBlocks({
      sessionKey: "agent:main:main",
      mediaUrls: [`data:image/png;base64,${TINY_PNG_BASE64}`],
      stateDir,
    });
    const url = String(blocks[0]?.url);

    await withManagedImageServer(stateDir, async (baseUrl) => {
      const res = await fetch(`${baseUrl}${url}`, {
        headers: { authorization: "Bearer secret" },
      });

      expect(res.status).toBe(404);
    });
  });
});
