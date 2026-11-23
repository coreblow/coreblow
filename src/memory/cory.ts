/**
 * CoreBlow — Cory Built-in Memory System (Hybrid OOP + DOP Architecture)
 *
 * Implements the complete specification from `docs/CORY_MEMORY_PRD.md`:
 *  1. `CoryBootstrapService` (OOP GatewayService: zero-config offline-first initialization)
 *  2. `CoryMemoryStore`      (OOP file/mutex handle + DOP 4-layer canonical Markdown records)
 *  3. `CorySessionStore`     (OOP session transcript & daily summary store)
 *  4. `CorySearchIndex`      (OOP disposable SQLite WAL + inverted/FTS lexical index + DOP BM25)
 *  5. `CoryRetriever`        (DOP scope-aware bounded recall with lexical fallback & fault isolation)
 *  6. `CoryContextAssembler` (DOP prompt-stable startup snapshot + episodic/recent context assembly)
 *  7. `CorySummaryService`   (DOP session summary generator preserving Decisions & Active Constraints)
 *
 * Architectural Guarantees:
 *  - Zero network calls, zero API keys, zero Docker, and zero CoreHub dependency required.
 *  - Strict workspace & user scope isolation (workspace A never leaks into workspace B).
 *  - Public/group channel ingress (Zone 0) cannot silently mutate private Identity or Durable memory.
 *  - Prompt cache stability: mid-session writes persist immediately to disk but only enter the
 *    default startup snapshot on a subsequent session.
 *  - Best-effort degradation: search or optional embedding failure never crashes the gateway.
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { GatewayService, ServiceHealth } from '../gateway/service-registry.js';
import { logCaughtError } from '../utils/error-boundary.js';
import { tokenize } from './bm25.js';
import { cosineSimilarity, type EmbeddingProvider } from './embeddings.js';
import { CANONICAL_ROOT_MEMORY_FILENAME } from './root-memory-files.js';
import { TranscriptStore, type TranscriptEntry } from './transcript-store.js';

// ─── DOP Immutable Data Structures & Types ──────────────────────

export type CoryMemoryLayer = 'identity' | 'durable' | 'episodic' | 'constraint';

export type CuratedMemoryFileId = 'user' | 'memory' | 'constraints';

export interface CuratedMemoryFile {
    readonly id: CuratedMemoryFileId;
    readonly filename: string;
    readonly path: string;
    readonly content: string;
    readonly charCount: number;
    readonly charLimit: number;
    readonly updatedAt: string;
}

export type CoryTrustZone = 'operator' | 'authenticated' | 'public';

export interface CoryScope {
    /** User identity scope (default: "default") */
    readonly userScope?: string;
    /** Workspace isolation identifier (default: "default") */
    readonly workspaceId?: string;
    /** Optional absolute path to workspace root for canonical MEMORY.md mirror */
    readonly workspaceDir?: string;
    /** Ingress trust zone (Zone 0 = "public", Zone 1 = "authenticated", Zone 2 = "operator") */
    readonly trustZone?: CoryTrustZone;
    /** Explicit flag indicating group or public channel origin */
    readonly isPublicChannel?: boolean;
}

export interface CoryMemoryItem {
    readonly id: string;
    readonly layer: CoryMemoryLayer;
    readonly content: string;
    readonly userScope: string;
    readonly workspaceId: string;
    readonly createdAt: number;
    readonly updatedAt: number;
    readonly source?: string;
    readonly artifactRef?: string;
    readonly tags: readonly string[];
    readonly immutableConstraint?: boolean;
}

export interface CorySessionSummaryRecord {
    readonly sessionId: string;
    readonly dateKey: string;
    readonly userScope: string;
    readonly workspaceId: string;
    readonly overview: string;
    readonly decisions: readonly string[];
    readonly activeConstraints: readonly string[];
    readonly createdAt: number;
}

export interface CorySearchHit {
    readonly item: CoryMemoryItem;
    readonly score: number;
    readonly lexicalScore: number;
    readonly semanticScore?: number;
}

export interface CoryStartupSnapshot {
    readonly sessionId: string;
    readonly capturedAt: number;
    readonly userScope: string;
    readonly workspaceId: string;
    readonly identityItems: readonly CoryMemoryItem[];
    readonly durableItems: readonly CoryMemoryItem[];
    readonly activeConstraints: readonly CoryMemoryItem[];
    readonly formattedSnapshot: string;
}

export interface CoryAssembledContext {
    readonly sessionId: string;
    readonly startupSnapshot: CoryStartupSnapshot;
    readonly retrievedEpisodic: readonly CorySearchHit[];
    readonly retrievedConstraints: readonly CorySearchHit[];
    readonly recentTranscript: readonly TranscriptEntry[];
    readonly contextText: string;
    readonly degradedSearch: boolean;
    readonly ragUsed: boolean;
}

export interface CoryConfig {
    /** Root state directory for Cory (default: ~/.coreblow/memory) */
    readonly stateDir?: string;
    /** Maximum characters for bounded startup snapshot (default: 4000) */
    readonly maxStartupSnapshotChars?: number;
    /** Maximum items recalled per query (default: 8) */
    readonly defaultTopK?: number;
    /** Optional local/configured embedding provider for best-effort semantic ranking */
    readonly embeddingProvider?: EmbeddingProvider | null;
}

// ─── DOP Pure Helper Functions ──────────────────────────────────

