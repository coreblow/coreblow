/** CoreBlow — FS Pinned Write Helper */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
export async function atomicWriteFile(targetPath: string, content: string | Buffer): Promise<void> {
  const dir = path.dirname(targetPath);
  const tmpPath = path.join(dir, `.tmp-${process.pid}-${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(tmpPath, content);
  fs.renameSync(tmpPath, targetPath);
}
