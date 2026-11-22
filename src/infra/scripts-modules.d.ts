declare module "../../scripts/watch-node.mjs" {
  export function runWatchMain(params?: {
    spawn?: (
      cmd: string,
      args: string[],
      options: unknown,
    ) => { on: (event: "exit", cb: (code: number | null, signal: string | null) => void) => void };
    process?: NodeJS.Process;
    cwd?: string;
    args?: string[];
    env?: NodeJS.ProcessEnv;
    now?: () => number;
  }): Promise<number>;
}

declare module "../../scripts/ci-changed-scope.mjs" {
  export function detectChangedScope(paths: string[]): {
    runNode: boolean;
    runMacos: boolean;
    runAndroid: boolean;
    runWindows: boolean;
    runSkillsPython: boolean;
    runChangedSmoke: boolean;
  };
}

declare module "../../scripts/lib/local-build-metadata-paths.mjs" {
  export const BUILD_STAMP_FILE: string;
  export const RUNTIME_POSTBUILD_STAMP_FILE: string;
  export const LOCAL_BUILD_METADATA_DIST_PATHS: readonly string[];
  export function isLocalBuildMetadataDistPath(relativePath: string): boolean;
}

declare module "*coreblow.mjs" {
  export function buildChildEnv(baseEnv?: NodeJS.ProcessEnv): NodeJS.ProcessEnv;
  export function isDirectRun(argv1?: string): boolean;
  export function forwardSignalsToChild(child: {
    killed?: boolean;
    exitCode: number | null;
    signalCode: string | null;
    kill: (signal: string) => boolean | void;
    on: (event: string, listener: (...args: any[]) => void) => void;
  }): () => void;
  export function resolveTsxBin(baseDir?: string): string | null;
  export function resolveTsxEsmUrl(specifier?: string): string | null;
}