export function normalizeScopeId(raw: string | undefined, fallback = 'default'): string {
    const trimmed = (raw ?? '').trim();
    if (!trimmed) return fallback;
    return trimmed.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function resolveHomeStateDir(customDir?: string): string {
    if (customDir && customDir.trim()) {
        const raw = customDir.trim();
        if (raw.startsWith('~/')) {
            return path.join(os.homedir(), raw.slice(2));
        }
        return path.resolve(raw);
    }
    return path.join(os.homedir(), '.coreblow', 'memory');
}

export function isTrustedForDurablePromotion(scope?: CoryScope): boolean {
    if (!scope) return true;
    if (scope.isPublicChannel === true) return false;
    if (scope.trustZone === 'public') return false;
    return true;
}

export function computeDeterministicId(layer: CoryMemoryLayer, scopeKey: string, content: string): string {
    const normalized = content.trim().toLowerCase().replace(/\s+/g, ' ');
    return crypto
        .createHash('sha256')
        .update(`${layer}:${scopeKey}:${normalized}`)
        .digest('hex')
        .slice(0, 16);
}

/**
 * Pure DOP serializer: converts structured memory items into human-readable canonical Markdown.
 */
export function serializeMarkdownMemoryFile(params: {
    title: string;
    description: string;
    items: readonly CoryMemoryItem[];
}): string {
    const lines: string[] = [
        `# ${params.title}`,
        '',
        `> ${params.description}`,
        '',
    ];

    if (params.items.length === 0) {
        lines.push('_No entries recorded._', '');
        return lines.join('\n');
    }

    for (const item of params.items) {
        const metaParts = [`id:${item.id}`, `updated:${new Date(item.updatedAt).toISOString().slice(0, 10)}`];
        if (item.source) metaParts.push(`source:${item.source}`);
        if (item.artifactRef) metaParts.push(`ref:${item.artifactRef}`);
        if (item.tags.length > 0) metaParts.push(`tags:${item.tags.join(',')}`);
        lines.push(`- ${item.content} <!-- cory:${metaParts.join(' ')} -->`);
    }
    lines.push('');
    return lines.join('\n');
}

/**
 * Pure DOP parser: reconstructs structured CoryMemoryItems from canonical human-readable Markdown.
 * Supports both Cory metadata comments and plain human-edited Markdown bullets!
 */
export function parseMarkdownMemoryFile(params: {
    markdown: string;
    layer: CoryMemoryLayer;
    userScope: string;
    workspaceId: string;
}): CoryMemoryItem[] {
    const items: CoryMemoryItem[] = [];
    const lines = params.markdown.split(/\r?\n/);
    const now = Date.now();

    for (const rawLine of lines) {
        const trimmed = rawLine.trim();
        if (!trimmed.startsWith('- ') && !trimmed.startsWith('* ')) continue;

        let body = trimmed.slice(2).trim();
        let id = '';
        let updatedAt = now;
        let source: string | undefined;
        let artifactRef: string | undefined;
        let tags: string[] = [];

        const commentMatch = body.match(/^(.*?)\s*<!--\s*cory:([^>]+?)\s*-->$/);
        if (commentMatch) {
            body = commentMatch[1]!.trim();
            const metaRaw = commentMatch[2]!.trim();
            for (const token of metaRaw.split(/\s+/)) {
                const [k, v] = token.split(':', 2);
                if (!k || !v) continue;
                if (k === 'id') id = v;
                else if (k === 'updated') {
                    const parsed = Date.parse(v);
                    if (!Number.isNaN(parsed)) updatedAt = parsed;
                } else if (k === 'source') source = v;
                else if (k === 'ref') artifactRef = v;
                else if (k === 'tags') tags = v.split(',').filter(Boolean);
            }
        }

        if (!body) continue;
        const scopeKey = params.layer === 'identity' ? params.userScope : params.workspaceId;
        const finalId = id || computeDeterministicId(params.layer, scopeKey, body);

        items.push({
            id: finalId,
            layer: params.layer,
            content: body,
            userScope: params.userScope,
            workspaceId: params.workspaceId,
            createdAt: updatedAt,
            updatedAt,
            source,
            artifactRef,
            tags,
            immutableConstraint: params.layer === 'constraint',
        });
    }

    return items;
}

// ─── 1. CorySearchIndex (OOP Disposable SQLite WAL + DOP BM25) ──

export class CorySearchIndex {
    private db: DatabaseSync | null = null;
    private readonly dbPath: string;
    private fts5Available = false;

    constructor(stateDir: string) {
        const indexDir = path.join(stateDir, 'index');
        if (!fs.existsSync(indexDir)) {
            fs.mkdirSync(indexDir, { recursive: true });
        }
        this.dbPath = path.join(indexDir, 'cory-search.sqlite');
        this.openAndInitialize();
    }

    public getDatabasePath(): string {
        return this.dbPath;
    }

    private openAndInitialize(): void {
        try {
            this.db = new DatabaseSync(this.dbPath);
            this.db.exec('PRAGMA journal_mode = WAL;');
            this.db.exec('PRAGMA synchronous = NORMAL;');
            this.db.exec('PRAGMA busy_timeout = 5000;');

            this.db.exec(`
                CREATE TABLE IF NOT EXISTS cory_documents (
                    id TEXT PRIMARY KEY,
                    layer TEXT NOT NULL,
                    content TEXT NOT NULL,
                    user_scope TEXT NOT NULL,
                    workspace_id TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL,
                    source TEXT,
                    artifact_ref TEXT,
                    tags_json TEXT NOT NULL,
                    doc_length INTEGER NOT NULL
                );
                CREATE TABLE IF NOT EXISTS cory_postings (
                    term TEXT NOT NULL,
                    doc_id TEXT NOT NULL,
                    tf INTEGER NOT NULL,
                    PRIMARY KEY (term, doc_id)
                );
                CREATE INDEX IF NOT EXISTS idx_cory_postings_term ON cory_postings(term);
                CREATE INDEX IF NOT EXISTS idx_cory_docs_scope ON cory_documents(user_scope, workspace_id, layer);
            `);

            // Attempt optional FTS5 virtual table if host SQLite compiled with ENABLE_FTS5
            try {
                this.db.exec(`
                    CREATE VIRTUAL TABLE IF NOT EXISTS cory_fts USING fts5(
                        doc_id UNINDEXED,
                        content
                    );
                `);
                this.fts5Available = true;
            } catch {
                this.fts5Available = false;
            }
        } catch (err) {
            logCaughtError('cory-search-index:init', err);
            this.db = null;
        }
    }

    /**
     * Index or update a CoryMemoryItem in the disposable SQLite index.
     */
    public upsertItem(item: CoryMemoryItem): void {
        if (!this.db) return;
        try {
            const terms = tokenize(item.content);
            const tfMap = new Map<string, number>();
            for (const term of terms) {
                tfMap.set(term, (tfMap.get(term) ?? 0) + 1);
            }

            this.db.prepare(`
                INSERT INTO cory_documents (
                    id, layer, content, user_scope, workspace_id,
                    created_at, updated_at, source, artifact_ref, tags_json, doc_length
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    layer = excluded.layer,
                    content = excluded.content,
                    user_scope = excluded.user_scope,
                    workspace_id = excluded.workspace_id,
                    updated_at = excluded.updated_at,
                    source = excluded.source,
                    artifact_ref = excluded.artifact_ref,
                    tags_json = excluded.tags_json,
                    doc_length = excluded.doc_length
            `).run(
                item.id,
                item.layer,
                item.content,
                item.userScope,
                item.workspaceId,
                item.createdAt,
                item.updatedAt,
                item.source ?? null,
                item.artifactRef ?? null,
                JSON.stringify(item.tags),
                terms.length,
            );

            this.db.prepare('DELETE FROM cory_postings WHERE doc_id = ?').run(item.id);
            const insertPosting = this.db.prepare(
                'INSERT INTO cory_postings (term, doc_id, tf) VALUES (?, ?, ?)',
            );
            for (const [term, tf] of tfMap.entries()) {
                insertPosting.run(term, item.id, tf);
            }

            if (this.fts5Available) {
                this.db.prepare('DELETE FROM cory_fts WHERE doc_id = ?').run(item.id);
                this.db.prepare('INSERT INTO cory_fts (doc_id, content) VALUES (?, ?)').run(
                    item.id,
                    item.content,
                );
            }
        } catch (err) {
            logCaughtError('cory-search-index:upsert', err);
        }
    }

    public removeItem(id: string): void {
        if (!this.db) return;
        try {
            this.db.prepare('DELETE FROM cory_documents WHERE id = ?').run(id);
            this.db.prepare('DELETE FROM cory_postings WHERE doc_id = ?').run(id);
            if (this.fts5Available) {
                this.db.prepare('DELETE FROM cory_fts WHERE doc_id = ?').run(id);
            }
        } catch (err) {
            logCaughtError('cory-search-index:remove', err);
        }
    }

    /**
     * Rebuild the disposable SQLite index from canonical memory items.
     */
    public rebuildFromCanonical(items: readonly CoryMemoryItem[]): void {
        try {
            this.close();
            if (fs.existsSync(this.dbPath)) {
                fs.rmSync(this.dbPath, { force: true });
            }
        } catch {
            // ignore cleanup errors
        }
        this.openAndInitialize();
        for (const item of items) {
            this.upsertItem(item);
        }
    }

    /**
     * Execute scope-aware BM25 lexical search over the SQLite index.
     */
    public searchLexical(params: {
        query: string;
        userScope: string;
        workspaceId: string;
        layers?: readonly CoryMemoryLayer[];
        topK?: number;
    }): Array<{ item: CoryMemoryItem; score: number }> {
        if (!this.db) {
            throw new Error('CORY_INDEX_UNAVAILABLE');
        }

        const queryTerms = tokenize(params.query);
        const topK = params.topK ?? 8;

        // Fetch candidate documents matching scope
        const rows = this.db.prepare(`
            SELECT * FROM cory_documents
            WHERE (
                (layer = 'identity' AND user_scope = ?)
                OR (layer != 'identity' AND workspace_id = ?)
            )
        `).all(params.userScope, params.workspaceId) as Array<Record<string, unknown>>;

        const filteredRows = params.layers && params.layers.length > 0
            ? rows.filter((r) => params.layers!.includes(String(r.layer) as CoryMemoryLayer))
            : rows;

        if (filteredRows.length === 0) return [];

        // If query has no tokens, return most recent matching items
        if (queryTerms.length === 0) {
            return filteredRows
                .map((row) => ({ item: this.rowToItem(row), score: 0.1 }))
                .sort((a, b) => b.item.updatedAt - a.item.updatedAt)
                .slice(0, topK);
        }

        const N = filteredRows.length;
        const avgDocLen =
            filteredRows.reduce((acc, r) => acc + Number(r.doc_length || 1), 0) / Math.max(1, N);
        const k1 = 1.2;
        const b = 0.75;

        const docIdSet = new Set(filteredRows.map((r) => String(r.id)));
        const dfMap = new Map<string, number>();
        const docTermTf = new Map<string, Map<string, number>>();

        const placeholders = queryTerms.map(() => '?').join(', ');
        const postingRows = this.db
            .prepare(`SELECT term, doc_id, tf FROM cory_postings WHERE term IN (${placeholders})`)
            .all(...queryTerms) as Array<{ term: string; doc_id: string; tf: number }>;

        for (const p of postingRows) {
            if (!docIdSet.has(p.doc_id)) continue;
            dfMap.set(p.term, (dfMap.get(p.term) ?? 0) + 1);
            if (!docTermTf.has(p.doc_id)) {
                docTermTf.set(p.doc_id, new Map());
            }
            docTermTf.get(p.doc_id)!.set(p.term, Number(p.tf));
        }

        const scored: Array<{ item: CoryMemoryItem; score: number }> = [];
        for (const row of filteredRows) {
            const docId = String(row.id);
            const tfMap = docTermTf.get(docId);
            const docLen = Number(row.doc_length || 1);
            let score = 0;

            if (tfMap) {
                for (const qt of queryTerms) {
                    const tf = tfMap.get(qt) ?? 0;
                    if (tf === 0) continue;
                    const df = dfMap.get(qt) ?? 0;
                    const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);
                    const num = tf * (k1 + 1);
                    const den = tf + k1 * (1 - b + b * (docLen / avgDocLen));
                    score += idf * (num / den);
                }
            }

            // Fallback substring check for exact symbols/identifiers
            if (score === 0 && String(row.content).toLowerCase().includes(params.query.toLowerCase().trim())) {
                score = 0.25;
            }

            if (score > 0) {
                const item = this.rowToItem(row);
                // Prioritize Active Constraints during relevant retrieval (PRD 6 & 7.3)
                const constraintBoost = item.layer === 'constraint' ? 1.35 : 1.0;
                scored.push({ item, score: score * constraintBoost });
            }
        }

        return scored.sort((a, b) => b.score - a.score).slice(0, topK);
    }

    public stats(): { documents: number; dbPath: string; fts5Available: boolean } {
        if (!this.db) {
            return { documents: 0, dbPath: this.dbPath, fts5Available: false };
        }
        try {
            const row = this.db.prepare('SELECT COUNT(*) as cnt FROM cory_documents').get() as {
                cnt: number;
            };
            return {
                documents: Number(row?.cnt ?? 0),
                dbPath: this.dbPath,
                fts5Available: this.fts5Available,
            };
        } catch {
            return { documents: 0, dbPath: this.dbPath, fts5Available: this.fts5Available };
        }
    }

    public close(): void {
        if (this.db) {
            try {
                this.db.close();
            } catch {
                // ignore
            }
            this.db = null;
        }
    }

    private rowToItem(row: Record<string, unknown>): CoryMemoryItem {
        let tags: string[] = [];
        try {
            tags = JSON.parse(String(row.tags_json || '[]'));
        } catch {
            tags = [];
        }
        const layer = String(row.layer) as CoryMemoryLayer;
        return {
            id: String(row.id),
            layer,
            content: String(row.content),
            userScope: String(row.user_scope),
            workspaceId: String(row.workspace_id),
            createdAt: Number(row.created_at),
            updatedAt: Number(row.updated_at),
            source: row.source ? String(row.source) : undefined,
            artifactRef: row.artifact_ref ? String(row.artifact_ref) : undefined,
            tags,
            immutableConstraint: layer === 'constraint',
        };
    }
}

