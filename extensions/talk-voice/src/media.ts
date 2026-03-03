/**
 * TalkVoice Media Handler
 */
export class TalkVoiceMediaHandler {
  private maxFileSize: number;
  private allowedTypes: string[];

  constructor(maxFileSize = 25 * 1024 * 1024) {
    this.maxFileSize = maxFileSize;
    this.allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'video/mp4', 'audio/mp3', 'application/pdf'];
  }

  isAllowed(type: string, size: number): boolean {
    return this.allowedTypes.includes(type) && size <= this.maxFileSize;
  }

  async upload(buffer: Buffer, filename: string, type: string) {
    if (!this.isAllowed(type, buffer.length)) throw new Error('File not allowed');
    return { url: '', filename, size: buffer.length, type };
  }

  async download(url: string) {
    return { buffer: Buffer.alloc(0), type: 'application/octet-stream' };
  }

  getMaxSize() { return this.maxFileSize; }
  getAllowedTypes() { return this.allowedTypes; }
}
