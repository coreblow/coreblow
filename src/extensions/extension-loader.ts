/**
 * extensions/extension-loader.ts
 * Extension discovery and loading.
 * Ported from CoreBlow reference extension patterns.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { ExtensionManifest, ExtensionInstance, ExtensionLifecycleCallback } from './types.js';

export class ExtensionLoader {
    private extensions = new Map<string, ExtensionInstance>();
    private lifecycleCallbacks: ExtensionLifecycleCallback[] = [];

    /**
     * Discover extensions from a directory.
     */
    async discover(extensionsDir: string): Promise<ExtensionManifest[]> {
        if (!fs.existsSync(extensionsDir)) return [];

        const manifests: ExtensionManifest[] = [];
        const entries = fs.readdirSync(extensionsDir, { withFileTypes: true });

        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const manifestPath = path.join(extensionsDir, entry.name, 'manifest.json');
            if (!fs.existsSync(manifestPath)) continue;

            try {
                const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
                const manifest = validateManifest(raw, entry.name);
                if (manifest) manifests.push(manifest);
            } catch { /* skip invalid */ }
        }

        return manifests;
    }

    /**
     * Load an extension by manifest.
     */
    async load(manifest: ExtensionManifest, config?: Record<string, unknown>): Promise<ExtensionInstance> {
        if (this.extensions.has(manifest.id)) {
            return this.extensions.get(manifest.id)!;
        }

        // Check dependencies
        for (const dep of manifest.dependencies ?? []) {
            if (!this.extensions.has(dep)) {
                throw new Error(`Extension ${manifest.id} requires ${dep} which is not loaded`);
            }
        }

        const instance: ExtensionInstance = {
            manifest,
            enabled: true,
            config: config ?? {},
            loadedAt: Date.now(),
        };

        this.extensions.set(manifest.id, instance);
        this.notifyLifecycle('load', manifest.id);
        return instance;
    }

    /**
     * Unload an extension.
     */
    async unload(extensionId: string): Promise<boolean> {
        // Check if other extensions depend on this one
        for (const [id, ext] of this.extensions) {
            if (ext.manifest.dependencies?.includes(extensionId)) {
                throw new Error(`Cannot unload ${extensionId}: ${id} depends on it`);
            }
        }

        const existed = this.extensions.delete(extensionId);
        if (existed) this.notifyLifecycle('unload', extensionId);
        return existed;
    }

    /**
     * Enable/disable an extension.
     */
    setEnabled(extensionId: string, enabled: boolean): boolean {
        const ext = this.extensions.get(extensionId);
        if (!ext) return false;
        ext.enabled = enabled;
        this.notifyLifecycle(enabled ? 'enable' : 'disable', extensionId);
        return true;
    }

    /**
     * Get a loaded extension.
     */
    get(extensionId: string): ExtensionInstance | undefined {
        return this.extensions.get(extensionId);
    }

    /**
     * List all loaded extensions.
     */
    list(): ExtensionInstance[] {
        return [...this.extensions.values()];
    }

    /**
     * List enabled extensions of a specific type.
     */
    listByType(type: string): ExtensionInstance[] {
        return this.list().filter((ext) => ext.enabled && ext.manifest.type === type);
    }

    /**
     * Register lifecycle callback.
     */
    onLifecycle(callback: ExtensionLifecycleCallback): void {
        this.lifecycleCallbacks.push(callback);
    }

    private notifyLifecycle(event: ExtensionInstance extends never ? never : 'load' | 'enable' | 'disable' | 'unload', id: string, error?: Error): void {
        for (const cb of this.lifecycleCallbacks) {
            try { cb(event, id, error); } catch { /* ignore */ }
        }
    }
}

function validateManifest(raw: unknown, fallbackId: string): ExtensionManifest | null {
    if (!raw || typeof raw !== 'object') return null;
    const obj = raw as Record<string, unknown>;
    const id = typeof obj.id === 'string' ? obj.id : fallbackId;
    const name = typeof obj.name === 'string' ? obj.name : id;
    const version = typeof obj.version === 'string' ? obj.version : '0.0.0';
    const type = typeof obj.type === 'string' ? obj.type : 'tool-provider';
    const entrypoint = typeof obj.entrypoint === 'string' ? obj.entrypoint : 'index.js';

    return { id, name, version, type: type as ExtensionManifest['type'], entrypoint, description: obj.description as string | undefined, author: obj.author as string | undefined, dependencies: Array.isArray(obj.dependencies) ? obj.dependencies as string[] : [] };
}
