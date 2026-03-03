// @ts-nocheck
/**
 * media-understanding/audio.ts
 * Audio transcription engine.
 * Ported from CoreBlow reference src/media-understanding/openai-compatible-audio.ts.
 */

import type { AudioTranscriptionRequest, AudioTranscriptionResult, MediaSource } from './types.js';
import { resolveMediaModel } from './defaults.js';
import { MediaSizeExceededError, MediaFormatError } from './errors.js';
import { getSupportedFormats, validateMediaScope, resolveMediaScope } from './scope.js';
import fs from 'node:fs';
import path from 'node:path';

const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB (OpenAI whisper limit)

/**
 * Resolve audio source to a file buffer.
 */
export async function resolveAudioPayload(source: MediaSource): Promise<{ buffer: Buffer; filename: string }> {
    switch (source.kind) {
        case 'file': {
            const buf = fs.readFileSync(source.path);
            if (buf.length > MAX_AUDIO_SIZE) throw new MediaSizeExceededError('audio', buf.length, MAX_AUDIO_SIZE);
            return { buffer: buf, filename: path.basename(source.path) };
        }
        case 'buffer': {
            if (source.buffer.length > MAX_AUDIO_SIZE) throw new MediaSizeExceededError('audio', source.buffer.length, MAX_AUDIO_SIZE);
            const ext = source.mimeType.split('/').pop() ?? 'mp3';
            return { buffer: source.buffer, filename: `audio.${ext}` };
        }
        case 'base64': {
            const buf = Buffer.from(source.data, 'base64');
            if (buf.length > MAX_AUDIO_SIZE) throw new MediaSizeExceededError('audio', buf.length, MAX_AUDIO_SIZE);
            const ext = source.mimeType.split('/').pop() ?? 'mp3';
            return { buffer: buf, filename: `audio.${ext}` };
        }
        default:
            throw new Error('URL source not supported for audio transcription. Download the file first.');
    }
}

/**
 * Validate audio format.
 */
export function validateAudioFormat(filename: string): void {
    const ext = path.extname(filename).toLowerCase().replace('.', '');
    const supported = getSupportedFormats('audio');
    if (!supported.includes(ext)) {
        throw new MediaFormatError('audio', ext);
    }
}

/**
 * Build transcription request params.
 */
export function buildTranscriptionParams(request: AudioTranscriptionRequest, cfg?: Record<string, unknown>): {
    model: string;
    language?: string;
    prompt?: string;
} {
    const model = request.model ?? resolveMediaModel('audio', cfg);
    validateMediaScope({ type: 'audio', scope: resolveMediaScope(cfg) });
    return { model, language: request.language, prompt: request.prompt };
}

/**
 * Format transcription segments into readable text.
 */
export function formatTranscriptionSegments(segments: Array<{ start: number; end: number; text: string }>): string {
    return segments.map((s) => {
        const startFmt = formatTimestamp(s.start);
        const endFmt = formatTimestamp(s.end);
        return `[${startFmt} → ${endFmt}] ${s.text.trim()}`;
    }).join('\n');
}

function formatTimestamp(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
