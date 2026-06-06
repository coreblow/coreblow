import path from "node:path";

const STATE_TRANSIENT_EXTENSIONS = new Set([".sock", ".pid", ".tmp"]);

export type VolatileFilterPlan = {
  stateDirs: string[];
};

function normalizePosix(input: string): string {
  return input ? path.posix.normalize(input.replaceAll("\\", "/")) : input;
}

function isUnder(childPosix: string, parentPosix: string): boolean {
  if (!parentPosix) {
    return false;
  }
  const parent = parentPosix.endsWith("/") ? parentPosix : `${parentPosix}/`;
  return childPosix === parentPosix || childPosix.startsWith(parent);
}

function hasExtension(filePosix: string, extensions: readonly string[]): boolean {
  return extensions.includes(path.posix.extname(filePosix).toLowerCase());
}

function filePathCandidates(input: string): string[] {
  const normalized = normalizePosix(input);
  if (normalized.startsWith("/") || /^[A-Za-z]:\//u.test(normalized)) {
    return [normalized];
  }
  return [normalized, normalizePosix(`/${normalized}`)];
}

function isAgentSessionTranscriptPath(filePosix: string, stateDirPosix: string): boolean {
  const agentsRoot = path.posix.join(stateDirPosix, "agents");
  if (!isUnder(filePosix, agentsRoot)) {
    return false;
  }
  const parts = path.posix.relative(agentsRoot, filePosix).split("/").filter(Boolean);
  return parts.length >= 3 && parts[1] === "sessions";
}

export function isVolatileBackupPath(absolutePath: string, plan: VolatileFilterPlan): boolean {
  if (!absolutePath) {
    return false;
  }
  for (const stateDir of plan.stateDirs) {
    const stateDirPosix = normalizePosix(stateDir);
    if (!stateDirPosix) {
      continue;
    }
    for (const filePosix of filePathCandidates(absolutePath)) {
      if (
        isUnder(filePosix, path.posix.join(stateDirPosix, "sessions")) &&
        hasExtension(filePosix, [".jsonl", ".log"])
      ) {
        return true;
      }
      if (isAgentSessionTranscriptPath(filePosix, stateDirPosix) && hasExtension(filePosix, [".jsonl", ".log"])) {
        return true;
      }
      if (
        isUnder(filePosix, path.posix.join(stateDirPosix, "cron", "runs")) &&
        hasExtension(filePosix, [".jsonl", ".log"])
      ) {
        return true;
      }
      if (
        isUnder(filePosix, path.posix.join(stateDirPosix, "logs")) &&
        hasExtension(filePosix, [".jsonl", ".log"])
      ) {
        return true;
      }
      for (const queueDir of ["delivery-queue", "session-delivery-queue"]) {
        if (
          isUnder(filePosix, path.posix.join(stateDirPosix, queueDir)) &&
          hasExtension(filePosix, [".json", ".tmp"])
        ) {
          return true;
        }
      }
      if (
        isUnder(filePosix, stateDirPosix) &&
        STATE_TRANSIENT_EXTENSIONS.has(path.posix.extname(filePosix).toLowerCase())
      ) {
        return true;
      }
    }
  }
  return false;
}