// ─── 2. CoryMemoryStore (OOP Canonical Markdown Store) ──────────

export class CoryMemoryStore {
    private readonly stateDir: string;
    private readonly searchIndex: CorySearchIndex;
    private paused = false;

    constructor(stateDir: string, searchIndex: CorySearchIndex) {
        this.stateDir = stateDir;
        this.searchIndex = searchIndex;
        this.ensureDirectories();
    }

    private ensureDirectories(): void {
        for (const sub of ['users', 'workspaces']) {
            const dir = path.join(this.stateDir, sub);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        }
    }

    public isPaused(): boolean {
        return this.paused;
    }

    public setPaused(paused: boolean): void {
        this.paused = paused;
    }

    public getIdentityFilePath(userScope = 'default'): string {
        const safeUser = normalizeScopeId(userScope, 'default');
        const userDir = path.join(this.stateDir, 'users', safeUser);
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }
        return path.join(userDir, 'USER.md');
    }

    public getWorkspaceDir(workspaceId = 'default'): string {
        const safeWs = normalizeScopeId(workspaceId, 'default');
        const wsDir = path.join(this.stateDir, 'workspaces', safeWs);
        if (!fs.existsSync(wsDir)) {
            fs.mkdirSync(wsDir, { recursive: true });
        }
        return wsDir;
    }

    public getDurableFilePath(workspaceId = 'default', workspaceDir?: string): string {
        if (workspaceDir && fs.existsSync(workspaceDir)) {
            return path.join(workspaceDir, CANONICAL_ROOT_MEMORY_FILENAME);
        }
        return path.join(this.getWorkspaceDir(workspaceId), CANONICAL_ROOT_MEMORY_FILENAME);
    }

    public getConstraintsFilePath(workspaceId = 'default'): string {
        return path.join(this.getWorkspaceDir(workspaceId), 'CONSTRAINTS.md');
    }

    public getDailyEpisodicFilePath(workspaceId = 'default', dateKey?: string): string {
        const day = dateKey ?? new Date().toISOString().slice(0, 10);
        const dailyDir = path.join(this.getWorkspaceDir(workspaceId), 'daily');
        if (!fs.existsSync(dailyDir)) {
            fs.mkdirSync(dailyDir, { recursive: true });
        }
        return path.join(dailyDir, `${day}.md`);
    }

    public getCuratedMemoryFilePath(fileId: CuratedMemoryFileId, scope?: CoryScope): string {
        switch (fileId) {
            case 'user':
                return this.getIdentityFilePath(scope?.userScope);
            case 'memory':
                return this.getDurableFilePath(scope?.workspaceId, scope?.workspaceDir);
            case 'constraints':
                return this.getConstraintsFilePath(scope?.workspaceId);
            default:
                throw new Error(`Invalid curated memory fileId: ${String(fileId)}`);
        }
    }

    public getDefaultCuratedMemoryContent(fileId: CuratedMemoryFileId, scope?: CoryScope): string {
        const userScope = normalizeScopeId(scope?.userScope, 'default');
        const workspaceId = normalizeScopeId(scope?.workspaceId, 'default');

        switch (fileId) {
            case 'user':
                return serializeMarkdownMemoryFile({
                    title: `User Identity Memory (${userScope})`,
                    description: 'Stable user preferences and communication style managed by Cory.',
                    items: [],
                });
            case 'memory':
                return serializeMarkdownMemoryFile({
                    title: `Workspace Durable Memory (${workspaceId})`,
                    description: 'Durable project decisions, conventions, and verified facts.',
                    items: [],
                });
            case 'constraints':
                return serializeMarkdownMemoryFile({
                    title: `Active Constraints (${workspaceId})`,
                    description: 'Active constraints and failure boundaries that must be preserved.',
                    items: [],
                });
            default:
                throw new Error(`Invalid curated memory fileId: ${String(fileId)}`);
        }
    }

    /**
     * Ensure default canonical USER.md and MEMORY.md exist on first start.
     */
    public ensureCanonicalDefaults(scope?: CoryScope): void {
        const userScope = normalizeScopeId(scope?.userScope, 'default');
        const workspaceId = normalizeScopeId(scope?.workspaceId, 'default');

        const userFile = this.getIdentityFilePath(userScope);
        if (!fs.existsSync(userFile)) {
            fs.writeFileSync(
                userFile,
                serializeMarkdownMemoryFile({
                    title: `User Identity Memory (${userScope})`,
                    description: 'Stable user preferences and communication style managed by Cory.',
                    items: [],
                }),
                'utf-8',
            );
        }

        const durableFile = this.getDurableFilePath(workspaceId, scope?.workspaceDir);
        if (!fs.existsSync(durableFile)) {
            fs.writeFileSync(
                durableFile,
                serializeMarkdownMemoryFile({
                    title: `Workspace Durable Memory (${workspaceId})`,
                    description: 'Durable project decisions, conventions, and verified facts.',
                    items: [],
                }),
                'utf-8',
            );
        }

        const constraintsFile = this.getConstraintsFilePath(workspaceId);
        if (!fs.existsSync(constraintsFile)) {
            fs.writeFileSync(
                constraintsFile,
                serializeMarkdownMemoryFile({
                    title: `Active Constraints (${workspaceId})`,
                    description: 'Active constraints and failure boundaries that must be preserved.',
                    items: [],
                }),
                'utf-8',
            );
        }
    }

    /**
     * Remember an item across one of the 4 Cory layers.
     * Enforces PRD 7.4 & 7.5 privacy/trust zone rules.
     */
    public remember(params: {
        layer: CoryMemoryLayer;
        content: string;
        scope?: CoryScope;
        source?: string;
        artifactRef?: string;
        tags?: readonly string[];
    }): CoryMemoryItem | null {
        if (this.paused) return null;
        const trimmed = params.content.trim();
        if (!trimmed) return null;

        // PRD 7.4 & 7.5: Public/group channels MUST NOT update private identity or durable workspace memory
        if (
            (params.layer === 'identity' || params.layer === 'durable' || params.layer === 'constraint') &&
            !isTrustedForDurablePromotion(params.scope)
        ) {
            return null;
        }

        const userScope = normalizeScopeId(params.scope?.userScope, 'default');
        const workspaceId = normalizeScopeId(params.scope?.workspaceId, 'default');
        const scopeKey = params.layer === 'identity' ? userScope : workspaceId;
        const id = computeDeterministicId(params.layer, scopeKey, trimmed);
        const now = Date.now();

        const newItem: CoryMemoryItem = {
            id,
            layer: params.layer,
            content: trimmed,
            userScope,
            workspaceId,
            createdAt: now,
            updatedAt: now,
            source: params.source,
            artifactRef: params.artifactRef,
            tags: params.tags ?? [],
            immutableConstraint: params.layer === 'constraint',
        };

        const existing = this.listLayerItems(params.layer, params.scope);
        const updated = existing.filter((i) => i.id !== id && i.content.toLowerCase() !== trimmed.toLowerCase());
        updated.push(newItem);

        this.writeLayerItems(params.layer, updated, params.scope);
        this.searchIndex.upsertItem(newItem);
        return newItem;
    }

    /**
     * Forget/delete a memory item by ID or substring match.
     */
    public forget(params: {
        idOrQuery: string;
        layer?: CoryMemoryLayer;
        scope?: CoryScope;
    }): number {
        const layers: CoryMemoryLayer[] = params.layer
            ? [params.layer]
            : ['identity', 'durable', 'constraint', 'episodic'];
        const needle = params.idOrQuery.trim().toLowerCase();
        if (!needle) return 0;

        let removedCount = 0;
        for (const layer of layers) {
            const items = this.listLayerItems(layer, params.scope);
            const kept: CoryMemoryItem[] = [];
            for (const item of items) {
                if (item.id === params.idOrQuery.trim() || item.content.toLowerCase().includes(needle)) {
                    removedCount++;
                    this.searchIndex.removeItem(item.id);
                } else {
                    kept.push(item);
                }
            }
            if (kept.length !== items.length) {
                this.writeLayerItems(layer, kept, params.scope);
            }
        }
        return removedCount;
    }

    /**
     * Read all items for a specific layer directly from the canonical Markdown files.
     */
    public listLayerItems(layer: CoryMemoryLayer, scope?: CoryScope): CoryMemoryItem[] {
        const userScope = normalizeScopeId(scope?.userScope, 'default');
        const workspaceId = normalizeScopeId(scope?.workspaceId, 'default');

        if (layer === 'identity') {
            const filePath = this.getIdentityFilePath(userScope);
            if (!fs.existsSync(filePath)) return [];
            return parseMarkdownMemoryFile({
                markdown: fs.readFileSync(filePath, 'utf-8'),
                layer: 'identity',
                userScope,
                workspaceId,
            });
        }

        if (layer === 'durable') {
            const filePath = this.getDurableFilePath(workspaceId, scope?.workspaceDir);
            if (!fs.existsSync(filePath)) return [];
            return parseMarkdownMemoryFile({
                markdown: fs.readFileSync(filePath, 'utf-8'),
                layer: 'durable',
                userScope,
                workspaceId,
            });
        }

        if (layer === 'constraint') {
            const filePath = this.getConstraintsFilePath(workspaceId);
            if (!fs.existsSync(filePath)) return [];
            return parseMarkdownMemoryFile({
                markdown: fs.readFileSync(filePath, 'utf-8'),
                layer: 'constraint',
                userScope,
                workspaceId,
            });
        }

        // Episodic: read all daily markdown files in workspace
        const dailyDir = path.join(this.getWorkspaceDir(workspaceId), 'daily');
        if (!fs.existsSync(dailyDir)) return [];
        const files = fs.readdirSync(dailyDir).filter((f) => f.endsWith('.md')).sort();
        const episodicItems: CoryMemoryItem[] = [];
        for (const f of files) {
            const fullPath = path.join(dailyDir, f);
            const parsed = parseMarkdownMemoryFile({
                markdown: fs.readFileSync(fullPath, 'utf-8'),
                layer: 'episodic',
                userScope,
                workspaceId,
            });
            episodicItems.push(...parsed);
        }
        return episodicItems;
    }

    /**
     * Collect all canonical items across all users and workspaces to rebuild the disposable index.
     */
    public loadAllCanonicalItems(): CoryMemoryItem[] {
        const all: CoryMemoryItem[] = [];
        const usersDir = path.join(this.stateDir, 'users');
        if (fs.existsSync(usersDir)) {
            for (const userScope of fs.readdirSync(usersDir)) {
                all.push(...this.listLayerItems('identity', { userScope }));
            }
        }
        const workspacesDir = path.join(this.stateDir, 'workspaces');
        if (fs.existsSync(workspacesDir)) {
            for (const workspaceId of fs.readdirSync(workspacesDir)) {
                all.push(...this.listLayerItems('durable', { workspaceId }));
                all.push(...this.listLayerItems('constraint', { workspaceId }));
                all.push(...this.listLayerItems('episodic', { workspaceId }));
            }
        }
        return all;
    }

    /**
     * Clear memory for a given scope (or all scopes).
     */
    public clearScope(scope?: CoryScope, layers?: readonly CoryMemoryLayer[]): void {
        const targetLayers: readonly CoryMemoryLayer[] = layers ?? [
            'identity',
            'durable',
            'constraint',
            'episodic',
        ];
        for (const layer of targetLayers) {
            const existing = this.listLayerItems(layer, scope);
            for (const item of existing) {
                this.searchIndex.removeItem(item.id);
            }
            this.writeLayerItems(layer, [], scope);
        }
    }

    /**
     * Export canonical memory for user inspection or backup.
     */
    public exportScope(scope?: CoryScope): {
        userScope: string;
        workspaceId: string;
        identity: CoryMemoryItem[];
        durable: CoryMemoryItem[];
        constraints: CoryMemoryItem[];
        episodic: CoryMemoryItem[];
    } {
        const userScope = normalizeScopeId(scope?.userScope, 'default');
        const workspaceId = normalizeScopeId(scope?.workspaceId, 'default');
        return {
            userScope,
            workspaceId,
            identity: this.listLayerItems('identity', scope),
            durable: this.listLayerItems('durable', scope),
            constraints: this.listLayerItems('constraint', scope),
            episodic: this.listLayerItems('episodic', scope),
        };
    }

    private writeLayerItems(
        layer: CoryMemoryLayer,
        items: readonly CoryMemoryItem[],
        scope?: CoryScope,
    ): void {
        const userScope = normalizeScopeId(scope?.userScope, 'default');
        const workspaceId = normalizeScopeId(scope?.workspaceId, 'default');

        if (layer === 'identity') {
            const filePath = this.getIdentityFilePath(userScope);
            fs.writeFileSync(
                filePath,
                serializeMarkdownMemoryFile({
                    title: `User Identity Memory (${userScope})`,
                    description: 'Stable user preferences and communication style managed by Cory.',
                    items,
                }),
                'utf-8',
            );
            return;
        }

        if (layer === 'durable') {
            const filePath = this.getDurableFilePath(workspaceId, scope?.workspaceDir);
            fs.writeFileSync(
                filePath,
                serializeMarkdownMemoryFile({
                    title: `Workspace Durable Memory (${workspaceId})`,
                    description: 'Durable project decisions, conventions, and verified facts.',
                    items,
                }),
                'utf-8',
            );
            // Also keep internal workspace copy synced if workspaceDir was provided
            if (scope?.workspaceDir) {
                const internalPath = this.getDurableFilePath(workspaceId);
                if (internalPath !== filePath) {
                    fs.writeFileSync(
                        internalPath,
                        serializeMarkdownMemoryFile({
                            title: `Workspace Durable Memory (${workspaceId})`,
                            description: 'Durable project decisions, conventions, and verified facts.',
                            items,
                        }),
                        'utf-8',
                    );
                }
            }
            return;
        }

        if (layer === 'constraint') {
            const filePath = this.getConstraintsFilePath(workspaceId);
            fs.writeFileSync(
                filePath,
                serializeMarkdownMemoryFile({
                    title: `Active Constraints (${workspaceId})`,
                    description: 'Active constraints and failure boundaries that must be preserved.',
                    items,
                }),
                'utf-8',
            );
            return;
        }

        if (layer === 'episodic') {
            const filePath = this.getDailyEpisodicFilePath(workspaceId);
            fs.writeFileSync(
                filePath,
                serializeMarkdownMemoryFile({
                    title: `Daily Episodic Memory (${workspaceId})`,
                    description: 'Daily notes and consolidated session summaries.',
                    items,
                }),
                'utf-8',
            );
        }
    }
}

