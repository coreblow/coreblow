import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import type { CaptureBlobRecord } from "./types.js";

export function writeCaptureBlob(params: {
  blobDir: string;
  data: Buffer | string;
  contentType?: string;
}): CaptureBlobRecord {
  fs.mkdirSync(params.blobDir, { recursive: true, mode: 0o700 });
  const raw = Buffer.isBuffer(params.data) ? params.data : Buffer.from(params.data);
  const compressed = gzipSync(raw);
  const sha256 = createHash("sha256").update(raw).digest("hex");
  const blobId = randomUUID();
  const filePath = path.join(params.blobDir, `${blobId}.gz`);
  fs.writeFileSync(filePath, compressed, { mode: 0o600 });
  return {
    blobId,
    path: filePath,
    encoding: "gzip",
    sizeBytes: raw.byteLength,
    sha256,
    ...(params.contentType ? { contentType: params.contentType } : {}),
  };
}
