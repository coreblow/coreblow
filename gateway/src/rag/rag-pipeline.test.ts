import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RAGPipeline } from './rag-pipeline.js';
import { DocumentLoader, detectFormat } from './document-loader.js';
import * as embeddings from '../memory/embeddings.js';

// Mock embedding provider
vi.mock('../memory/embeddings.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../memory/embeddings.js')>();
    return {
        ...actual,
        createEmbeddingProvider: vi.fn().mockReturnValue({
            name: 'mock',
            embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]), // Dummy 3D embedding
        }),
    };
});

describe('RAG Module', () => {
    let pipeline: RAGPipeline;

    beforeEach(() => {
        vi.clearAllMocks();
        pipeline = new RAGPipeline({
            chunker: { maxChunkSize: 200, overlap: 20 },
        });
    });

    describe('document-loader.ts minimal', () => {
        it('detectFormat correctly identifies extensions', () => {
            expect(detectFormat('file.md')).toBe('markdown');
            expect(detectFormat('file.json')).toBe('json');
            expect(detectFormat('file.ts')).toBe('typescript');
            expect(detectFormat('unknown.xyz')).toBe('unknown');
        });
    });

    describe('rag-pipeline.ts: RAGPipeline', () => {
        it('ingests text directly', async () => {
            const text = 'This is a test document. '.repeat(10);
            const result = await pipeline.ingestText(text, 'inline-test');
            expect(result.chunks).toBeGreaterThan(0);
            
            const docs = pipeline.getDocuments();
            expect(docs.length).toBe(result.chunks);
            expect(docs[0].sourcePath).toBe('inline-test');
            expect(docs[0].embedding).toEqual([0.1, 0.2, 0.3]);
        });

        it('queries empty store gracefully', async () => {
            const result = await pipeline.query('Where is AI?');
            expect(result.documents).toEqual([]);
            expect(result.contextText).toBe('');
            expect(result.queryInfo.totalCandidates).toBe(0);
        });

        it('queries populated store and returns context', async () => {
            await pipeline.ingestText('France is in Europe. Paris is the capital.', 'geo.txt');
            await pipeline.ingestText('Python is a programming language.', 'tech.txt');

            const result = await pipeline.query('capital of france', 2);
            expect(result.documents.length).toBeGreaterThan(0);
            expect(result.contextText).toContain('France is in Europe');
            expect(result.queryInfo.returnedResults).toBe(result.documents.length);
        });

        it('clears store correctly', async () => {
            await pipeline.ingestText('Sample', 'test.txt');
            expect(pipeline.stats().totalChunks).toBeGreaterThan(0);
            
            pipeline.clear();
            expect(pipeline.stats().totalChunks).toBe(0);
            expect(pipeline.getDocuments()).toEqual([]);
        });

        it('removes specific source', async () => {
            await pipeline.ingestText('A', 'src-A');
            await pipeline.ingestText('B', 'src-B');
            
            const removed = pipeline.removeSource('src-A');
            expect(removed).toBeGreaterThan(0);
            
            const remaining = pipeline.getDocuments();
            expect(remaining.every(d => d.sourcePath !== 'src-A')).toBe(true);
            expect(remaining.some(d => d.sourcePath === 'src-B')).toBe(true);
        });
    });
});
