import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";

export type ReplaceDirectoryAtomicOptions = {
  stagedDir: string;
  targetDir: string;
  backupPrefix?: string;
};

export type ReplaceFileAtomicObjectOptions = {
  filePath: string;
  content: string | Buffer;
  mode?: number;
  tempPrefix?: string;
  tmpPrefix?: string;
  encoding?: BufferEncoding;
};

export type ReplaceFileAtomicOptions = {
  encoding?: BufferEncoding;
  mode?: number;
  tmpPrefix?: string;
  tempPrefix?: string;
};

export type ReplaceFileAtomicSyncOptions = ReplaceFileAtomicOptions;

export type MovePathWithCopyFallbackOptions = {
  from: string;
  to: string;
  sourceHardlinks?: "allow" | "reject";
};

async function assertNoHardlinkedSourceFiles(sourcePath: string): Promise<void> {
  const sourceStat = await fs.lstat(sourcePath);
  if (sourceStat.isFile() && sourceStat.nlink > 1) {
    throw new Error(`Hardlinked source file is not allowed: ${sourcePath}`);
  }
  if (!sourceStat.isDirectory()) {
    return;
  }

  const entries = await fs.readdir(sourcePath, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(sourcePath, entry.name);
      if (entry.isDirectory()) {
        await assertNoHardlinkedSourceFiles(entryPath);
        return;
      }
      if (!entry.isFile()) {
        return;
      }
      const entryStat = await fs.lstat(entryPath);
      if (entryStat.nlink > 1) {
        throw new Error(`Hardlinked source file is not allowed: ${entryPath}`);
      }
    }),
  );
}

export async function movePathWithCopyFallback(
  options: MovePathWithCopyFallbackOptions,
): Promise<void> {
  if (options.sourceHardlinks === "reject") {
    await assertNoHardlinkedSourceFiles(options.from);
  }
  try {
    await fs.rename(options.from, options.to);
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === "EXDEV") {
      await fs.cp(options.from, options.to, { recursive: true });
      await fs.rm(options.from, { recursive: true, force: true });
    } else {
      throw err;
    }
  }
}

export async function replaceDirectoryAtomic(
  options: ReplaceDirectoryAtomicOptions,
): Promise<void> {
  const { stagedDir, targetDir, backupPrefix = ".repo-backup-" } = options;
  const parentDir = path.dirname(targetDir);
  await fs.mkdir(parentDir, { recursive: true });

  const targetExists = await fs
    .stat(targetDir)
    .then(() => true)
    .catch(() => false);

  let backupDir: string | undefined;
  if (targetExists) {
    backupDir = path.join(
      parentDir,
      `${backupPrefix}${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await movePathWithCopyFallback({ from: targetDir, to: backupDir });
  }

  try {
    await movePathWithCopyFallback({ from: stagedDir, to: targetDir });
    if (backupDir) {
      await fs.rm(backupDir, { recursive: true, force: true }).catch(() => {});
    }
  } catch (err) {
    if (backupDir) {
      await movePathWithCopyFallback({ from: backupDir, to: targetDir }).catch(() => {});
    }
    throw err;
  }
}

export async function replaceFileAtomic(
  targetPathOrOpts: string | ReplaceFileAtomicObjectOptions,
  content?: string | Buffer,
  options: ReplaceFileAtomicOptions = {},
): Promise<void> {
  let targetPath: string;
  let fileContent: string | Buffer;
  let opts: ReplaceFileAtomicOptions;

  if (typeof targetPathOrOpts === "object" && targetPathOrOpts !== null) {
    targetPath = targetPathOrOpts.filePath;
    fileContent = targetPathOrOpts.content;
    opts = {
      encoding: targetPathOrOpts.encoding,
      mode: targetPathOrOpts.mode,
      tmpPrefix: targetPathOrOpts.tempPrefix ?? targetPathOrOpts.tmpPrefix,
    };
  } else {
    targetPath = targetPathOrOpts;
    fileContent = content!;
    opts = options;
  }

  const parentDir = path.dirname(targetPath);
  await fs.mkdir(parentDir, { recursive: true });
  const prefix = opts.tmpPrefix ?? opts.tempPrefix ?? ".tmp-atomic-";
  const tmpPath = path.join(
    parentDir,
    `${prefix}${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  await fs.writeFile(tmpPath, fileContent, {
    encoding: opts.encoding ?? "utf8",
    mode: opts.mode,
  });

  try {
    await fs.rename(tmpPath, targetPath);
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === "EXDEV") {
      await fs.copyFile(tmpPath, targetPath);
      await fs.unlink(tmpPath).catch(() => {});
    } else {
      await fs.unlink(tmpPath).catch(() => {});
      throw err;
    }
  }
}

export function replaceFileAtomicSync(
  targetPathOrOpts: string | ReplaceFileAtomicObjectOptions,
  content?: string | Buffer,
  options: ReplaceFileAtomicSyncOptions = {},
): void {
  let targetPath: string;
  let fileContent: string | Buffer;
  let opts: ReplaceFileAtomicSyncOptions;

  if (typeof targetPathOrOpts === "object" && targetPathOrOpts !== null) {
    targetPath = targetPathOrOpts.filePath;
    fileContent = targetPathOrOpts.content;
    opts = {
      encoding: targetPathOrOpts.encoding,
      mode: targetPathOrOpts.mode,
      tmpPrefix: targetPathOrOpts.tempPrefix ?? targetPathOrOpts.tmpPrefix,
    };
  } else {
    targetPath = targetPathOrOpts;
    fileContent = content!;
    opts = options;
  }

  const parentDir = path.dirname(targetPath);
  fsSync.mkdirSync(parentDir, { recursive: true });
  const prefix = opts.tmpPrefix ?? opts.tempPrefix ?? ".tmp-atomic-";
  const tmpPath = path.join(
    parentDir,
    `${prefix}${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  fsSync.writeFileSync(tmpPath, fileContent, {
    encoding: opts.encoding ?? "utf8",
    mode: opts.mode,
  });

  try {
    fsSync.renameSync(tmpPath, targetPath);
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === "EXDEV") {
      fsSync.copyFileSync(tmpPath, targetPath);
      try {
        fsSync.unlinkSync(tmpPath);
      } catch {
        // ignore
      }
    } else {
      try {
        fsSync.unlinkSync(tmpPath);
      } catch {
        // ignore
      }
      throw err;
    }
  }
}
