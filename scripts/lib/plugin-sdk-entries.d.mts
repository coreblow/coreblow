export declare const pluginSdkEntrypoints: string[];

export declare const pluginSdkSubpaths: string[];

export function buildPluginSdkEntrySources(): Record<string, string>;

export function buildPluginSdkSpecifiers(): string[];

export function buildPluginSdkPackageExports(): Record<
  string,
  { types: string; default: string }
>;