// ─── 3. CorySessionStore (OOP Transcript & Summary Store) ───────

export class CorySessionStore {
    private readonly transcriptStore: TranscriptStore;
    private readonly summariesDir: string;

    constructor(stateDir: string) {
        const sessionsDir = path.join(stateDir, 'sessions');
        this.summariesDir = path.join(stateDir, 'summaries');
        if (!fs.existsSync(this.summariesDir)) {
            fs.mkdirSync(this.summariesDir, { recursive: true });
        }
        this.transcriptStore = new TranscriptStore({
            storeDir: sessionsDir,
            defaultRetrievalCount: 20,
            maxFileSizeBytes: 512 * 1024,
            compactionStrategy: 'summarize',
            tailChunkBytes: 64 * 1024,
        });
    }

    public getTranscriptStore(): TranscriptStore {
        return this.transcriptStore;
    }

    public appendTurn(
        sessionId: string,
        message: { role: 'user' | 'assistant' | 'system'; content: string },
    ): void {
        this.transcriptStore.appendMessage(sessionId, {
            type: 'message',
            timestamp: Date.now(),
            message,
        });
    }

    public async getRecentTurns(sessionId: string, count = 20): Promise<TranscriptEntry[]> {
        return this.transcriptStore.getRecentMessages(sessionId, count);
    }

