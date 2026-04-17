// @ts-nocheck
/**
 * canvas-host/server.ts — CoreBlow Canvas Host Server
 *
 * Serves static canvas web content with live-reload support.
 * Uses native Node.js fs.watch instead of chokidar to avoid
 * external dependencies.
 *
 * Ported from CoreBlow reference src/canvas-host/server.ts (520 LOC) —
 * streamlined for CoreBlow (no chokidar, no RuntimeEnv, no CLI prompts).
 */

import * as fsSync from 'node:fs';
import fs from 'node:fs/promises';
import http, { type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import path from 'node:path';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type WebSocket } from 'ws';
import { createChildLogger } from '../utils/logger.js';
import {
    CANVAS_HOST_PATH,
    CANVAS_WS_PATH,
    handleA2uiHttpRequest,
    injectCanvasLiveReload,
} from './a2ui.js';
import { normalizeUrlPath, resolveFileWithinRoot } from './file-resolver.js';

const log = createChildLogger('canvas-host');

// ─── Types ──────────────────────────────────────────────────────────

export interface CanvasHostOpts {
    rootDir?: string;
    port?: number;
    listenHost?: string;
    liveReload?: boolean;
    basePath?: string;
    webSocketServerClass?: typeof WebSocketServer;
}

export interface CanvasHostServer {
    port: number;
    rootDir: string;
    close: () => Promise<void>;
}

export interface CanvasHostHandler {
    rootDir: string;
    basePath: string;
    handleHttpRequest: (req: IncomingMessage, res: ServerResponse) => Promise<boolean>;
    handleUpgrade: (req: IncomingMessage, socket: Duplex, head: Buffer) => boolean;
    close: () => Promise<void>;
}

// ─── Default Index HTML ─────────────────────────────────────────────

function defaultIndexHTML(): string {
    return `<!doctype html>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>CoreBlow Canvas</title>
<style>
  html, body { height: 100%; margin: 0; background: #000; color: #fff; font: 16px/1.4 -apple-system, BlinkMacSystemFont, system-ui, Segoe UI, Roboto, Helvetica, Arial, sans-serif; }
  .wrap { min-height: 100%; display: grid; place-items: center; padding: 24px; }
  .card { width: min(720px, 100%); background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.10); border-radius: 16px; padding: 18px 18px 14px; }
  .title { display: flex; align-items: baseline; gap: 10px; }
  h1 { margin: 0; font-size: 22px; letter-spacing: 0.2px; }
  .sub { opacity: 0.75; font-size: 13px; }
  .row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; }
  button { appearance: none; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.10); color: #fff; padding: 10px 12px; border-radius: 12px; font-weight: 600; cursor: pointer; }
  button:active { transform: translateY(1px); }
  .ok { color: #24e08a; }
  .bad { color: #ff5c5c; }
  .log { margin-top: 14px; opacity: 0.85; font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; white-space: pre-wrap; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.08); padding: 10px; border-radius: 12px; }
</style>
<div class="wrap">
  <div class="card">
    <div class="title">
      <h1>CoreBlow Canvas</h1>
      <div class="sub">Interactive test page (auto-reload enabled)</div>
    </div>
    <div class="row">
      <button id="btn-hello">Hello</button>
      <button id="btn-time">Time</button>
      <button id="btn-photo">Photo</button>
    </div>
    <div id="status" class="sub" style="margin-top: 10px;"></div>
    <div id="log" class="log">Ready.</div>
  </div>
</div>
<script>
(() => {
  const logEl = document.getElementById("log");
  const log = (msg) => { logEl.textContent = String(msg); };

  const hasBridge = () => typeof globalThis.coreblowSendUserAction === "function";
  document.getElementById("status").innerHTML =
    "Bridge: " + (hasBridge() ? "<span class='ok'>ready</span>" : "<span class='bad'>missing</span>");

  function send(name, sourceComponentId) {
    if (!hasBridge()) {
      log("No action bridge found.");
      return;
    }
    const ok = globalThis.coreblowSendUserAction({ name, surfaceId: "main", sourceComponentId, context: { t: Date.now() } });
    log(ok ? ("Sent action: " + name) : ("Failed to send action: " + name));
  }

  document.getElementById("btn-hello").onclick = () => send("hello", "demo.hello");
  document.getElementById("btn-time").onclick = () => send("time", "demo.time");
  document.getElementById("btn-photo").onclick = () => send("photo", "demo.photo");
})();
</script>
`;
}

