import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const CANVAS_A2UI_FILES = ["index.html", "a2ui.bundle.js", ".bundle.hash"];

export function copyCanvasA2uiAssets(params = {}) {
  const cwd = params.cwd ?? process.cwd();
  const sourceDir = resolve(cwd, "src/canvas-host/a2ui");
  const targetDir = resolve(cwd, "dist/canvas-host/a2ui");

  if (!existsSync(sourceDir)) {
    return;
  }

  let copied = false;
  for (const fileName of CANVAS_A2UI_FILES) {
    const srcPath = resolve(sourceDir, fileName);
    if (!existsSync(srcPath)) {
      continue;
    }
    if (!copied) {
      mkdirSync(targetDir, { recursive: true });
      copied = true;
    }
    copyFileSync(srcPath, resolve(targetDir, fileName));
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  copyCanvasA2uiAssets();
}
