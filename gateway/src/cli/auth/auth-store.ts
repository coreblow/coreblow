/**
 * cli/auth/auth-store.ts
 */
import fs from 'node:fs'; export class AuthStore { private path: string; constructor(p: string) { this.path = p; } save(token: string) { fs.writeFileSync(this.path, token); } load() { try { return fs.readFileSync(this.path, 'utf-8').trim(); } catch { return null; } } clear() { try { fs.unlinkSync(this.path); } catch { /* intentionally ignored */ } } }