// ─── Helpers ────────────────────────────────────────────────────────

function isDisabledByEnv(): boolean {
    if (process.env.COREBLOW_SKIP_CANVAS_HOST === '1' || process.env.COREBLOW_SKIP_CANVAS_HOST === 'true') {
        return true;
    }
    if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
        return true;
    }
    return false;
}

function normalizeBasePath(rawPath: string | undefined): string {
    const trimmed = (rawPath ?? CANVAS_HOST_PATH).trim();
    const normalized = normalizeUrlPath(trimmed || CANVAS_HOST_PATH);
    if (normalized === '/') return '/';
    return normalized.replace(/\/+$/, '');
}

async function prepareCanvasRoot(rootDir: string): Promise<string> {
    await fs.mkdir(rootDir, { recursive: true });
    const rootReal = await fs.realpath(rootDir);
    try {
        const indexPath = path.join(rootReal, 'index.html');
        await fs.stat(indexPath);
    } catch {
        try {
            await fs.writeFile(path.join(rootReal, 'index.html'), defaultIndexHTML(), 'utf8');
        } catch {
            // ignore
        }
    }
    return rootReal;
}

function resolveDefaultCanvasRoot(): string {
    const stateDir = process.env.COREBLOW_STATE_DIR || path.join(process.env.HOME || '/tmp', '.coreblow');
    return path.join(stateDir, 'canvas');
}

// ─── MIME Detection ─────────────────────────────────────────────────

const MIME_MAP: Record<string, string> = {
    '.html': 'text/html',
    '.htm': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.txt': 'text/plain',
    '.xml': 'application/xml',
    '.pdf': 'application/pdf',
    '.wasm': 'application/wasm',
};

function detectMime(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    return MIME_MAP[ext] ?? 'application/octet-stream';
}

// ─── Canvas Host Handler ────────────────────────────────────────────