    public saveSessionSummary(summary: CorySessionSummaryRecord): string {
        const safeSession = normalizeScopeId(summary.sessionId, 'session');
        const filePath = path.join(this.summariesDir, `${summary.dateKey}_${safeSession}.md`);
        const lines: string[] = [
            `# Session Summary: ${summary.sessionId} (${summary.dateKey})`,
            '',
            `## Overview`,
            summary.overview || '_No overview._',
            '',
            `## Decisions`,
            ...(summary.decisions.length > 0
                ? summary.decisions.map((d) => `- ${d}`)
                : ['_No explicit decisions recorded._']),
            '',
            `## Active Constraints`,
            ...(summary.activeConstraints.length > 0
                ? summary.activeConstraints.map((c) => `- ${c}`)
                : ['_No active constraints recorded._']),
            '',
        ];
        fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
        return filePath;
    }
}

// ─── 4. CorySummaryService (DOP Session Summary & Constraints) ──

const DECISION_REGEX =
    /\b(?:we decided to|decision:|remember this project uses|always use|convention:|standardize on|tetapkan|keputusan:)\s*(.+)/i;
const CONSTRAINT_REGEX =
    /\b(?:must not|do not|never|avoid|constraint:|jangan pernah|dilarang|batas aktif:)\s*(.+)/i;

