/**
 * media-understanding/video.ts
 * Video analysis engine with frame extraction.
 * Ported from CoreBlow reference src/media-understanding/video.ts.
 */

import type { VideoDescriptionRequest, MediaSource } from './types.js';
import { resolveMediaPrompt, resolveMediaModel, resolveMediaMaxTokens, DEFAULT_SAMPLE_FRAMES } from './defaults.js';
import { validateMediaScope, resolveMediaScope } from './scope.js';

/**
 * Build video analysis parameters.
 */
export function buildVideoAnalysisParams(request: VideoDescriptionRequest, cfg?: Record<string, unknown>) {
    const prompt = resolveMediaPrompt({ type: 'video', customPrompt: request.prompt, cfg });
    const model = request.model ?? resolveMediaModel('video', cfg);
    const maxTokens = resolveMediaMaxTokens(undefined, request.maxTokens);
    const sampleFrames = request.sampleFrames ?? DEFAULT_SAMPLE_FRAMES;
    const includeAudio = request.includeAudio ?? true;
    validateMediaScope({ type: 'video', scope: resolveMediaScope(cfg) });
    return { prompt, model, maxTokens, sampleFrames, includeAudio };
}

/**
 * Calculate optimal frame sample points for video analysis.
 */
export function calculateFrameSamplePoints(durationSec: number, frameCount: number): number[] {
    if (frameCount <= 0) return [];
    if (frameCount === 1) return [durationSec / 2];
    const points: number[] = [];
    const interval = durationSec / (frameCount + 1);
    for (let i = 1; i <= frameCount; i++) {
        points.push(Math.round(interval * i * 100) / 100);
    }
    return points;
}

/**
 * Build a composite video analysis prompt.
 */
export function buildCompositeVideoPrompt(params: {
    basePrompt: string;
    frameDescriptions: string[];
    audioTranscription?: string;
}): string {
    const parts: string[] = [params.basePrompt, ''];

    if (params.frameDescriptions.length > 0) {
        parts.push('## Key Frames');
        params.frameDescriptions.forEach((desc, i) => {
            parts.push(`\nFrame ${i + 1}:\n${desc}`);
        });
    }

    if (params.audioTranscription) {
        parts.push('\n## Audio Transcription');
        parts.push(params.audioTranscription);
    }

    return parts.join('\n');
}

// Stub exports — used by runner.entries.ts
export function estimateBase64Size(byteLen: number): number { return Math.ceil(byteLen * 4 / 3); }
export function resolveVideoMaxBase64Bytes(_cfg?: unknown): number { return 20 * 1024 * 1024; }
