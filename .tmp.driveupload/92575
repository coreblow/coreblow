import path from "node:path";

export function resolveStateDir(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.COREBLOW_STATE_DIR?.trim();
  if (override) {
    return override;
  }
  const home = env.HOME || env.USERPROFILE || "/tmp";
  return path.join(home, ".coreblow");
}

export function resolveDataDir(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveStateDir(env), "data");
}
