import { loadConfig } from "./config.js";
import { readConfigFileSnapshot, writeConfigFile } from "./io.js";
import type { ConfigWriteOptions } from "./io.js";
import type { CoreBlowConfig } from "./types.coreblow.js";

export type MutateConfigFileContext = {
  snapshot: Awaited<ReturnType<typeof readConfigFileSnapshot>>;
  previousHash: string | null;
};

export type MutateConfigFileParams<T = unknown> = {
  mutate: (draft: CoreBlowConfig, context: MutateConfigFileContext) => Promise<T> | T;
  afterWrite?: { mode?: string; reason?: string } | unknown;
  writeOptions?: ConfigWriteOptions;
};

export type ReplaceConfigFileParams = {
  nextConfig: CoreBlowConfig;
  afterWrite?: { mode?: string; reason?: string } | unknown;
  writeOptions?: ConfigWriteOptions;
};

export type MutateConfigFileResult<T = unknown> = {
  nextConfig: CoreBlowConfig;
  previousHash: string | null;
  persistedHash: string | null;
  afterWrite?: unknown;
  followUp: { mode: string; requiresRestart: boolean };
  result?: T;
};

export async function replaceConfigFile(
  params: ReplaceConfigFileParams,
): Promise<MutateConfigFileResult<void>> {
  const snapshot = await readConfigFileSnapshot();
  await writeConfigFile(params.nextConfig, {
    ...params.writeOptions,
    afterWrite: params.afterWrite ?? params.writeOptions?.afterWrite,
  });
  return {
    nextConfig: params.nextConfig,
    previousHash: snapshot.hash ?? null,
    persistedHash: snapshot.hash ?? null,
    afterWrite: params.afterWrite,
    followUp: { mode: "auto", requiresRestart: false },
  };
}

export async function mutateConfigFile<T = unknown>(
  params: MutateConfigFileParams<T>,
): Promise<MutateConfigFileResult<T>> {
  const snapshot = await readConfigFileSnapshot();
  const draft = structuredClone(snapshot.config ?? loadConfig());
  const result = await params.mutate(draft, {
    snapshot,
    previousHash: snapshot.hash ?? null,
  });
  await writeConfigFile(draft, {
    ...params.writeOptions,
    afterWrite: params.afterWrite ?? params.writeOptions?.afterWrite,
  });
  return {
    nextConfig: draft,
    previousHash: snapshot.hash ?? null,
    persistedHash: snapshot.hash ?? null,
    afterWrite: params.afterWrite,
    followUp: { mode: "auto", requiresRestart: false },
    result,
  };
}