export class CorySummaryService {
    private readonly memoryStore: CoryMemoryStore;
    private readonly sessionStore: CorySessionStore;

    constructor(memoryStore: CoryMemoryStore, sessionStore: CorySessionStore) {
        this.memoryStore = memoryStore;
        this.sessionStore = sessionStore;
    }

    /**
     * Pure DOP extraction + persistence of session summaries with separate
     * `Decisions` and `Active Constraints` sections (PRD 7.3).
     */
    public summarizeAndConsolidateSession(params: {
        sessionId: string;
        messages: ReadonlyArray<{ role: string; content: string }>;
        explicitDecisions?: readonly string[];
        explicitConstraints?: readonly string[];
        scope?: CoryScope;
        artifactRef?: string;
    }): CorySessionSummaryRecord {
        const userScope = normalizeScopeId(params.scope?.userScope, 'default');
        const workspaceId = normalizeScopeId(params.scope?.workspaceId, 'default');
        const dateKey = new Date().toISOString().slice(0, 10);

        const decisions = new Set<string>(params.explicitDecisions ?? []);
        const activeConstraints = new Set<string>(params.explicitConstraints ?? []);

        for (const msg of params.messages) {
            if (msg.role !== 'user' && msg.role !== 'system') continue;
            const decMatch = msg.content.match(DECISION_REGEX);
            if (decMatch?.[1]) {
                decisions.add(decMatch[1].trim());
            }
            const conMatch = msg.content.match(CONSTRAINT_REGEX);
            if (conMatch?.[1]) {
                activeConstraints.add(conMatch[1].trim());
            }
        }

        // Preserve any previously recorded active constraints in the workspace (PRD 7.3)
        const existingConstraints = this.memoryStore.listLayerItems('constraint', params.scope);
        for (const existing of existingConstraints) {
            activeConstraints.add(existing.content);
        }

        const overview =
            params.messages.length > 0
                ? `Consolidated ${params.messages.length} turns from session ${params.sessionId}.`
                : `Empty session summary for ${params.sessionId}.`;

        const summaryRecord: CorySessionSummaryRecord = {
            sessionId: params.sessionId,
            dateKey,
            userScope,
            workspaceId,
            overview,
            decisions: Array.from(decisions),
            activeConstraints: Array.from(activeConstraints),
            createdAt: Date.now(),
        };

        this.sessionStore.saveSessionSummary(summaryRecord);

        // Persist episodic summary note
        this.memoryStore.remember({
            layer: 'episodic',
            content: `[${dateKey}][${params.sessionId}] ${overview} Decisions: ${
                summaryRecord.decisions.join('; ') || 'none'
            }`,
            scope: params.scope,
            source: `session:${params.sessionId}`,
            artifactRef: params.artifactRef,
            tags: ['summary', dateKey],
        });

        // Persist active constraints so they survive compaction and consolidation (PRD 7.3)
        if (isTrustedForDurablePromotion(params.scope)) {
            for (const constraint of summaryRecord.activeConstraints) {
                this.memoryStore.remember({
                    layer: 'constraint',
                    content: constraint,
                    scope: params.scope,
                    source: `session:${params.sessionId}`,
                    artifactRef: params.artifactRef,
                    tags: ['active-constraint'],
                });
            }
            for (const decision of params.explicitDecisions ?? []) {
                this.memoryStore.remember({
                    layer: 'durable',
                    content: decision,
                    scope: params.scope,
                    source: `session:${params.sessionId}`,
                    artifactRef: params.artifactRef,
                    tags: ['decision'],
                });
            }
        }

        return summaryRecord;
    }
}

// ─── 5. CoryRetriever (DOP Scope-Aware Recall + Safe Fallback) ──

export class CoryRetriever {
    private readonly memoryStore: CoryMemoryStore;
    private readonly searchIndex: CorySearchIndex;
    private embedder: EmbeddingProvider | null;

    constructor(
        memoryStore: CoryMemoryStore,
        searchIndex: CorySearchIndex,
        embedder?: EmbeddingProvider | null,
    ) {
        this.memoryStore = memoryStore;
        this.searchIndex = searchIndex;
        this.embedder = embedder ?? null;
    }

    public setEmbeddingProvider(embedder: EmbeddingProvider | null): void {
        this.embedder = embedder;
    }

    /**
     * Scope-aware bounded recall with automatic lexical fallback and index self-healing.
     * Never throws even if SQLite index or optional embedder fails (PRD 7.1, 7.2, 10.6, 10.7).
     */
    public async retrieve(params: {
        query: string;
        scope?: CoryScope;
        layers?: readonly CoryMemoryLayer[];
        topK?: number;
    }): Promise<{ hits: CorySearchHit[]; degraded: boolean; semanticUsed: boolean }> {
        if (this.memoryStore.isPaused()) {
            return { hits: [], degraded: false, semanticUsed: false };
        }

        const userScope = normalizeScopeId(params.scope?.userScope, 'default');
        const workspaceId = normalizeScopeId(params.scope?.workspaceId, 'default');
        const topK = params.topK ?? 8;
        let degraded = false;
        let lexicalHits: Array<{ item: CoryMemoryItem; score: number }> = [];

        try {
            lexicalHits = this.searchIndex.searchLexical({
                query: params.query,
                userScope,
                workspaceId,
                layers: params.layers,
                topK: topK * 2,
            });
        } catch (err) {
            // Self-heal disposable SQLite index from canonical Markdown files!
            degraded = true;
            logCaughtError('cory-retriever:lexical-search-fallback', err);
            try {
                const allCanonical = this.memoryStore.loadAllCanonicalItems();
                this.searchIndex.rebuildFromCanonical(allCanonical);
                lexicalHits = this.searchIndex.searchLexical({
                    query: params.query,
                    userScope,
                    workspaceId,
                    layers: params.layers,
                    topK: topK * 2,
                });
            } catch {
                // Ultimate fallback: direct in-memory scan over canonical Markdown files
                lexicalHits = this.directCanonicalScan({
                    query: params.query,
                    scope: params.scope,
                    layers: params.layers,
                    topK,
                });
            }
        }

        // Optional semantic enhancement (PRD 8.2): best-effort only
        let semanticUsed = false;
        const hits: CorySearchHit[] = [];

        if (this.embedder && lexicalHits.length > 0 && params.query.trim()) {
            try {
                const queryVec = await this.embedder.embed(params.query);
                const docVecs = await this.embedder.embedBatch(
                    lexicalHits.map((h) => h.item.content),
                );
                semanticUsed = true;
                for (let i = 0; i < lexicalHits.length; i++) {
                    const lex = lexicalHits[i]!;
                    const docVec = docVecs[i];
                    const semScore = docVec ? Math.max(0, cosineSimilarity(queryVec, docVec)) : 0;
                    const combined = lex.score * 0.7 + semScore * 0.3;
                    hits.push({
                        item: lex.item,
                        score: combined,
                        lexicalScore: lex.score,
                        semanticScore: semScore,
                    });
                }
            } catch (err) {
                // Degrade gracefully to lexical results without crashing (PRD 10.6 & 10.7)
                degraded = true;
                semanticUsed = false;
                logCaughtError('cory-retriever:semantic-fallback', err);
                for (const lex of lexicalHits) {
                    hits.push({
                        item: lex.item,
                        score: lex.score,
                        lexicalScore: lex.score,
                    });
                }
            }
        } else {
            for (const lex of lexicalHits) {
                hits.push({
                    item: lex.item,
                    score: lex.score,
                    lexicalScore: lex.score,
                });
            }
        }

        hits.sort((a, b) => b.score - a.score);
        return {
            hits: hits.slice(0, topK),
            degraded,
            semanticUsed,
        };
    }