export async function createCanvasHostHandler(
    opts: CanvasHostOpts,
): Promise<CanvasHostHandler> {
    const basePath = normalizeBasePath(opts.basePath);

    if (isDisabledByEnv()) {
        return {
            rootDir: '',
            basePath,
            handleHttpRequest: async () => false,
            handleUpgrade: () => false,
            close: async () => {},
        };
    }

    const rootDir = opts.rootDir ?? resolveDefaultCanvasRoot();
    const rootReal = await prepareCanvasRoot(rootDir);
    const liveReload = opts.liveReload !== false;

    const WebSocketServerClass = opts.webSocketServerClass ?? WebSocketServer;
    const wss = liveReload ? new WebSocketServerClass({ noServer: true }) : null;
    const sockets = new Set<WebSocket>();

    if (wss) {
        wss.on('connection', (ws: WebSocket) => {
            sockets.add(ws);
            ws.on('close', () => sockets.delete(ws));
        });
    }

    // Live reload using native fs.watch (no chokidar needed)
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const broadcastReload = () => {
        if (!liveReload) return;
        for (const ws of sockets) {
            try { ws.send('reload'); } catch { /* ignore */ }
        }
    };
    const scheduleReload = () => {
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(() => {
            debounce = null;
            broadcastReload();
        }, 100);
    };

    let watcher: fsSync.FSWatcher | null = null;
    if (liveReload) {
        try {
            watcher = fsSync.watch(rootReal, { recursive: true }, (eventType, filename) => {
                if (filename && !filename.startsWith('.') && !filename.includes('node_modules')) {
                    scheduleReload();
                }
            });
            watcher.on('error', () => {
                log.debug('Canvas file watcher error (live reload may be limited)');
            });
        } catch {
            log.debug('Could not start canvas file watcher');
        }
    }

    // WebSocket upgrade handler
    const handleUpgrade = (req: IncomingMessage, socket: Duplex, head: Buffer): boolean => {
        if (!wss) return false;
        const url = new URL(req.url ?? '/', 'http://localhost');
        if (url.pathname !== CANVAS_WS_PATH) return false;
        wss.handleUpgrade(req, socket as Socket, head, (ws) => {
            wss.emit('connection', ws, req);
        });
        return true;
    };

    // HTTP request handler
    const handleHttpRequest = async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
        const urlRaw = req.url;
        if (!urlRaw) return false;

        try {
            const url = new URL(urlRaw, 'http://localhost');

            // WS path via HTTP
            if (url.pathname === CANVAS_WS_PATH) {
                res.statusCode = liveReload ? 426 : 404;
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                res.end(liveReload ? 'upgrade required' : 'not found');
                return true;
            }

            // Check basePath match
            let urlPath = url.pathname;
            if (basePath !== '/') {
                if (urlPath !== basePath && !urlPath.startsWith(`${basePath}/`)) {
                    return false;
                }
                urlPath = urlPath === basePath ? '/' : urlPath.slice(basePath.length) || '/';
            }

            if (req.method !== 'GET' && req.method !== 'HEAD') {
                res.statusCode = 405;
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                res.end('Method Not Allowed');
                return true;
            }

            const opened = await resolveFileWithinRoot(rootReal, urlPath);
            if (!opened) {
                if (urlPath === '/' || urlPath.endsWith('/')) {
                    res.statusCode = 404;
                    res.setHeader('Content-Type', 'text/html; charset=utf-8');
                    res.end(
                        `<!doctype html><meta charset="utf-8" /><title>CoreBlow Canvas</title><pre>Missing file.\nCreate ${rootDir}/index.html</pre>`,
                    );
                    return true;
                }
                res.statusCode = 404;
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                res.end('not found');
                return true;
            }

            const mime = detectMime(opened.realPath);
            res.setHeader('Cache-Control', 'no-store');

            if (mime === 'text/html') {
                const html = opened.data.toString('utf8');
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.end(liveReload ? injectCanvasLiveReload(html) : html);
                return true;
            }

            res.setHeader('Content-Type', mime);
            res.end(opened.data);
            return true;
        } catch (err) {
            log.error({ err }, 'Canvas host request failed');
            res.statusCode = 500;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.end('error');
            return true;
        }
    };

    return {
        rootDir,
        basePath,
        handleHttpRequest,
        handleUpgrade,
        close: async () => {
            if (debounce) clearTimeout(debounce);
            if (watcher) watcher.close();
            for (const ws of sockets) {
                try { ws.terminate?.(); } catch { /* ignore */ }
            }
            if (wss) {
                await new Promise<void>((resolve) => wss.close(() => resolve()));
            }
        },
    };
}

// ─── Standalone Canvas Server ───────────────────────────────────────

export async function startCanvasHost(opts: CanvasHostOpts): Promise<CanvasHostServer> {
    if (isDisabledByEnv()) {
        return { port: 0, rootDir: '', close: async () => {} };
    }

    const handler = await createCanvasHostHandler(opts);

    const bindHost = opts.listenHost?.trim() || '127.0.0.1';
    const server: Server = http.createServer((req, res) => {
        if (String(req.headers.upgrade ?? '').toLowerCase() === 'websocket') {
            return;
        }
        void (async () => {
            if (await handleA2uiHttpRequest(req, res)) return;
            if (await handler.handleHttpRequest(req, res)) return;
            res.statusCode = 404;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.end('Not Found');
        })().catch((err) => {
            log.error({ err }, 'Canvas host request failed');
            res.statusCode = 500;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.end('error');
        });
    });

    server.on('upgrade', (req, socket, head) => {
        if (handler.handleUpgrade(req, socket, head)) return;
        socket.destroy();
    });

    const listenPort =
        typeof opts.port === 'number' && Number.isFinite(opts.port) && opts.port > 0 ? opts.port : 0;

    await new Promise<void>((resolve, reject) => {
        const onError = (err: NodeJS.ErrnoException) => {
            server.off('listening', onListening);
            reject(err);
        };
        const onListening = () => {
            server.off('error', onError);
            resolve();
        };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(listenPort, bindHost);
    });

    const addr = server.address();
    const boundPort = typeof addr === 'object' && addr ? addr.port : 0;
    log.info(`Canvas host listening on http://${bindHost}:${boundPort} (root ${handler.rootDir})`);

    return {
        port: boundPort,
        rootDir: handler.rootDir,
        close: async () => {
            await handler.close();
            await new Promise<void>((resolve, reject) =>
                server.close((err) => (err ? reject(err) : resolve())),
            );
        },
    };
}
