import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PublicArtifactStore } from './public-artifacts.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('Public Artifact Store', () => {
    let tmpDir: string;
    let store: PublicArtifactStore;

    beforeEach(() => {
        vi.useRealTimers();
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'artifacts-test-'));
        store = new PublicArtifactStore(tmpDir);
    });

    afterEach(() => {
        vi.useRealTimers();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('stores and retrieves artifact', () => {
        const artifact = store.store({ filename: 'test.txt', content: Buffer.from('hello'), mimeType: 'text/plain' });
        expect(artifact.id).toBeTruthy();
        expect(artifact.sizeBytes).toBe(5);

        const retrieved = store.get(artifact.id);
        expect(retrieved).not.toBeNull();
        expect(retrieved!.filename).toBe('test.txt');
    });

    it('reads content', () => {
        const artifact = store.store({ filename: 'data.json', content: Buffer.from('{"key":"val"}'), mimeType: 'application/json' });
        const content = store.readContent(artifact.id);
        expect(content!.toString()).toBe('{"key":"val"}');
    });

    it('deletes artifact', () => {
        const artifact = store.store({ filename: 'del.txt', content: Buffer.from('x'), mimeType: 'text/plain' });
        expect(store.delete(artifact.id)).toBe(true);
        expect(store.get(artifact.id)).toBeNull();
    });

    it('lists artifacts', () => {
        store.store({ filename: 'a.txt', content: Buffer.from('a'), mimeType: 'text/plain' });
        store.store({ filename: 'b.txt', content: Buffer.from('b'), mimeType: 'text/plain' });
        expect(store.list()).toHaveLength(2);
    });

    it('prunes expired', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-11-27T00:00:00.000Z'));
        store.store({ filename: 'exp.txt', content: Buffer.from('x'), mimeType: 'text/plain', ttlMs: 50 });
        vi.advanceTimersByTime(100);
        expect(store.pruneExpired()).toBe(1);
        expect(store.list()).toHaveLength(0);
    });

    it('calculates total size', () => {
        store.store({ filename: 'a.txt', content: Buffer.from('hello'), mimeType: 'text/plain' });
        store.store({ filename: 'b.txt', content: Buffer.from('world!'), mimeType: 'text/plain' });
        expect(store.totalSizeBytes()).toBe(11);
    });

    it('returns null for unknown ID', () => {
        expect(store.get('nonexistent')).toBeNull();
        expect(store.readContent('nonexistent')).toBeNull();
    });
});
