import path from "node:path";
import { movePathToTrash as moveBrowserPathToTrash } from "../../extensions/browser/src/browser/trash.js";

export type MovePathToTrashOptions = {
  allowedRoots?: Iterable<string>;
};

function isPathInside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export async function movePathToTrash(
  targetPath: string,
  options: MovePathToTrashOptions = {},
): Promise<string> {
  const resolvedTarget = path.resolve(targetPath);
  if (resolvedTarget === path.parse(resolvedTarget).root) {
    throw new Error("Refusing to trash root path");
  }
  const allowedRoots = [...(options.allowedRoots ?? [])].map((root) => path.resolve(root));
  if (allowedRoots.length > 0 && !allowedRoots.some((root) => isPathInside(root, resolvedTarget))) {
    throw new Error("Refusing to trash path outside allowed roots");
  }
  return await moveBrowserPathToTrash(resolvedTarget);
}
