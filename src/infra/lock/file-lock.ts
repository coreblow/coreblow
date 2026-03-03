/**
 * infra/lock/file-lock.ts
 */
import fs from 'node:fs'; export class FileLock { private path: string; constructor(path: string) { this.path = path + '.lock'; } acquire(): boolean { try { fs.writeFileSync(this.path, String(process.pid), {flag: 'wx'}); return true; } catch { return false; } } release() { try { fs.unlinkSync(this.path); } catch { /* intentionally ignored */ } } isLocked(): boolean { return fs.existsSync(this.path); } }
