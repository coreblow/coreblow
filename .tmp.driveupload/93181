/**
 * process/pool.ts
 */
export class ProcessPool { private workers: unknown[] = []; private maxSize: number; constructor(maxSize = 4) { this.maxSize = maxSize; } acquire(): unknown { return this.workers.pop() || null; } release(worker: unknown) { if (this.workers.length < this.maxSize) this.workers.push(worker); } size() { return this.workers.length; } }
