/**
 * extensions/types.ts
 * Core extension type system.
 * Ported from CoreBlow extension patterns.
 */

export type ExtensionType = 'context-pruning' | 'compaction' | 'session-manager' | 'tool-provider' | 'response-hook' | 'public-artifact';

export interface ExtensionManifest {
    id: string;
    name: string;
    version: string;
    type: ExtensionType;
    description?: string;
    author?: string;
    entrypoint: string;
    dependencies?: string[];
    config?: Record<string, ExtensionConfigField>;
}

export interface ExtensionConfigField {
    type: 'string' | 'number' | 'boolean' | 'select';
    default?: unknown;
    required?: boolean;
    description?: string;
    options?: string[];
}

export interface ExtensionInstance {
    manifest: ExtensionManifest;
    enabled: boolean;
    config: Record<string, unknown>;
    loadedAt: number;
}

export interface ExtensionHook<T = unknown> {
    extensionId: string;
    priority: number;
    handler: (context: T) => Promise<T>;
}

export type ExtensionLifecycleEvent = 'load' | 'enable' | 'disable' | 'unload' | 'error';

export interface ExtensionLifecycleCallback {
    (event: ExtensionLifecycleEvent, extensionId: string, error?: Error): void;
}
