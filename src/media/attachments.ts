/**
 * src/media/attachments.ts
 * Attachment Pipeline — normalize, cache, process, and inject media into AI context
 * Handles: images, audio, video, documents from any channel
 */

import fs from 'node:fs';
import path from 'node:path';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('media:attachments');

// ─── Types ────────────────────────────────────────────────────────

export interface RawAttachment {
    url?: string;
    buffer?: Buffer;
    base64?: string;
    filename: string;
    mimeType: string;
    size: number;
    channel: string;
}

export interface ProcessedAttachment {
    id: string;
    type: 'image' | 'audio' | 'video' | 'document' | 'unknown';
    filename: string;
    mimeType: string;
    size: number;
    localPath: string;
    description?: string;
    transcription?: string;
    text?: string;
    duration?: number;
    cached: boolean;
    processedAt: number;
}

export interface AttachmentPipelineConfig {
    /** Max file size to process (bytes) — default 50MB */
    maxFileSize: number;
    /** Max concurrent downloads */
    concurrency: number;
    /** Cache directory */
    cacheDir: string;
    /** Cache TTL (ms) — default 24h */
    cacheTTLMs: number;
    /** Allowed MIME types (empty = all) */
    allowedMimeTypes: string[];
    /** Blocked MIME types */
    blockedMimeTypes: string[];
    /** Auto-describe images */
    autoDescribeImages: boolean;
    /** Auto-transcribe audio */
    autoTranscribeAudio: boolean;
}

const DEFAULT_CONFIG: AttachmentPipelineConfig = {
    maxFileSize: 50 * 1024 * 1024,
    concurrency: 3,
    cacheDir: '/tmp/coreblow-media-cache',
    cacheTTLMs: 24 * 60 * 60 * 1000,
    allowedMimeTypes: [],
    blockedMimeTypes: ['application/x-executable', 'application/x-msdownload'],
    autoDescribeImages: false,
    autoTranscribeAudio: false,
};

// ─── MIME Type Detection ─────────────────────────────────────────

const MIME_MAP: Record<string, 'image' | 'audio' | 'video' | 'document'> = {
    'image/jpeg': 'image', 'image/png': 'image', 'image/webp': 'image',
    'image/gif': 'image', 'image/svg+xml': 'image', 'image/bmp': 'image',
    'audio/mpeg': 'audio', 'audio/wav': 'audio', 'audio/ogg': 'audio',
    'audio/webm': 'audio', 'audio/aac': 'audio', 'audio/flac': 'audio',
    'audio/x-m4a': 'audio', 'audio/mp4': 'audio',
    'video/mp4': 'video', 'video/webm': 'video', 'video/quicktime': 'video',
    'video/x-msvideo': 'video', 'video/x-matroska': 'video',
    'application/pdf': 'document', 'text/plain': 'document',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'document',
    'text/csv': 'document', 'text/markdown': 'document',
};

const EXT_MAP: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
    '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
    '.m4a': 'audio/x-m4a', '.flac': 'audio/flac', '.aac': 'audio/aac',
    '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo', '.mkv': 'video/x-matroska',
    '.pdf': 'application/pdf', '.txt': 'text/plain',
    '.doc': 'application/msword', '.csv': 'text/csv', '.md': 'text/markdown',
};

// ─── Pipeline ────────────────────────────────────────────────────

export class AttachmentPipeline {
    private config: AttachmentPipelineConfig;
    private cache = new Map<string, ProcessedAttachment>();
    private activeDownloads = 0;
    private queue: Array<{ attachment: RawAttachment; resolve: (v: ProcessedAttachment | null) => void }> = [];

    constructor(config?: Partial<AttachmentPipelineConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        fs.mkdirSync(this.config.cacheDir, { recursive: true });
    }

    /**
     * Process a single attachment through the pipeline
     */
    async process(attachment: RawAttachment): Promise<ProcessedAttachment | null> {
        // 1. Validate
        const validation = this.validate(attachment);
        if (!validation.valid) {
            log.warn({ filename: attachment.filename, reason: validation.reason }, 'Attachment rejected');
            return null;
        }

        // 2. Check cache
        const cacheKey = this.getCacheKey(attachment);
        const cached = this.cache.get(cacheKey);
        if (cached && (Date.now() - cached.processedAt) < this.config.cacheTTLMs) {
            log.debug({ filename: attachment.filename }, 'Cache hit');
            return { ...cached, cached: true };
        }

        // 3. Process with concurrency control
        return this.enqueue(attachment);
    }

    /**
     * Process multiple attachments (batch)
     */
    async processBatch(attachments: RawAttachment[]): Promise<ProcessedAttachment[]> {
        const results = await Promise.all(attachments.map(a => this.process(a)));
        return results.filter((r): r is ProcessedAttachment => r !== null);
    }

