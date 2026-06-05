import fs from "node:fs/promises";
import path from "node:path";

export type DiagnosticSupportBundleFile = {
  path: string;
  mediaType: string;
  content: string | Buffer;
};

export type DiagnosticSupportBundleContent = {
  path: string;
  mediaType: string;
  bytes: number;
};

export function jsonSupportBundleFile(pathName: string, value: unknown): DiagnosticSupportBundleFile {
  return {
    path: pathName,
    mediaType: "application/json",
    content: `${JSON.stringify(value, null, 2)}\n`,
  };
}

export function jsonlSupportBundleFile(pathName: string, lines: readonly unknown[]): DiagnosticSupportBundleFile {
  return {
    path: pathName,
    mediaType: "application/x-ndjson",
    content: `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`,
  };
}

export function textSupportBundleFile(pathName: string, content: string): DiagnosticSupportBundleFile {
  return {
    path: pathName,
    mediaType: "text/plain",
    content,
  };
}

export function supportBundleContents(
  files: readonly DiagnosticSupportBundleFile[],
): DiagnosticSupportBundleContent[] {
  return files.map((file) => ({
    path: file.path,
    mediaType: file.mediaType,
    bytes: Buffer.byteLength(file.content),
  }));
}

export async function writeSupportBundleDirectory(params: {
  outputDir: string;
  files: readonly DiagnosticSupportBundleFile[];
}): Promise<void> {
  for (const file of params.files) {
    const outputPath = path.join(params.outputDir, file.path);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, file.content);
  }
}
