/**
 * cli/daemon/pid-file.ts
 */
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; const PID_FILE = path.join(os.homedir(), '.coreblow', 'daemon.pid'); export function writePid(pid: number) { fs.mkdirSync(path.dirname(PID_FILE), {recursive: true}); fs.writeFileSync(PID_FILE, String(pid)); } export function readPid(): number | null { try { return parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim()); } catch { return null; } } export function removePid() { try { fs.unlinkSync(PID_FILE); } catch { /* intentionally ignored */ } }