    private directCanonicalScan(params: {
        query: string;
        scope?: CoryScope;
        layers?: readonly CoryMemoryLayer[];
        topK: number;
    }): Array<{ item: CoryMemoryItem; score: number }> {
        const layers: readonly CoryMemoryLayer[] = params.layers ?? [
            'constraint',
            'identity',
            'durable',
            'episodic',
        ];
        const queryTokens = tokenize(params.query);
        const results: Array<{ item: CoryMemoryItem; score: number }> = [];

        for (const layer of layers) {
            const items = this.memoryStore.listLayerItems(layer, params.scope);
            for (const item of items) {
                const itemTokens = new Set(tokenize(item.content));
                let overlap = 0;
                for (const qt of queryTokens) {
                    if (itemTokens.has(qt)) overlap++;
                }
                if (
                    overlap > 0 ||
                    item.content.toLowerCase().includes(params.query.toLowerCase().trim())
                ) {
                    const boost = item.layer === 'constraint' ? 1.35 : 1.0;
                    results.push({ item, score: (overlap + 0.5) * boost });
                }
            }
        }
        return results.sort((a, b) => b.score - a.score).slice(0, params.topK);
    }
}

// ─── 6. CoryContextAssembler (DOP Prompt Stability & Context) ───

export class CoryContextAssembler {
    private readonly memoryStore: CoryMemoryStore;
    private readonly sessionStore: CorySessionStore;
    private readonly retriever: CoryRetriever;
    private readonly maxStartupSnapshotChars: number;

    /**
     * Session-pinned startup snapshots (PRD 7.2):
     * Memory written during an active session is persisted immediately to disk,
     * but the default startup snapshot for that session remains frozen so prompt
     * prefix caching and stability are never broken mid-session.
     */
    private readonly sessionSnapshots = new Map<string, CoryStartupSnapshot>();

    constructor(params: {
        memoryStore: CoryMemoryStore;
        sessionStore: CorySessionStore;
        retriever: CoryRetriever;
        maxStartupSnapshotChars?: number;
    }) {
        this.memoryStore = params.memoryStore;
        this.sessionStore = params.sessionStore;
        this.retriever = params.retriever;
        this.maxStartupSnapshotChars = params.maxStartupSnapshotChars ?? 4000;
    }

    /**
     * Capture or retrieve the frozen startup snapshot for a session (PRD 7.2).
     */
    public getOrCreateStartupSnapshot(sessionId: string, scope?: CoryScope): CoryStartupSnapshot {
        const userScope = normalizeScopeId(scope?.userScope, 'default');
        const workspaceId = normalizeScopeId(scope?.workspaceId, 'default');
        const cacheKey = `${userScope}:${workspaceId}:${sessionId}`;

        const cached = this.sessionSnapshots.get(cacheKey);
        if (cached) {
            return cached;
        }

        if (this.memoryStore.isPaused()) {
            const emptySnapshot: CoryStartupSnapshot = {
                sessionId,
                capturedAt: Date.now(),
                userScope,
                workspaceId,
                identityItems: [],
                durableItems: [],
                activeConstraints: [],
                formattedSnapshot: '',
            };
            this.sessionSnapshots.set(cacheKey, emptySnapshot);
            return emptySnapshot;
        }

        const identityItems = this.memoryStore.listLayerItems('identity', scope);
        const durableItems = this.memoryStore.listLayerItems('durable', scope);
        const activeConstraints = this.memoryStore.listLayerItems('constraint', scope);

        const sections: string[] = [];
        if (activeConstraints.length > 0) {
            sections.push(
                `## Active Constraints (Immutable)\n` +
                    activeConstraints.map((c) => `- [CONSTRAINT] ${c.content}`).join('\n'),
            );
        }
        if (identityItems.length > 0) {
            sections.push(
                `## User Identity & Preferences\n` +
                    identityItems.map((i) => `- ${i.content}`).join('\n'),
            );
        }
        if (durableItems.length > 0) {
            sections.push(
                `## Workspace Durable Decisions\n` +
                    durableItems.map((d) => `- ${d.content}`).join('\n'),
            );
        }

        let formattedSnapshot = sections.join('\n\n');
        if (formattedSnapshot.length > this.maxStartupSnapshotChars) {
            formattedSnapshot =
                formattedSnapshot.slice(0, this.maxStartupSnapshotChars - 24) +
                '\n...[snapshot bounded]';
        }

        const snapshot: CoryStartupSnapshot = {
            sessionId,
            capturedAt: Date.now(),
            userScope,
            workspaceId,
            identityItems,
            durableItems,
            activeConstraints,
            formattedSnapshot,
        };

        this.sessionSnapshots.set(cacheKey, snapshot);
        return snapshot;
    }

    /**
     * Clear a cached session snapshot (e.g., when a session ends or is reset).
     */
    public clearSessionSnapshot(sessionId?: string): void {
        if (!sessionId) {
            this.sessionSnapshots.clear();
            return;
        }
        for (const key of this.sessionSnapshots.keys()) {
            if (key.endsWith(`:${sessionId}`)) {
                this.sessionSnapshots.delete(key);
            }
        }
    }

