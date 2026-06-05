import path from "node:path";
import { pathToFileURL } from "node:url";

function resolveBundledPluginPublicModulePath(params: {
  pluginId: string;
  artifactBasename: string;
}): string {
  return path.resolve(process.cwd(), "extensions", params.pluginId, params.artifactBasename);
}

export function resolveRelativeBundledPluginPublicModuleId(params: {
  fromModuleUrl: string;
  pluginId: string;
  artifactBasename: string;
}): string {
  const fromPath = new URL(params.fromModuleUrl).pathname;
  const target = resolveBundledPluginPublicModulePath(params);
  const relative = path.relative(path.dirname(fromPath), target).replaceAll(path.sep, "/");
  return relative.startsWith(".") ? relative : `./${relative}`;
}

export function resolveRelativeExtensionPublicModuleId(params: {
  fromModuleUrl: string;
  dirName: string;
  artifactBasename: string;
}): string {
  return resolveRelativeBundledPluginPublicModuleId({
    fromModuleUrl: params.fromModuleUrl,
    pluginId: params.dirName,
    artifactBasename: params.artifactBasename,
  });
}

export function resolveBundledPluginPublicModuleUrl(params: {
  pluginId: string;
  artifactBasename: string;
}): string {
  return pathToFileURL(resolveBundledPluginPublicModulePath(params)).href;
}

export function loadBundledPluginPublicSurfaceSync<T extends object>(): T {
  return {} as T;
}

export async function loadBundledPluginPublicSurface<T extends object>(): Promise<T> {
  return {} as T;
}

export const loadBundledPluginApiSync = loadBundledPluginPublicSurfaceSync;
export const loadBundledPluginContractApiSync = loadBundledPluginPublicSurfaceSync;
export const loadBundledPluginRuntimeApiSync = loadBundledPluginPublicSurfaceSync;
export const loadBundledPluginTestApiSync = loadBundledPluginPublicSurfaceSync;
