// @ts-nocheck
/**
 * CoreBlow — Fal.ai Image Generation Provider
 *
 * Supports: Flux Pro, Flux Dev, Flux Schnell
 * API: https://fal.run/fal-ai/flux-pro/v1.1
 */

import type {
    ImageGenerationProvider, ImageGenerationCapabilities,
    ImageGenerationRequest, ImageGenerationResult,
} from '../types.js';

export class FalImageProvider implements ImageGenerationProvider {
    readonly id = 'fal';
    readonly name = 'Fal.ai (Flux)';
    readonly models = ['flux-pro', 'flux-dev', 'flux-schnell'];
    readonly capabilities: ImageGenerationCapabilities = {
        generate: true,
        edit: false,
        sizes: ['1024x1024', '1024x768', '768x1024', '1280x720', '720x1280'],
        aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9'],
        maxCount: 4,
        negativePrompt: true,
        styles: [],
        qualities: ['standard'],
    };

    private apiKey: string | undefined;

    constructor(opts?: { apiKey?: string }) {
        this.apiKey = opts?.apiKey ?? process.env.FAL_KEY ?? process.env.FAL_API_KEY;
    }

    isAvailable(): boolean {
        return !!this.apiKey;
    }

    async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
        if (!this.apiKey) throw new Error('Fal.ai API key not configured');

        const model = request.model ?? 'flux-pro';
        const n = Math.min(request.count ?? 1, 4);
        const start = Date.now();

        const modelEndpoints: Record<string, string> = {
            'flux-pro': 'fal-ai/flux-pro/v1.1',
            'flux-dev': 'fal-ai/flux/dev',
            'flux-schnell': 'fal-ai/flux/schnell',
        };
        const endpoint = modelEndpoints[model] ?? modelEndpoints['flux-pro'];

        const body: Record<string, unknown> = {
            prompt: request.prompt,
            num_images: n,
            image_size: request.aspectRatio
                ? mapAspectRatioToFalSize(request.aspectRatio)
                : (request.size ?? 'landscape_16_9'),
            enable_safety_checker: true,
        };

        if (request.negativePrompt) {
            body.negative_prompt = request.negativePrompt;
        }

        const url = `https://fal.run/${endpoint}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Key ${this.apiKey}`,
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(120000),
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Fal.ai image generation failed (${res.status}): ${err}`);
        }

        const data = await res.json() as {
            images?: Array<{
                url: string;
                content_type?: string;
                width?: number;
                height?: number;
            }>;
        };

        const images = (data.images ?? []).map(img => ({
            url: img.url,
            mimeType: img.content_type ?? 'image/png',
            width: img.width,
            height: img.height,
        }));

        return {
            images,
            provider: this.id,
            model,
            metadata: { durationMs: Date.now() - start },
        };
    }
}

function mapAspectRatioToFalSize(ratio: string): string {
    const map: Record<string, string> = {
        '1:1': 'square',
        '16:9': 'landscape_16_9',
        '9:16': 'portrait_16_9',
        '4:3': 'landscape_4_3',
        '3:4': 'portrait_4_3',
        '21:9': 'landscape_16_9',
    };
    return map[ratio] ?? 'landscape_16_9';
}
