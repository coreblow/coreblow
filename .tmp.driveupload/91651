/**
 * agents/workspace-dirs.ts
 * Workspace directory structure constants.
 */
import path from 'node:path';
export function getWorkspaceDirs(baseDir: string) {
    return { root: path.resolve(baseDir), src: path.join(baseDir, 'src'), tests: path.join(baseDir, 'tests'), config: path.join(baseDir, '.coreblow'), sessions: path.join(baseDir, '.coreblow', 'sessions'), logs: path.join(baseDir, '.coreblow', 'logs'), cache: path.join(baseDir, '.coreblow', 'cache'), plugins: path.join(baseDir, '.coreblow', 'plugins'), skills: path.join(baseDir, '.coreblow', 'skills') };
}
