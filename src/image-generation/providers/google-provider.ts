// @ts-nocheck
/**
 * CoreBlow — Google Image Generation Provider
 *
 * Supports: Imagen 3
 * API: Generative Language API - generateImages
 */

import type {
    ImageGenerationProvider, ImageGenerationCapabilities,
    ImageGenerationRequest, ImageGenerationResult,
} from '../types.js';

export class GoogleImageProvider implements ImageGenerationProvider {
    readonly id = 'google';
    readonly name = 'Google (Imagen)';
    readonly models = ['imagen-3', 'imagen-3-fast'];
    readonly capabilities: ImageGenerationCapabilities = {
        generate: true,
        edit: false,
        sizes: ['1024x1024', '1024x768', '768x1024', '1536x1536'],
        aspectRatios: ['1:1', '3:4', '4:3', '9:16', '16:9'],
        maxCount: 4,
        negativePrompt: true,
        styles: [],
        qualities: ['standard', 'hd'],
    };

    private apiKey: string | undefined;

    constructor(opts?: { apiKey?: string }) {
        this.apiKey = opts?.apiKey ?? process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;
    }

    isAvailable(): boolean {
        return !!this.apiKey;
    }

    async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
        if (!this.apiKey) throw new Error('Google API key not configured');

        const model = request.model ?? 'imagen-3';
        const n = Math.min(request.count ?? 1, 4);
        const start = Date.now();

        const body: Record<string, unknown> = {
            instances: [{ prompt: request.prompt }],
            parameters: {
                sampleCount: n,
                aspectRatio: request.aspectRatio ?? '1:1',
            },
        };

        if (request.negativePrompt) {
            (body.parameters as Record<string, unknown>).negativePrompt = request.negativePrompt;
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateImages?key=${this.apiKey}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(120000),
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Google image generation failed (${res.status}): ${err}`);
        }

        const data = await res.json() as {
            generatedImages?: Array<{
                image: { imageBytes: string };
                raiFilteredReason?: string;
            }>;
        };

        const images = (data.generatedImages ?? [])
            .filter(img => !img.raiFilteredReason)
            .map(img => ({
                base64: img.image.imageBytes,
                mimeType: 'image/png' as const,
            }));

        return {
            images,
            provider: this.id,
            model,
            metadata: { durationMs: Date.now() - start },
        };
    }
}
