import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { runPluginCommandWithTimeout } from "coreblow/plugin-sdk/run-command";
import type { RuntimeEnv } from "coreblow/plugin-sdk/runtime-env";
import { fetchWithSsrFGuard } from "coreblow/plugin-sdk/ssrf-runtime";

export type ReleaseAsset = { name?: string; browser_download_url?: string };
export type NamedAsset = { name: string; browser_download_url: string };
export type SignalInstallResult = { ok: boolean; cliPath?: string; version?: string; error?: string };

const MAX_ARCHIVE_BYTES = 256 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 5 * 60_000;

export function looksLikeArchive(name: string): boolean {
  const normalized = name.toLowerCase();
  return normalized.endsWith(".tar.gz") || normalized.endsWith(".tgz") || normalized.endsWith(".zip");
}

export function pickAsset(
  assets: ReleaseAsset[],
  platform: NodeJS.Platform,
  arch: string,
): NamedAsset | undefined {
  const archives = assets.filter(
    (asset): asset is NamedAsset => Boolean(asset.name && asset.browser_download_url && looksLikeArchive(asset.name)),
  );
  const find = (pattern: RegExp) => archives.find((asset) => pattern.test(asset.name.toLowerCase()));
  if (platform === "linux") return arch === "x64" ? find(/linux-native|linux/) : undefined;
  if (platform === "darwin") return find(/macos|osx|darwin/) ?? archives[0];
  if (platform === "win32") return find(/windows|win/) ?? archives[0];
  return archives[0];
}

export async function downloadToFile(
  url: string,
  destination: string,
  maxRedirects = 5,
  maxBytes = MAX_ARCHIVE_BYTES,
): Promise<void> {
  const { response, release } = await fetchWithSsrFGuard({
    url,
    maxRedirects,
    timeoutMs: DOWNLOAD_TIMEOUT_MS,
    auditContext: "signal-cli-install-archive",
  });
  let complete = false;
  try {
    if (!response.ok || !response.body) throw new Error(`HTTP ${response.status} downloading file`);
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > maxBytes) {
      throw new Error(`signal-cli archive exceeds the ${maxBytes}-byte download cap`);
    }
    let total = 0;
    const limiter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        total += chunk.byteLength;
        callback(total > maxBytes ? new Error("signal-cli archive exceeded size limit") : null, chunk);
      },
    });
    await pipeline(Readable.fromWeb(response.body as never), limiter, createWriteStream(destination));
    complete = true;
  } finally {
    await release();
    if (!complete) await fs.rm(destination, { force: true }).catch(() => undefined);
  }
}

export async function extractSignalCliArchive(
  archivePath: string,
  installRoot: string,
  timeoutMs: number,
): Promise<void> {
  await fs.mkdir(installRoot, { recursive: true });
  const argv = archivePath.toLowerCase().endsWith(".zip")
    ? ["unzip", "-q", archivePath, "-d", installRoot]
    : ["tar", "-xzf", archivePath, "-C", installRoot];
  const result = await runPluginCommandWithTimeout({ argv, timeoutMs });
  if (result.code !== 0) throw new Error(result.stderr.trim() || `archive extraction failed (${result.code})`);
}

async function findBinary(root: string, depth = 0): Promise<string | undefined> {
  if (depth > 3) return undefined;
  for (const entry of await fs.readdir(root, { withFileTypes: true }).catch(() => [])) {
    const fullPath = path.join(root, entry.name);
    if (entry.isFile() && (entry.name === "signal-cli" || entry.name === "signal-cli.exe")) return fullPath;
    if (entry.isDirectory()) {
      const nested = await findBinary(fullPath, depth + 1);
      if (nested) return nested;
    }
  }
  return undefined;
}

export async function installSignalCliFromRelease(runtime: RuntimeEnv): Promise<SignalInstallResult> {
  const { response, release } = await fetchWithSsrFGuard({
    url: "https://api.github.com/repos/AsamK/signal-cli/releases/latest",
    timeoutMs: 30_000,
    maxRedirects: 5,
    auditContext: "signal-cli-release-info",
    init: { headers: { "User-Agent": "coreblow", Accept: "application/vnd.github+json" } },
  });
  let payload: { tag_name?: string; assets?: ReleaseAsset[] };
  try {
    if (!response.ok) return { ok: false, error: `Failed to fetch release info (${response.status})` };
    payload = (await response.json()) as typeof payload;
  } catch {
    return { ok: false, error: "Failed to parse signal-cli release info." };
  } finally {
    await release();
  }
  const asset = pickAsset(payload.assets ?? [], process.platform, process.arch);
  if (!asset) return { ok: false, error: "No compatible release asset found for this platform." };
  const version = payload.tag_name?.replace(/^v/, "") ?? "unknown";
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "coreblow-signal-"));
  const archivePath = path.join(tempRoot, asset.name);
  const installRoot = path.join(os.homedir(), ".coreblow", "tools", "signal-cli", version);
  try {
    runtime.log(`Downloading signal-cli ${version} (${asset.name})...`);
    await downloadToFile(asset.browser_download_url, archivePath);
    await extractSignalCliArchive(archivePath, installRoot, 60_000);
    const cliPath = await findBinary(installRoot);
    if (!cliPath) return { ok: false, error: "signal-cli binary not found after extraction" };
    await fs.chmod(cliPath, 0o755).catch(() => undefined);
    return { ok: true, cliPath, version };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function installSignalCli(runtime: RuntimeEnv): Promise<SignalInstallResult> {
  if (process.platform === "win32") {
    return { ok: false, error: "Signal CLI auto-install is not supported on Windows yet." };
  }
  return installSignalCliFromRelease(runtime);
}