    /**
     * Normalize an attachment — detect type, generate ID
     */
    normalize(attachment: RawAttachment): ProcessedAttachment {
        const type = this.detectType(attachment.mimeType, attachment.filename);
        const id = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const ext = path.extname(attachment.filename) || this.getExtFromMime(attachment.mimeType);
        const localPath = path.join(this.config.cacheDir, `${id}${ext}`);

        return {
            id,
            type,
            filename: attachment.filename,
            mimeType: attachment.mimeType,
            size: attachment.size,
            localPath,
            cached: false,
            processedAt: Date.now(),
        };
    }

    /**
     * Validate an attachment against pipeline rules
     */
    validate(attachment: RawAttachment): { valid: boolean; reason?: string } {
        if (attachment.size > this.config.maxFileSize) {
            return { valid: false, reason: `File too large: ${(attachment.size / 1024 / 1024).toFixed(1)}MB > ${(this.config.maxFileSize / 1024 / 1024).toFixed(0)}MB` };
        }

        if (this.config.blockedMimeTypes.includes(attachment.mimeType)) {
            return { valid: false, reason: `Blocked MIME type: ${attachment.mimeType}` };
        }

        if (this.config.allowedMimeTypes.length > 0 && !this.config.allowedMimeTypes.includes(attachment.mimeType)) {
            return { valid: false, reason: `MIME type not allowed: ${attachment.mimeType}` };
        }

        return { valid: true };
    }

    /**
     * Detect media type from MIME type or filename
     */
    detectType(mimeType: string, filename?: string): ProcessedAttachment['type'] {
        if (MIME_MAP[mimeType]) return MIME_MAP[mimeType];

        // Fallback to extension
        if (filename) {
            const ext = path.extname(filename).toLowerCase();
            const inferredMime = EXT_MAP[ext];
            if (inferredMime && MIME_MAP[inferredMime]) return MIME_MAP[inferredMime];
        }

        // Fallback to category
        if (mimeType.startsWith('image/')) return 'image';
        if (mimeType.startsWith('audio/')) return 'audio';
        if (mimeType.startsWith('video/')) return 'video';
        if (mimeType.startsWith('text/') || mimeType.startsWith('application/')) return 'document';

        return 'unknown';
    }

    /**
     * Build AI context string from processed attachments
     */
    buildContext(attachments: ProcessedAttachment[]): string {
        if (attachments.length === 0) return '';

        const parts: string[] = ['[Attachments]'];
        for (const att of attachments) {
            const desc = att.description ? `: ${att.description}` : '';
            const text = att.transcription ? ` — Transcription: "${att.transcription}"` : '';
            const docText = att.text ? ` — Content: "${att.text.substring(0, 500)}"` : '';
            parts.push(`- ${att.type}: ${att.filename} (${(att.size / 1024).toFixed(0)}KB)${desc}${text}${docText}`);
        }
        return parts.join('\n');
    }

    /**
     * Get pipeline stats
     */
    getStats() {
        return {
            cached: this.cache.size,
            activeDownloads: this.activeDownloads,
            queued: this.queue.length,
        };
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
        try {
            const files = fs.readdirSync(this.config.cacheDir);
            for (const f of files) {
                fs.unlinkSync(path.join(this.config.cacheDir, f));
            }
        } catch { /* ignore */ }
        log.info('Cache cleared');
    }

    // ─── Private ─────────────────────────────────────────────────

    private getCacheKey(attachment: RawAttachment): string {
        return `${attachment.channel}:${attachment.filename}:${attachment.size}`;
    }

    private getExtFromMime(mimeType: string): string {
        for (const [ext, mime] of Object.entries(EXT_MAP)) {
            if (mime === mimeType) return ext;
        }
        return '';
    }

    private enqueue(attachment: RawAttachment): Promise<ProcessedAttachment | null> {
        return new Promise(resolve => {
            this.queue.push({ attachment, resolve });
            this.processQueue();
        });
    }

    private async processQueue() {
        while (this.queue.length > 0 && this.activeDownloads < this.config.concurrency) {
            const item = this.queue.shift();
            if (!item) break;

            this.activeDownloads++;
            try {
                const result = await this.download(item.attachment);
                item.resolve(result);
            } catch (err: unknown) {
                log.error({ err: (err instanceof Error ? err.message : String(err)), filename: item.attachment.filename }, 'Download failed');
                item.resolve(null);
            } finally {
                this.activeDownloads--;
                // Process next in queue
                if (this.queue.length > 0) this.processQueue();
            }
        }
    }

    private async download(attachment: RawAttachment): Promise<ProcessedAttachment> {
        const processed = this.normalize(attachment);

        // Save to local path
        if (attachment.buffer) {
            fs.writeFileSync(processed.localPath, attachment.buffer);
        } else if (attachment.base64) {
            fs.writeFileSync(processed.localPath, Buffer.from(attachment.base64, 'base64'));
        } else if (attachment.url) {
            const res = await fetch(attachment.url, { signal: AbortSignal.timeout(30000) });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const buf = Buffer.from(await res.arrayBuffer());
            fs.writeFileSync(processed.localPath, buf);
        }

        // Cache result
        const cacheKey = this.getCacheKey(attachment);
        this.cache.set(cacheKey, processed);

        log.debug({ id: processed.id, type: processed.type, filename: processed.filename }, 'Attachment processed');
        return processed;
    }
}
