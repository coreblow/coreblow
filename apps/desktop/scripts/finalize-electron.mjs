import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(scriptDir, "..");
const outDir = path.join(desktopRoot, "dist-electron");

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "package.json"), '{\n  "type": "commonjs"\n}\n');

for (const name of ["main", "preload"]) {
  const src = path.join(outDir, `${name}.js`);
  const dst = path.join(outDir, `${name}.cjs`);
  if (fs.existsSync(dst)) {
    fs.rmSync(dst, { force: true });
  }
  if (fs.existsSync(src)) {
    fs.renameSync(src, dst);
  }
}
