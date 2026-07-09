import { expect } from "vitest";
import type {
  UnifiedModelCatalogEntry,
  UnifiedModelCatalogKind,
} from "../../model-catalog/types.js";
import { createCapturedPluginRegistration } from "../../plugins/captured-registration.js";

type UnifiedModelCatalogProviderPlugin = {
  provider: string;
  kinds: readonly UnifiedModelCatalogKind[];
  staticCatalog?: (ctx: unknown) => readonly UnifiedModelCatalogEntry[] | null | undefined;
};

export function expectUnifiedModelCatalogEntries(
  rows: readonly UnifiedModelCatalogEntry[] | null | undefined,
  params: {
    provider: string;
    kind: UnifiedModelCatalogKind;
  },
): asserts rows is readonly UnifiedModelCatalogEntry[] {
  expect(rows).toBeTruthy();
  for (const row of rows ?? []) {
    expect(row).toEqual(
      expect.objectContaining({
        provider: params.provider,
        kind: params.kind,
      }),
    );
    expect(row.model.trim()).toBe(row.model);
    expect(row.model).not.toBe("");
    expect(row.source).not.toBe("");
  }
}

// Note: expectUnifiedModelCatalogProviderRegistration is not ported because
// CoreBlow's createCapturedPluginRegistration does not take params and
// CoreBlowPluginApi does not have registerModelCatalogProvider.
