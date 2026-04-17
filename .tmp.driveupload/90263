/**
 * media-understanding/image-analysis.ts
 * Image analysis engine.
 * Ported from OpenClaw src/media-understanding/image.ts.
 */

import type { ImageDescriptionRequest, MediaSource } from './types.js';
import { resolveMediaPrompt, resolveMediaModel, resolveMediaMaxTokens, DEFAULT_DETAIL } from './defaults.js';
import { MediaSizeExceededError } from './errors.js';
import { validateMediaScope, resolveMediaScope } from './scope.js';
import fs from 'node:fs';

const MAX_IMAGE_BASE64_SIZE = 20 * 1024 * 1024;

export async function resolveImagePayload(source: MediaSource): Promise<{ data: string; mimeType: string }> {
    switch (source.kind) {
        case 'base64':
            return { data: source.data, mimeType: source.mimeType };
        case 'buffer':
            return { data: source.buffer.toString('base64'), mimeType: source.mimeType };
        case 'file': {
            const buf = fs.readFileSync(source.path);
            if (buf.length > MAX_IMAGE_BASE64_SIZE) throw new MediaSizeExceededError('image', buf.length, MAX_IMAGE_BASE64_SIZE);
            const ext = source.path.split('.').pop()?.toLowerCase() ?? 'png';
            const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
            return { data: buf.toString('base64'), mimeType: mime };
        }
        case 'url':
            return { data: source.url, mimeType: 'image/url' };
        default:
            throw new Error('Unknown media source kind');
    }
}

export function buildImageDescriptionParams(request: ImageDescriptionRequest, cfg?: Record<string, unknown>) {
    const prompt = resolveMediaPrompt({ type: 'image', customPrompt: request.prompt, cfg });
    const model = request.model ?? resolveMediaModel('image', cfg);
    const maxTokens = resolveMediaMaxTokens(undefined, request.maxTokens);
    const detail = request.detail ?? DEFAULT_DETAIL;
    validateMediaScope({ type: 'image', scope: resolveMediaScope(cfg) });
    return { prompt, model, maxTokens, detail };
}

export function buildImageMessages(params: {
    prompt: string;
    payload: { data: string; mimeType: string };
    detail: 'auto' | 'low' | 'high';
}): Array<{ role: string; content: unknown }> {
    const isUrl = params.payload.mimeType === 'image/url';
    return [{
        role: 'user',
        content: [
            {
                type: 'image_url',
                image_url: isUrl
                    ? { url: params.payload.data, detail: params.detail }
                    : { url: `data:${params.payload.mimeType};base64,${params.payload.data}`, detail: params.detail },
            },
            { type: 'text', text: params.prompt },
        ],
    }];
}

export function estimateImageDimensions(base64Data: string, mimeType: string): { width: number; height: number } | undefined {
    try {
        const buf = Buffer.from(base64Data.slice(0, 200), 'base64');
        if (mimeType.includes('png') && buf.length >= 24) {
            return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
        }
    } catch { /* can't parse */ }
    return undefined;
}
