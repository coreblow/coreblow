/**
 * agents/queued-file-writer.ts
 * Queue-based file writer for concurrent safe writes.
 */
import fs from 'node:fs';
import path from 'node:path';

interface WriteJob { filePath: string; content: string; resolve: () => void; reject: (err: Error) => void; }

export class QueuedFileWriter {
    private queue: WriteJob[] = [];
    private processing = false;

    async write(filePath: string, content: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.queue.push({ filePath, content, resolve, reject });
            if (!this.processing) this.processQueue();
        });
    }

    private async processQueue(): Promise<void> {
        this.processing = true;
        while (this.queue.length > 0) {
            const job = this.queue.shift()!;
            try {
                fs.mkdirSync(path.dirname(job.filePath), { recursive: true });
                fs.writeFileSync(job.filePath, job.content, 'utf-8');
                job.resolve();
            } catch (err) { job.reject(err instanceof Error ? err : new Error(String(err))); }
        }
        this.processing = false;
    }

    pending(): number { return this.queue.length; }
    isProcessing(): boolean { return this.processing; }
}
