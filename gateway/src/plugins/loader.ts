/**
 * src/plugins/loader.ts
 * Extension loader — scans directories, validates, and dynamically imports extensions
 */

import fs from 'node:fs';
import path from 'node:path';
import { createChildLogger } from '../utils/logger.js';
import type { CoreBlowExtension, ExtensionContext } from './sdk.js';
import { getHomeDir } from '../gateway/config.js';

const log = createChildLogger('plugin:loader');

export interface LoadedExtension {
    extension: CoreBlowExtension;
    path: string;
    enabled: boolean;
}

/**
 * Scan and load extensions from multiple directories:
 * 1. Built-in: gateway/extensions/
 * 2. User-installed: ~/.coreblow/extensions/
 * 3. Workspace: ./extensions/ (project-local)
 */
export async function loadExtensions(): Promise<LoadedExtension[]> {
    const loaded: LoadedExtension[] = [];
    const homeDir = getHomeDir();

    const searchPaths = [
        path.join(path.dirname(new URL(import.meta.url).pathname), '../../extensions'),  // built-in
        path.join(homeDir, 'extensions'),                                                  // user
        path.join(process.cwd(), 'extensions'),                                            // workspace
    ];

    for (const searchPath of searchPaths) {
        if (!fs.existsSync(searchPath)) continue;

        const entries = fs.readdirSync(searchPath, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;

            const extDir = path.join(searchPath, entry.name);
            const extPath = path.join(extDir, 'index.ts');
            const extPathJs = path.join(extDir, 'index.js');
            const pkgPath = path.join(extDir, 'package.json');

            // Try index.ts, index.js, or package.json main
            let modulePath: string | null = null;
            if (fs.existsSync(extPathJs)) {
                modulePath = extPathJs;
            } else if (fs.existsSync(extPath)) {
                modulePath = extPath;
            } else if (fs.existsSync(pkgPath)) {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
                const main = pkg.main || 'index.js';
                const mainPath = path.join(extDir, main);
                if (fs.existsSync(mainPath)) modulePath = mainPath;
            }

            if (!modulePath) {
                log.debug({ dir: entry.name }, 'No entry point found, skipping');
                continue;
            }

            try {
                const mod = await import(modulePath);
                const ext: CoreBlowExtension = mod.default || mod.extension || mod;

                if (!ext.meta?.name) {
                    log.warn({ dir: entry.name }, 'Extension missing meta.name, skipping');
                    continue;
                }

                loaded.push({
                    extension: ext,
                    path: extDir,
                    enabled: true,
                });

                log.info({ name: ext.meta.name, version: ext.meta.version }, 'Extension loaded');
            } catch (err: any) {
                log.error({ dir: entry.name, err: err.message }, 'Failed to load extension');
            }
        }
    }

    return loaded;
}

/**
 * Initialize loaded extensions with context
 */
export async function initExtensions(
    extensions: LoadedExtension[],
    context: ExtensionContext
): Promise<void> {
    for (const { extension, path: extPath } of extensions) {
        try {
            // Create per-extension data directory
            const dataDir = path.join(getHomeDir(), 'extensions', extension.meta.name);
            fs.mkdirSync(dataDir, { recursive: true });

            const extContext: ExtensionContext = {
                ...context,
                dataDir,
                config: context.config.extensions?.[extension.meta.name] || {},
            };

            await extension.init(extContext);

            if (extension.start) {
                await extension.start();
            }

            log.info({ name: extension.meta.name }, 'Extension initialized');
        } catch (err: any) {
            log.error({ name: extension.meta.name, err: err.message }, 'Extension init failed');
        }
    }
}
