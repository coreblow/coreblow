export class MediaHandler { async process(input: Buffer, type: string) { return { processed: true, type, size: input.length }; } }
