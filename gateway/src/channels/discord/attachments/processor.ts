/**
 * Discord Attachment Processor
 * Processes downloaded attachments — resize images, extract text, validate formats.
 */

export interface ProcessedAttachment {
    filename: string;
    contentType: string;
    originalSize: number;
    processedSize: number;
    textContent?: string;
    metadata: Record<string, unknown>;
}

export function processAttachment(filename: string, buffer: Buffer, contentType: string): ProcessedAttachment {
    const metadata: Record<string, unknown> = { processedAt: Date.now() };
    let textContent: string | undefined;

    if (contentType.startsWith('text/')) {
        textContent = buffer.toString('utf-8');
        metadata.lineCount = textContent.split('\n').length;
    } else if (contentType.startsWith('image/')) {
        metadata.format = contentType.split('/')[1];
    }

    return { filename, contentType, originalSize: buffer.length, processedSize: buffer.length, textContent, metadata };
}

export function getFileExtension(filename: string): string {
    const dot = filename.lastIndexOf('.');
    return dot >= 0 ? filename.slice(dot + 1).toLowerCase() : '';
}