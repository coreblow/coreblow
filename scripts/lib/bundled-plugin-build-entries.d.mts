export interface BundledPluginEntry {
  id: string;
  hasPackageJson: boolean;
  packageJson: Record<string, unknown> | null;
  sourceEntries: string[];
}

export interface CollectParams {
  cwd?: string;
  env?: Record<string, string | undefined>;
}

export function collectBundledPluginBuildEntries(
  params?: CollectParams,
): BundledPluginEntry[];

export function listBundledPluginBuildEntries(
  params?: CollectParams,
): Record<string, string>;

export function listBundledPluginPackArtifacts(
  params?: CollectParams,
): string[];
