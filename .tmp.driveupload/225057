/**
 * CoreBlow — Media Processor
 *
 * Processes media attachments (images, audio, documents) for
 * cross-channel delivery. Handles format detection, size validation,
 * thumbnail generation metadata, and channel-specific constraints.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

/** Supported media types */
export type MediaType = 'image' | 'audio' | 'video' | 'document' | 'unknown';

/** Media metadata */
export interface MediaMetadata {
    id: string;
    filename: string;
    type: MediaType;
    mimeType: string;
    size: number;
    hash: string;
    url?: string;
    width?: number;
    height?: number;
    duration?: number;
    thumbnail?: string;
    createdAt: number;
}

/** Channel media constraints */
export interface ChannelMediaConstraints {
    maxFileSize: number;
    supportedTypes: MediaType[];
    supportedFormats: string[];
    maxImageDimension?: number;
}

/** Default constraints per channel */
const CHANNEL_CONSTRAINTS: Record<string, ChannelMediaConstraints> = {
    discord: { maxFileSize: 25 * 1024 * 1024, supportedTypes: ['image', 'audio', 'video', 'document'], supportedFormats: ['png', 'jpg', 'gif', 'webp', 'mp3', 'mp4', 'pdf'] },
    telegram: { maxFileSize: 50 * 1024 * 1024, supportedTypes: ['image', 'audio', 'video', 'document'], supportedFormats: ['png', 'jpg', 'gif', 'webp', 'ogg', 'mp4', 'pdf'] },
    slack: { maxFileSize: 1024 * 1024 * 1024, supportedTypes: ['image', 'audio', 'video', 'document'], supportedFormats: ['png', 'jpg', 'gif', 'mp3', 'mp4', 'pdf', 'txt'] },
    whatsapp: { maxFileSize: 16 * 1024 * 1024, supportedTypes: ['image', 'audio', 'video', 'document'], supportedFormats: ['png', 'jpg', 'webp', 'ogg', 'mp4', 'pdf'], maxImageDimension: 5000 },
};

/** MIME type mapping */
const MIME_MAP: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
    mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4',
    mp4: 'video/mp4', webm: 'video/webm', avi: 'video/x-msvideo',
    pdf: 'application/pdf', txt: 'text/plain', json: 'application/json', csv: 'text/csv',
};

/**
 * CoreBlow Media Processor
 */
export class MediaProcessor {
    private uploadDir: string;

    constructor(uploadDir?: string) {
        this.uploadDir = uploadDir ?? '/tmp/coreblow-media';
    }

    /**
     * Process a file from a buffer.
     */
    processBuffer(buffer: Buffer, filename: string): MediaMetadata {
        const ext = path.extname(filename).slice(1).toLowerCase();
        return {
            id: crypto.randomBytes(8).toString('hex'),
            filename,
            type: this.detectType(ext),
            mimeType: MIME_MAP[ext] ?? 'application/octet-stream',
            size: buffer.length,
            hash: crypto.createHash('sha256').update(buffer).digest('hex'),
            createdAt: Date.now(),
        };
    }

    /**
     * Process a file from disk.
     */
    processFile(filePath: string): MediaMetadata | null {
        try {
            const stat = fs.statSync(filePath);
            const buffer = fs.readFileSync(filePath);
            const meta = this.processBuffer(buffer, path.basename(filePath));
            meta.size = stat.size;
            return meta;
        } catch {
            return null;
        }
    }

    /**
     * Validate media against channel constraints.
     */
    validate(meta: MediaMetadata, channel: string): { valid: boolean; errors: string[] } {
        const constraints = CHANNEL_CONSTRAINTS[channel];
        if (!constraints) return { valid: true, errors: [] };

        const errors: string[] = [];
        if (meta.size > constraints.maxFileSize) {
            errors.push(`File too large: ${(meta.size / 1024 / 1024).toFixed(1)}MB > ${(constraints.maxFileSize / 1024 / 1024).toFixed(0)}MB limit`);
        }
        if (!constraints.supportedTypes.includes(meta.type)) {
            errors.push(`Unsupported type: ${meta.type}`);
        }
        const ext = path.extname(meta.filename).slice(1).toLowerCase();
        if (ext && !constraints.supportedFormats.includes(ext)) {
            errors.push(`Unsupported format: ${ext}`);
        }

        return { valid: errors.length === 0, errors };
    }

    /**
     * Get channel constraints.
     */
    getConstraints(channel: string): ChannelMediaConstraints | null {
        return CHANNEL_CONSTRAINTS[channel] ?? null;
    }

    /**
     * Get MIME type for extension.
     */
    getMimeType(ext: string): string {
        return MIME_MAP[ext.replace('.', '')] ?? 'application/octet-stream';
    }

    // === Private ===

    private detectType(ext: string): MediaType {
        if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
        if (['mp3', 'ogg', 'wav', 'm4a'].includes(ext)) return 'audio';
        if (['mp4', 'webm', 'avi'].includes(ext)) return 'video';
        if (['pdf', 'txt', 'json', 'csv', 'doc', 'docx'].includes(ext)) return 'document';
        return 'unknown';
    }
}