    /**
     * Assemble the complete bounded context for a turn (PRD 7.2).
     */
    public async assembleContext(params: {
        sessionId: string;
        query: string;
        scope?: CoryScope;
        recentCount?: number;
        topK?: number;
    }): Promise<CoryAssembledContext> {
        const startupSnapshot = this.getOrCreateStartupSnapshot(params.sessionId, params.scope);
        const recentTranscript = await this.sessionStore.getRecentTurns(
            params.sessionId,
            params.recentCount ?? 20,
        );

        let retrievedEpisodic: CorySearchHit[] = [];
        let retrievedConstraints: CorySearchHit[] = [];
        let degradedSearch = false;
        let ragUsed = false;

        if (params.query.trim() && !this.memoryStore.isPaused()) {
            const recall = await this.retriever.retrieve({
                query: params.query,
                scope: params.scope,
                layers: ['constraint', 'episodic', 'durable'],
                topK: params.topK ?? 5,
            });
            degradedSearch = recall.degraded;
            ragUsed = recall.semanticUsed;

            const snapshotIds = new Set([
                ...startupSnapshot.identityItems.map((i) => i.id),
                ...startupSnapshot.durableItems.map((d) => d.id),
                ...startupSnapshot.activeConstraints.map((c) => c.id),
            ]);

            for (const hit of recall.hits) {
                if (hit.item.layer === 'constraint') {
                    if (!snapshotIds.has(hit.item.id)) {
                        retrievedConstraints.push(hit);
                    }
                } else if (!snapshotIds.has(hit.item.id)) {
                    retrievedEpisodic.push(hit);
                }
            }
        }

        const parts: string[] = [];
        if (startupSnapshot.formattedSnapshot) {
            parts.push(startupSnapshot.formattedSnapshot);
        }
        if (retrievedConstraints.length > 0) {
            parts.push(
                `## Recalled Active Constraints\n` +
                    retrievedConstraints.map((h) => `- [CONSTRAINT] ${h.item.content}`).join('\n'),
            );
        }
        if (recentTranscript.length > 0) {
            const recentLines = recentTranscript
                .filter((e) => e.message?.content)
                .map((e) => `${e.message!.role}: ${e.message!.content}`)
                .join('\n');
            if (recentLines) {
                parts.push(`## Recent Conversation\n${recentLines}`);
            }
        }
        if (retrievedEpisodic.length > 0) {
            parts.push(
                `## Relevant Context (from memory)\n` +
                    retrievedEpisodic
                        .map((h) => `- [score: ${h.score.toFixed(3)}] ${h.item.content}`)
                        .join('\n'),
            );
        }

        return {
            sessionId: params.sessionId,
            startupSnapshot,
            retrievedEpisodic,
            retrievedConstraints,
            recentTranscript,
            contextText: parts.join('\n\n'),
            degradedSearch,
            ragUsed,
        };
    }
}

// ─── 7. CoryBootstrapService (OOP GatewayService Lifecycle) ─────

export class CoryBootstrapService implements GatewayService {
    public readonly name = 'cory-memory';
    private readonly stateDir: string;
    private readonly config: CoryConfig;
    private isStarted = false;

    public readonly searchIndex: CorySearchIndex;
    public readonly memoryStore: CoryMemoryStore;
    public readonly sessionStore: CorySessionStore;
    public readonly retriever: CoryRetriever;
    public readonly contextAssembler: CoryContextAssembler;
    public readonly summaryService: CorySummaryService;

    constructor(config: CoryConfig = {}) {
        this.config = config;
        this.stateDir = resolveHomeStateDir(config.stateDir);
        if (!fs.existsSync(this.stateDir)) {
            fs.mkdirSync(this.stateDir, { recursive: true });
        }

        this.searchIndex = new CorySearchIndex(this.stateDir);
        this.memoryStore = new CoryMemoryStore(this.stateDir, this.searchIndex);
        this.sessionStore = new CorySessionStore(this.stateDir);
        this.retriever = new CoryRetriever(
            this.memoryStore,
            this.searchIndex,
            config.embeddingProvider ?? null,
        );
        this.contextAssembler = new CoryContextAssembler({
            memoryStore: this.memoryStore,
            sessionStore: this.sessionStore,
            retriever: this.retriever,
            maxStartupSnapshotChars: config.maxStartupSnapshotChars,
        });
        this.summaryService = new CorySummaryService(this.memoryStore, this.sessionStore);

        // Zero-config immediate initialization on construction so Cory works out of the box
        this.initializeLocalWorkspace();
    }

    private initializeLocalWorkspace(): void {
        this.memoryStore.ensureCanonicalDefaults();
        const canonicalItems = this.memoryStore.loadAllCanonicalItems();
        for (const item of canonicalItems) {
            this.searchIndex.upsertItem(item);
        }
    }

    public async start(): Promise<void> {
        this.initializeLocalWorkspace();
        this.isStarted = true;
    }

    public async stop(): Promise<void> {
        this.isStarted = false;
        this.searchIndex.close();
    }

    public health(): ServiceHealth {
        if (!this.isStarted) {
            return { status: 'down', detail: 'CoryBootstrapService is stopped.' };
        }
        const indexStats = this.searchIndex.stats();
        return {
            status: 'healthy',
            detail: `Cory active (documents=${indexStats.documents}, paused=${this.memoryStore.isPaused()}, stateDir=${this.stateDir})`,
        };
    }

    public getStateDir(): string {
        return this.stateDir;
    }

    public readCuratedMemoryFiles(scope?: CoryScope): CuratedMemoryFile[] {
        this.memoryStore.ensureCanonicalDefaults(scope);
        const configs: Array<{ id: CuratedMemoryFileId; filename: string; charLimit: number }> = [
            { id: 'user', filename: 'USER.md', charLimit: 1375 },
            { id: 'memory', filename: 'MEMORY.md', charLimit: 2200 },
            { id: 'constraints', filename: 'CONSTRAINTS.md', charLimit: 1500 },
        ];

        return configs.map((cfg) => {
            const filePath = this.memoryStore.getCuratedMemoryFilePath(cfg.id, scope);
            let content = '';
            let updatedAt = new Date().toISOString();
            try {
                if (fs.existsSync(filePath)) {
                    content = fs.readFileSync(filePath, 'utf-8');
                    const stat = fs.statSync(filePath);
                    updatedAt = stat.mtime.toISOString();
                }
            } catch (err) {
                logCaughtError(`cory:read-curated-file:${cfg.id}`, err);
            }

            return {
                id: cfg.id,
                filename: cfg.filename,
                path: filePath,
                content,
                charCount: content.length,
                charLimit: cfg.charLimit,
                updatedAt,
            };
        });
    }

    public writeCuratedMemoryFile(
        fileId: CuratedMemoryFileId,
        content: string,
        scope?: CoryScope,
    ): CuratedMemoryFile {
        if (fileId !== 'user' && fileId !== 'memory' && fileId !== 'constraints') {
            throw new Error(`Invalid curated memory fileId: ${String(fileId)}`);
        }

        const filePath = this.memoryStore.getCuratedMemoryFilePath(fileId, scope);
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const tempPath = path.join(
            dir,
            `.tmp-${fileId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
        );
        try {
            fs.writeFileSync(tempPath, content, 'utf-8');
            fs.renameSync(tempPath, filePath);
        } catch (err) {
            try {
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            } catch {
                // ignore
            }
            throw err;
        }

        // Reload canonical items and rebuild search index
        const allItems = this.memoryStore.loadAllCanonicalItems();
        this.searchIndex.rebuildFromCanonical(allItems);
        // Invalidate startup snapshot cache so subsequent turns pick up immediately
        this.contextAssembler.clearSessionSnapshot();

        const charLimit = fileId === 'user' ? 1375 : fileId === 'memory' ? 2200 : 1500;
        const filename =
            fileId === 'user' ? 'USER.md' : fileId === 'memory' ? 'MEMORY.md' : 'CONSTRAINTS.md';
        const stat = fs.statSync(filePath);

        return {
            id: fileId,
            filename,
            path: filePath,
            content,
            charCount: content.length,
            charLimit,
            updatedAt: stat.mtime.toISOString(),
        };
    }

    public resetCuratedMemoryFile(
        fileId: CuratedMemoryFileId,
        scope?: CoryScope,
    ): CuratedMemoryFile {
        if (fileId !== 'user' && fileId !== 'memory' && fileId !== 'constraints') {
            throw new Error(`Invalid curated memory fileId: ${String(fileId)}`);
        }

        const defaultContent = this.memoryStore.getDefaultCuratedMemoryContent(fileId, scope);
        return this.writeCuratedMemoryFile(fileId, defaultContent, scope);
    }
}
