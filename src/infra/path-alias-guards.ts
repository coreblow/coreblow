import {
  BOUNDARY_PATH_ALIAS_POLICIES,
  resolveBoundaryPath,
  type BoundaryPathAliasPolicy,
} from "./boundary-path.js";
import { assertNoHardlinkedFinalPath } from "./hardlink-guards.js";

export type PathAliasPolicy = BoundaryPathAliasPolicy;

export const PATH_ALIAS_POLICIES = BOUNDARY_PATH_ALIAS_POLICIES;

export async function assertNoPathAliasEscape(params: {
  absolutePath: string;
  rootPath: string;
  boundaryLabel: string;
  policy?: PathAliasPolicy;
}): Promise<void> {
  const resolved = await resolveBoundaryPath({
    absolutePath: params.absolutePath,
    rootPath: params.rootPath,
    boundaryLabel: params.boundaryLabel,
    policy: params.policy,
  });
  const allowFinalSymlink = params.policy?.allowFinalSymlinkForUnlink === true;
  if (allowFinalSymlink && resolved.kind === "symlink") {
    return;
  }
  await assertNoHardlinkedFinalPath({
    filePath: resolved.absolutePath,
    root: resolved.rootPath,
    boundaryLabel: params.boundaryLabel,
    allowFinalHardlinkForUnlink: params.policy?.allowFinalHardlinkForUnlink,
  });
}

// ---------------------------------------------------------------------------
// PathAliasGuardsService — Tier-1 Standalone Singleton
// ---------------------------------------------------------------------------

import { createTestingHooks } from "./service-patterns.js";

export class PathAliasGuardsService {
  [Symbol.toStringTag] = 'PathAliasGuardsService';
}

let _pathAliasGuardsInstance: PathAliasGuardsService | null = null;

export function getPathAliasGuardsService(): PathAliasGuardsService {
  if (!_pathAliasGuardsInstance) {
    _pathAliasGuardsInstance = new PathAliasGuardsService();
  }
  return _pathAliasGuardsInstance;
}

export const __testing_pathAliasGuards = createTestingHooks<PathAliasGuardsService>(
  () => { _pathAliasGuardsInstance = null; },
  (svc) => { _pathAliasGuardsInstance = svc; },
);
