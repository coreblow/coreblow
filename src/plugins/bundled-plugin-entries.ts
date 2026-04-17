import { loadGeneratedBundledPluginEntries } from "../generated/bundled-plugin-entries.generated.js";
import type { CoreBlowPluginDefinition } from "./types.js";

type BundledRegistrablePlugin = CoreBlowPluginDefinition & {
  id: string;
  register: NonNullable<CoreBlowPluginDefinition["register"]>;
};

export const BUNDLED_PLUGIN_ENTRIES =
  (await loadGeneratedBundledPluginEntries()) as unknown as readonly BundledRegistrablePlugin[];
