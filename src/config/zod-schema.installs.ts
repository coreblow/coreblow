import { z } from "zod";

export const InstallSourceSchema = z.union([
  z.literal("npm"),
  z.literal("archive"),
  z.literal("path"),
  z.literal("corehub"),
]);

export const PluginInstallSourceSchema = z.union([InstallSourceSchema, z.literal("marketplace")]);

export const InstallRecordShape = {
  source: InstallSourceSchema,
  spec: z.string().optional(),
  sourcePath: z.string().optional(),
  installPath: z.string().optional(),
  version: z.string().optional(),
  resolvedName: z.string().optional(),
  resolvedVersion: z.string().optional(),
  resolvedSpec: z.string().optional(),
  integrity: z.string().optional(),
  shasum: z.string().optional(),
  resolvedAt: z.string().optional(),
  installedAt: z.string().optional(),
  corehubUrl: z.string().optional(),
  corehubPackage: z.string().optional(),
  corehubFamily: z.union([z.literal("code-plugin"), z.literal("bundle-plugin")]).optional(),
  corehubChannel: z
    .union([z.literal("official"), z.literal("community"), z.literal("private")])
    .optional(),
  corehubVerificationTier: z.string().optional(),
  artifactSha256: z.string().optional(),
  artifactSize: z.number().optional(),
  artifactManifestVerified: z.boolean().optional(),
  artifactManifestSha256: z.string().optional(),
  artifactStorageKey: z.string().optional(),
  publisherHandle: z.string().optional(),
  verifiedAt: z.string().optional(),
  previousVersion: z.string().optional(),
  previousArtifactSha256: z.string().optional(),
  previousArtifactManifestSha256: z.string().optional(),
  previousArtifactStorageKey: z.string().optional(),
  previousVerifiedAt: z.string().optional(),
  updatedAt: z.string().optional(),
} as const;

export const PluginInstallRecordShape = {
  ...InstallRecordShape,
  source: PluginInstallSourceSchema,
  marketplaceName: z.string().optional(),
  marketplaceSource: z.string().optional(),
  marketplacePlugin: z.string().optional(),
} as const;
