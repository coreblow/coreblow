/**
 * CoreBlow — Image Generation Types
 *
 * Type system for the image generation provider registry.
 * Follows CoreBlow's capability-based pattern.
 */

// ─── Request / Result ───────────────────────────────────────────

export interface ImageGenerationRequest {
    /** Text prompt describing the desired image */
    prompt: string;
    /** Negative prompt (what to avoid) */
    negativePrompt?: string;
    /** Provider ID (e.g., 'openai', 'google', 'fal') */
    provider?: string;
    /** Model ID (e.g., 'dall-e-3', 'imagen-3') */
    model?: string;
    /** Image size in pixels (e.g., '1024x1024', '1792x1024') */
    size?: string;
    /** Aspect ratio (e.g., '16:9', '1:1', '9:16') */
    aspectRatio?: string;
    /** Number of images to generate (default: 1) */
    count?: number;
    /** Quality setting */
    quality?: 'standard' | 'hd' | 'low';
    /** Style preset */
    style?: 'natural' | 'vivid';
    /** Reference image for editing (base64 or URL) */
    referenceImage?: string;
    /** Edit instruction (for reference image) */
    editInstruction?: string;
    /** Output format */
    outputFormat?: 'png' | 'jpeg' | 'webp';
}

export interface GeneratedImage {
    /** Image data as base64 string */
    base64?: string;
    /** Image URL (if hosted) */
    url?: string;
    /** Revised prompt (provider may refine) */
    revisedPrompt?: string;
    /** MIME type */
    mimeType: string;
    /** Image dimensions */
    width?: number;
    height?: number;
}

export interface ImageGenerationResult {
    /** Generated images */
    images: GeneratedImage[];
    /** Provider that generated the images */
    provider: string;
    /** Model used */
    model: string;
    /** Generation metadata */
    metadata: {
        /** Time taken in ms */
        durationMs: number;
        /** Tokens consumed (if applicable) */
        tokensUsed?: number;
        /** Cost estimate (if available) */
        costEstimate?: number;
    };
}

// ─── Provider Interface ─────────────────────────────────────────

export interface ImageGenerationProvider {
    /** Unique provider ID */
    id: string;
    /** Human-readable name */
    name: string;
    /** Supported model IDs */
    models: string[];
    /** Provider capabilities */
    capabilities: ImageGenerationCapabilities;
    /** Generate image(s) from request */
    generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
    /** Check if provider is available (has API key, etc.) */
    isAvailable(): boolean;
}

export interface ImageGenerationCapabilities {
    /** Supports text-to-image generation */
    generate: boolean;
    /** Supports image editing (inpainting, outpainting) */
    edit: boolean;
    /** Supported sizes (e.g., ['1024x1024', '1792x1024']) */
    sizes: string[];
    /** Supported aspect ratios */
    aspectRatios: string[];
    /** Max images per request */
    maxCount: number;
    /** Supports negative prompts */
    negativePrompt: boolean;
    /** Supports style presets */
    styles: string[];
    /** Supports quality settings */
    qualities: string[];
}
