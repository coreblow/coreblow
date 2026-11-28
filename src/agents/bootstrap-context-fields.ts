import type { EmbeddedContextFile } from "./system-prompt.js";
import type { WorkspaceBootstrapFile } from "./workspace.js";

/**
 * Normalizes `resolveBootstrapContextForRun` output (and legacy test mocks) into typed arrays,
 * ensuring deprecated `content: string` is never passed as `contextFiles`.
 */
export function resolveBootstrapRunContextFields(resolved: {
  bootstrapFiles?: WorkspaceBootstrapFile[];
  contextFiles?: EmbeddedContextFile[];
  files?: unknown[];
  content?: unknown;
}): {
  bootstrapFiles: WorkspaceBootstrapFile[];
  contextFiles: EmbeddedContextFile[];
} {
  const bootstrapFiles = Array.isArray(resolved.bootstrapFiles)
    ? resolved.bootstrapFiles
    : Array.isArray(resolved.files)
      ? (resolved.files as WorkspaceBootstrapFile[])
      : [];
  const contextFiles = Array.isArray(resolved.contextFiles)
    ? resolved.contextFiles
    : Array.isArray(resolved.content)
      ? (resolved.content as EmbeddedContextFile[])
      : [];
  return { bootstrapFiles, contextFiles };
}
