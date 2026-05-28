import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function formatGeneratedModule(source, { repoRoot, outputPath, errorLabel }) {
  const resolvedRepoRoot = path.resolve(repoRoot);
  const resolvedOutputPath = path.resolve(
    resolvedRepoRoot,
    path.isAbsolute(outputPath) ? path.relative(resolvedRepoRoot, outputPath) : outputPath,
  );
  const formatterFilename = process.platform === "win32" ? "oxfmt.cmd" : "oxfmt";
  const directFormatterPath = path.join(
    resolvedRepoRoot,
    "node_modules",
    ".bin",
    formatterFilename,
  );
  if (!fs.existsSync(directFormatterPath)) {
    throw new Error(
      `failed to format generated ${errorLabel}: missing local oxfmt binary; run pnpm install`,
    );
  }
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-generated-format-"));
  const tempOutputPath = path.join(tempDir, path.basename(resolvedOutputPath));

  try {
    fs.writeFileSync(tempOutputPath, source, "utf8");
    const formatter = spawnSync(directFormatterPath, ["--write", tempOutputPath], {
      cwd: resolvedRepoRoot,
      encoding: "utf8",
      // Windows requires a shell to launch package-manager shim scripts reliably.
      ...(process.platform === "win32" ? { shell: true } : {}),
    });
    if (formatter.status !== 0) {
      const details =
        formatter.stderr?.trim() ||
        formatter.stdout?.trim() ||
        formatter.error?.message ||
        "unknown formatter failure";
      throw new Error(`failed to format generated ${errorLabel}: ${details}`);
    }
    return fs.readFileSync(tempOutputPath, "utf8");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
