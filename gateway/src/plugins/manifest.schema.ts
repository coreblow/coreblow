/**
 * plugins/manifest.schema.ts
 * Zod validation for plugin manifest files.
 *
 * Every plugin must have a valid manifest. This schema ensures
 * structural integrity before loading any plugin code.
 */

import { z } from 'zod';

export const SemVerRegex = /^\d+\.\d+\.\d+(-[\w.]+)?$/;

export const PluginPermissionSchema = z.enum([
    'fs',
    'network',
    'exec',
    'env',
    'clipboard',
    'notifications',
]);

export const PluginToolSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    parameters: z.record(z.string(), z.unknown()).optional(),
});

export const PluginHookSchema = z.object({
    event: z.string().min(1),
    handler: z.string().min(1),
    priority: z.number().int().min(0).max(1000).default(100),
});

export const PluginManifestSchema = z.object({
    name: z.string().min(1).max(100),
    version: z.string().regex(SemVerRegex, 'Must be valid semver (e.g. 1.0.0)'),
    description: z.string().max(1000).optional(),
    author: z.string().max(200).optional(),
    license: z.string().optional(),
    homepage: z.string().url().optional(),
    repository: z.string().optional(),
    permissions: z.array(PluginPermissionSchema).default([]),
    hooks: z.array(PluginHookSchema).optional(),
    tools: z.array(PluginToolSchema).optional(),
    commands: z.array(z.object({
        name: z.string(),
        description: z.string().optional(),
        aliases: z.array(z.string()).optional(),
    })).optional(),
    entrypoint: z.string().default('index.js'),
    minGatewayVersion: z.string().optional(),
    maxGatewayVersion: z.string().optional(),
});

export type ValidatedPluginManifest = z.infer<typeof PluginManifestSchema>;

/** Validate a plugin manifest, throwing on error. */
export function validatePluginManifest(raw: unknown): ValidatedPluginManifest {
    return PluginManifestSchema.parse(raw);
}

/** Safe validation for plugin manifests. */
export function safeValidatePluginManifest(raw: unknown): {
    success: boolean;
    data?: ValidatedPluginManifest;
    errors?: string[];
} {
    const result = PluginManifestSchema.safeParse(raw);
    if (result.success) {
        return { success: true, data: result.data };
    }
    return {
        success: false,
        errors: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
    };
}
