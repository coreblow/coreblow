/**
 * media-understanding/image.ts — Image analysis.
 */

export interface ImageAnalysis { description: string; objects: string[]; text?: string; colors: string[]; dimensions?: { width: number; height: number } }

export interface ImageAnalyzer { analyze(imageUrl: string, opts?: { ocr?: boolean }): Promise<ImageAnalysis> }

/** Mock image analyzer for testing. */
export class DefaultImageAnalyzer implements ImageAnalyzer {
    async analyze(imageUrl: string, opts?: { ocr?: boolean }): Promise<ImageAnalysis> {
        return { description: `Image from ${new URL(imageUrl).hostname}`, objects: [], colors: [], text: opts?.ocr ? '' : undefined };
    }
}

/** Format image analysis for context injection. */
export function formatImageAnalysis(analysis: ImageAnalysis): string {
    const parts = [`[Image: ${analysis.description}]`];
    if (analysis.objects.length > 0) parts.push(`Objects: ${analysis.objects.join(', ')}`);
    if (analysis.text) parts.push(`Text: "${analysis.text}"`);
    return parts.join(' | ');
}
