/**
 * extensions/public-artifacts.ts
 * Public artifact serving extension.
 * Ported from CoreBlow src/extensions/public-artifacts.ts.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export interface PublicArtifact {
    id: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: number;
    expiresAt?: number;
    metadata?: Record<string, unknown>;
}

export class PublicArtifactStore {
    private artifactsDir: string;
    private registry = new Map<string, PublicArtifact>();

    constructor(artifactsDir: string) {
        this.artifactsDir = artifactsDir;
        fs.mkdirSync(artifactsDir, { recursive: true });
    }

    /**
     * Store a new artifact and return its public ID.
     */
    store(params: {
        filename: string;
        content: Buffer;
        mimeType: string;
        ttlMs?: number;
        metadata?: Record<string, unknown>;
    }): PublicArtifact {
        const id = crypto.randomBytes(16).toString('hex');
        const ext = path.extname(params.filename);
        const storedFilename = `${id}${ext}`;
        const filePath = path.join(this.artifactsDir, storedFilename);

        fs.writeFileSync(filePath, params.content);

        const artifact: PublicArtifact = {
            id,
            filename: params.filename,
            mimeType: params.mimeType,
            sizeBytes: params.content.length,
            createdAt: Date.now(),
            expiresAt: params.ttlMs ? Date.now() + params.ttlMs : undefined,
            metadata: params.metadata,
        };

        this.registry.set(id, artifact);
        return artifact;
    }

    /**
     * Retrieve artifact metadata by ID.
     */
    get(id: string): PublicArtifact | null {
        const artifact = this.registry.get(id);
        if (!artifact) return null;
        if (artifact.expiresAt && artifact.expiresAt < Date.now()) {
            this.delete(id);
            return null;
        }
        return artifact;
    }

    /**
     * Read artifact content.
     */
    readContent(id: string): Buffer | null {
        const artifact = this.get(id);
        if (!artifact) return null;
        const ext = path.extname(artifact.filename);
        const filePath = path.join(this.artifactsDir, `${id}${ext}`);
        try { return fs.readFileSync(filePath); }
        catch { return null; }
    }

    /**
     * Delete an artifact.
     */
    delete(id: string): boolean {
        const artifact = this.registry.get(id);
        if (!artifact) return false;
        const ext = path.extname(artifact.filename);
        try { fs.unlinkSync(path.join(this.artifactsDir, `${id}${ext}`)); } catch { /* ok */ }
        return this.registry.delete(id);
    }

    /**
     * List all artifacts.
     */
    list(): PublicArtifact[] {
        this.pruneExpired();
        return [...this.registry.values()];
    }

    /**
     * Prune expired artifacts.
     */
    pruneExpired(): number {
        const now = Date.now();
        let count = 0;
        for (const [id, artifact] of this.registry) {
            if (artifact.expiresAt && artifact.expiresAt < now) {
                this.delete(id);
                count++;
            }
        }
        return count;
    }

    /**
     * Total storage used.
     */
    totalSizeBytes(): number {
        return [...this.registry.values()].reduce((sum, a) => sum + a.sizeBytes, 0);
    }
}
