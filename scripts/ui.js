import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uiDir = path.resolve(__dirname, "../ui");

const args = process.argv.slice(2);
const command = args[0] || "build";

if (command === "build") {
  const result = spawnSync("npx", ["vite", "build"], {
    cwd: uiDir,
    stdio: "inherit",
    env: process.env,
  });
  process.exit(result.status ?? 0);
} else {
  const result = spawnSync("npx", ["vite", ...args], {
    cwd: uiDir,
    stdio: "inherit",
    env: process.env,
  });
  process.exit(result.status ?? 0);
}
