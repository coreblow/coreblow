/**
 * CoreBlow — Response Compression
 *
 * Compresses response payloads using various algorithms
 * with configurable thresholds and content-type filtering.
 */

/** Compression algorithm */
export type CompressionAlgorithm = 'gzip' | 'deflate' | 'br' | 'none';

/** Compression result */
export interface CompressionResult {
    original: number;
    compressed: number;
    ratio: number;
    algorithm: CompressionAlgorithm;
    skipped: boolean;
}

/**
 * CoreBlow Response Compression
 */
export class ResponseCompression {
    private minSize = 1024; // bytes
    private preferredAlgorithm: CompressionAlgorithm = 'gzip';
    private compressibleTypes = new Set(['application/json', 'text/html', 'text/plain', 'text/css', 'application/javascript', 'text/xml']);
    private stats = { compressed: 0, skipped: 0, bytesSaved: 0 };

    /**
     * Set minimum size for compression.
     */
    setMinSize(bytes: number): void { this.minSize = bytes; }

    /**
     * Set preferred algorithm.
     */
    setAlgorithm(algo: CompressionAlgorithm): void { this.preferredAlgorithm = algo; }

    /**
     * Add compressible content type.
     */
    addType(contentType: string): void { this.compressibleTypes.add(contentType); }

    /**
     * Should compress?
     */
    shouldCompress(contentType: string, size: number): boolean {
        if (size < this.minSize) return false;
        const baseType = contentType.split(';')[0]!.trim();
        return this.compressibleTypes.has(baseType);
    }

    /**
     * Simulate compression (actual zlib would be used in real impl).
     */
    compress(data: string, contentType: string): CompressionResult {
        const original = data.length;
        if (!this.shouldCompress(contentType, original)) {
            this.stats.skipped++;
            return { original, compressed: original, ratio: 1, algorithm: 'none', skipped: true };
        }

        // Simulate compression ratio based on content type
        const ratios: Record<string, number> = { 'application/json': 0.3, 'text/html': 0.25, 'text/plain': 0.4 };
        const baseType = contentType.split(';')[0]!.trim();
        const ratio = ratios[baseType] ?? 0.5;
        const compressed = Math.floor(original * ratio);

        this.stats.compressed++;
        this.stats.bytesSaved += original - compressed;
        return { original, compressed, ratio, algorithm: this.preferredAlgorithm, skipped: false };
    }

    /**
     * Negotiate algorithm from Accept-Encoding.
     */
    negotiate(acceptEncoding: string): CompressionAlgorithm {
        if (acceptEncoding.includes('br')) return 'br';
        if (acceptEncoding.includes('gzip')) return 'gzip';
        if (acceptEncoding.includes('deflate')) return 'deflate';
        return 'none';
    }

    /**
     * Get stats.
     */
    getStats(): typeof this.stats & { compressionRate: number } {
        const total = this.stats.compressed + this.stats.skipped;
        return { ...this.stats, compressionRate: total > 0 ? this.stats.compressed / total : 0 };
    }
}
