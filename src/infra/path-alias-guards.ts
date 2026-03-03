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

import { createStandaloneSingleton } from "./service-patterns.js";
export class PathAliasGuardsService {
  [Symbol.toStringTag] = 'PathAliasGuardsService';
}


const { getInstance: getPathAliasGuardsService, __testing: __testing_pathAliasGuards } =
  createStandaloneSingleton({ create: () => new PathAliasGuardsService(), defaultDeps: {} });

export { getPathAliasGuardsService, __testing_pathAliasGuards };
