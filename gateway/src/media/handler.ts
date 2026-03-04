/**
 * src/media/handler.ts
 * Media pipeline — receive/optimize/send media from channels
 */

import fs from 'node:fs';
import path from 'node:path';
import { getHomeDir } from '../gateway/config.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('media');

export interface MediaAttachment {
    type: 'image' | 'audio' | 'video' | 'document';
    mimeType: string;
    filename: string;
    size: number;
    url?: string;
    buffer?: Buffer;
    localPath?: string;
}

export class MediaHandler {
    private mediaDir: string;

    constructor() {
        this.mediaDir = path.join(getHomeDir(), 'media');
        fs.mkdirSync(this.mediaDir, { recursive: true });
    }

    /**
     * Save media from a channel to local storage
     */
    async saveMedia(attachment: MediaAttachment): Promise<string> {
        const timestamp = Date.now();
        const ext = this.getExtension(attachment.mimeType);
        const filename = `${timestamp}_${attachment.filename || 'media'}${ext}`;
        const filePath = path.join(this.mediaDir, filename);

        if (attachment.buffer) {
            fs.writeFileSync(filePath, attachment.buffer);
        } else if (attachment.url) {
            const res = await fetch(attachment.url, { signal: AbortSignal.timeout(30000) });
            if (!res.ok) throw new Error(`Failed to download: HTTP ${res.status}`);
            const buffer = Buffer.from(await res.arrayBuffer());
            fs.writeFileSync(filePath, buffer);
        } else {
            throw new Error('No buffer or URL provided');
        }

        log.info({ filename, size: attachment.size, type: attachment.type }, 'Media saved');
        return filePath;
    }

    /**
     * Optimize an image (resize, compress)
     */
    async optimizeImage(filePath: string, maxWidth = 1920): Promise<string> {
        try {
            // @ts-ignore — sharp is optional
            const sharp = (await import('sharp')).default;
            const outputPath = filePath.replace(/\.(\w+)$/, '_opt.$1');

            await sharp(filePath)
                .resize(maxWidth, null, { withoutEnlargement: true })
                .jpeg({ quality: 85 })
                .toFile(outputPath);

            const stats = fs.statSync(outputPath);
            log.info({ original: filePath, optimized: outputPath, size: stats.size }, 'Image optimized');
            return outputPath;
        } catch {
            log.debug('Sharp not available, skipping optimization');
            return filePath;
        }
    }

    /**
     * Get media for vision analysis
     */
    async toBase64(filePath: string): Promise<string> {
        const buffer = fs.readFileSync(filePath);
        return buffer.toString('base64');
    }

    /**
     * Transcribe audio (via Ollama whisper or Deepgram)
     */
    async transcribeAudio(filePath: string): Promise<string> {
        // Try Deepgram
        const deepgramKey = process.env.DEEPGRAM_API_KEY;
        if (deepgramKey) {
            try {
                const buffer = fs.readFileSync(filePath);
                const res = await fetch('https://api.deepgram.com/v1/listen?model=nova-2', {
                    method: 'POST',
                    headers: {
                        Authorization: `Token ${deepgramKey}`,
                        'Content-Type': 'audio/wav',
                    },
                    body: buffer,
                    signal: AbortSignal.timeout(60000),
                });

                if (res.ok) {
                    const data: any = await res.json();
                    return data.results?.channels?.[0]?.alternatives?.[0]?.transcript || '(no transcription)';
                }
            } catch (err: any) {
                log.warn({ err: err.message }, 'Deepgram transcription failed');
            }
        }

        // Try Ollama whisper
        try {
            const buffer = fs.readFileSync(filePath);
            const base64 = buffer.toString('base64');
            const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';

            const res = await fetch(`${ollamaUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'whisper',
                    messages: [{ role: 'user', content: 'Transcribe this audio.', images: [base64] }],
                    stream: false,
                }),
                signal: AbortSignal.timeout(60000),
            });

            if (res.ok) {
                const data: any = await res.json();
                return data.message?.content || '(no transcription)';
            }
        } catch {
            // Whisper not available
        }

        return '(Audio transcription not available. Set DEEPGRAM_API_KEY or install Ollama whisper model.)';
    }

    /**
     * List saved media files
     */
    listMedia(): string[] {
        try {
            return fs.readdirSync(this.mediaDir).filter((f) => !f.startsWith('.'));
        } catch {
            return [];
        }
    }

    /**
     * Clean old media (older than N days)
     */
    cleanOldMedia(maxDays = 7) {
        const cutoff = Date.now() - maxDays * 86400_000;
        let removed = 0;

        try {
            for (const file of fs.readdirSync(this.mediaDir)) {
                const filePath = path.join(this.mediaDir, file);
                const stats = fs.statSync(filePath);
                if (stats.mtimeMs < cutoff) {
                    fs.unlinkSync(filePath);
                    removed++;
                }
            }
        } catch { /* ignore */ }

        if (removed > 0) {
            log.info({ removed }, 'Old media cleaned');
        }
    }

    private getExtension(mimeType: string): string {
        const map: Record<string, string> = {
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/webp': '.webp',
            'image/gif': '.gif',
            'audio/ogg': '.ogg',
            'audio/mpeg': '.mp3',
            'audio/wav': '.wav',
            'video/mp4': '.mp4',
            'application/pdf': '.pdf',
        };
        return map[mimeType] || '';
    }
}
