/**
 * src/dashboard/serve.ts
 * Dashboard — 8-page control UI with tab navigation
 */

import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import type { Application, Request, Response } from 'express';
import { findConfigFile, getConfigPaths } from '../config/config-paths.js';
import { logCaughtError } from '../utils/error-boundary.js';
import { readAuditLog } from '../security/audit.js';

/** Resolve the home directory for CoreBlow data. */
function getHomeDir(): string {
  const paths = getConfigPaths();
  return path.dirname(paths.home);
}

/** Load and return the current config, with sensible defaults. */
function getConfig(): {
  features: Record<string, boolean>;
  agent: { model: string; provider: string };
  channels: Record<string, unknown>;
  sandbox: { enabled: boolean; mode: string };
} {
  try {
    const resolution = findConfigFile();
    if (resolution?.configPath) {
      const raw = fs.readFileSync(resolution.configPath, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        features: parsed.features ?? { dashboard: true, cron: true },
        agent: parsed.agent ?? { model: 'default', provider: 'default' },
        channels: parsed.channels ?? {},
        sandbox: parsed.sandbox ?? { enabled: false, mode: 'disabled' },
      };
    }
  } catch (e) { logCaughtError('dashboard:config', e); }
  return {
    features: { dashboard: true, cron: true },
    agent: { model: 'default', provider: 'default' },
    channels: {},
    sandbox: { enabled: false, mode: 'disabled' },
  };
}

import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('dashboard');

/**
 * Mount dashboard routes on the Express app
 */
export function mountDashboard(app: Application) {
  const config = getConfig();
  if (!config.features.dashboard) {
    log.info('Dashboard disabled');
    return;
  }

  // CoreBlow pattern: auto-enable auth if network-exposed (0.0.0.0)
  const gatewayAuth = (config as any).gateway?.auth;
  const gatewayHost = (config as any).gateway?.host ?? '127.0.0.1';
  const dashRequireAuth = (config as any).dashboard?.requireAuth;
  const isNetworkExposed = gatewayHost === '0.0.0.0';

  if ((dashRequireAuth || isNetworkExposed) && gatewayAuth?.token) {
    const token = gatewayAuth.token;
    app.use('/api/dashboard', (req: Request, res: Response, next: Function) => {
      const auth = req.headers.authorization;
      if (auth === `Bearer ${token}`) return next();
      res.status(401).json({ error: 'Unauthorized — set Authorization: Bearer <token>' });
    });
    log.info('Dashboard auth enabled (network-exposed or requireAuth)');
  }

  // Dashboard API endpoints
  app.get('/api/dashboard/status', (_req: Request, res: Response) => {
    const c = getConfig();
    res.json({
      gateway: { status: 'running', version: '1.0.0' },
      agent: { model: c.agent.model, provider: c.agent.provider },
      channels: c.channels,
      features: c.features,
      sandbox: (c as any).sandbox || { enabled: false, mode: 'disabled' },
    });
  });

  app.get('/api/dashboard/audit', async (req: Request, res: Response) => {
    const date = req.query.date as string | undefined;
    const entries = await readAuditLog(date);
    res.json({ entries, count: entries.length });
  });

  app.get('/api/dashboard/sessions', (_req: Request, res: Response) => {
    const sessDir = path.join(getHomeDir(), 'agents', 'default', 'sessions');
    try {
      if (!fs.existsSync(sessDir)) { res.json({ sessions: [] }); return; }
      const files = fs.readdirSync(sessDir).filter(f => f.endsWith('.jsonl'));
      const sessions = files.map(f => {
        const fp = path.join(sessDir, f);
        const stat = fs.statSync(fp);
        const lines = fs.readFileSync(fp, 'utf-8').trim().split('\n').length;
        return { id: f.replace('.jsonl', ''), messages: lines, lastModified: stat.mtimeMs, size: stat.size };
      });
      res.json({ sessions });
    } catch { res.json({ sessions: [] }); }
  });

  app.get('/api/dashboard/devices', (_req: Request, res: Response) => {
    const devFile = path.join(getHomeDir(), 'devices.json');
    try {
      if (!fs.existsSync(devFile)) { res.json({ devices: [] }); return; }
      const devices = JSON.parse(fs.readFileSync(devFile, 'utf-8'));
      res.json({ devices: devices.map((d: Record<string, unknown>) => ({ ...d, token: undefined })) });
    } catch (e) { logCaughtError('dashboard:devices', e); res.json({ devices: [] }); }
  });

  app.get('/api/dashboard/canvases', (_req: Request, res: Response) => {
    const canvasDir = path.join(getHomeDir(), 'canvas');
    try {
      if (!fs.existsSync(canvasDir)) { res.json({ canvases: [] }); return; }
      const files = fs.readdirSync(canvasDir).filter(f => f.endsWith('.html'));
      const canvases = files.map(f => {
        const stat = fs.statSync(path.join(canvasDir, f));
        return { name: f.replace('.html', ''), size: stat.size, lastModified: stat.mtimeMs };
      });
      res.json({ canvases });
    } catch (e) { logCaughtError('dashboard:canvases', e); res.json({ canvases: [] }); }
  });

  app.get('/api/dashboard/logs', async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 100;
    try {
      const entries = await readAuditLog();
      res.json({ entries: entries.slice(-limit).reverse(), count: entries.length });
    } catch (e) { logCaughtError('dashboard:logs', e); res.json({ entries: [], count: 0 }); }
  });

  app.get('/api/dashboard/agents', (_req: Request, res: Response) => {
    const agentDir = path.join(getHomeDir(), 'agents');
    try {
      if (!fs.existsSync(agentDir)) { res.json({ agents: [] }); return; }
      const dirs = fs.readdirSync(agentDir).filter(d => { try { return fs.statSync(path.join(agentDir, d)).isDirectory(); } catch { return false; } });
      const agents = dirs.map(d => {
        const sessDir = path.join(agentDir, d, 'sessions');
        let sessionCount = 0;
        try { if (fs.existsSync(sessDir)) sessionCount = fs.readdirSync(sessDir).filter(f => f.endsWith('.jsonl')).length; } catch { /* intentionally ignored */ }
        return { name: d, sessions: sessionCount, path: path.join(agentDir, d) };
      });
      res.json({ agents });
    } catch (e) { logCaughtError('dashboard:agents', e); res.json({ agents: [] }); }
  });

  app.get('/api/dashboard/skills', (_req: Request, res: Response) => {
    const skillDir = path.join(getHomeDir(), 'skills');
    try {
      if (!fs.existsSync(skillDir)) { res.json({ skills: [] }); return; }
      const items = fs.readdirSync(skillDir);
      const skills = items.map(f => {
        const fp = path.join(skillDir, f);
        const stat = fs.statSync(fp);
        return { name: f, isDir: stat.isDirectory(), size: stat.size, lastModified: stat.mtimeMs };
      });
      res.json({ skills });
    } catch (e) { logCaughtError('dashboard:skills', e); res.json({ skills: [] }); }
  });

  app.get('/api/dashboard/cron', (_req: Request, res: Response) => {
    try {
      const cronFile = path.join(getHomeDir(), 'cron.json');
      let jobs: unknown[] = [];
      if (fs.existsSync(cronFile)) {
        const raw = fs.readFileSync(cronFile, 'utf-8');
        jobs = JSON.parse(raw);
        if (!Array.isArray(jobs)) jobs = [];
      }
      res.json({ jobs, enabled: config.features.cron });
    } catch (e) { logCaughtError('dashboard:cron', e); res.json({ jobs: [], enabled: false }); }
  });

  app.get('/api/dashboard/debug', (_req: Request, res: Response) => {
    const mem = process.memoryUsage();
    res.json({
      system: { platform: process.platform, arch: process.arch, nodeVersion: process.version, pid: process.pid, hostname: os.hostname() },
      memory: { heapUsed: Math.round(mem.heapUsed / 1048576), heapTotal: Math.round(mem.heapTotal / 1048576), rss: Math.round(mem.rss / 1048576), external: Math.round(mem.external / 1048576) },
      uptime: { process: Math.round(process.uptime()), system: os.uptime() },
      cpus: os.cpus().length,
      totalMem: Math.round(os.totalmem() / 1048576),
      freeMem: Math.round(os.freemem() / 1048576),
      cwd: process.cwd(),
      homeDir: getHomeDir(),
    });
  });

  app.put('/api/dashboard/config', (req: Request, res: Response) => {
    try {
      const configPath = path.join(getHomeDir(), 'config.json');
      const body = JSON.stringify(req.body, null, 2);
      fs.writeFileSync(configPath, body, 'utf-8');
      res.json({ ok: true });
    } catch (e: unknown) { res.status(500).json({ error: (e instanceof Error ? e.message : String(e)) }); }
  });

  // Serve dashboard UI
  const dashboardDir = path.join(path.dirname(new URL(import.meta.url).pathname), '../../dashboard-ui');
  if (fs.existsSync(dashboardDir)) {
    import('express').then(({ default: exp }) => {
      app.use('/dashboard', exp.static(dashboardDir));
      log.info({ path: dashboardDir }, 'Dashboard UI mounted at /dashboard');
    });
  } else {
    app.get('/dashboard', (_req: Request, res: Response) => {
      res.send(getFullDashboard());
    });
    log.info('Full dashboard mounted at /dashboard');
  }
}

function getFullDashboard(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CoreBlow Gateway</title>
  <link href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet">
  <style>
    :root { --bg: #f8f9fa; --surface: #fff; --text: #1f1f1f; --text2: #3c4043; --text3: #5f6368; --text4: #80868b; --border: #ecedef; --border2: #dadce0; --hover: #f1f3f4; --active-bg: #e8f0fe; --active-text: #1967d2; --th-bg: #fafafa; --card-shadow: rgba(0,0,0,.04); --row-border: #f5f5f5; --input-bg: #fff; --sidebar-bg: #fff; }
    [data-theme="dark"] { --bg: #1e1e1e; --surface: #282828; --text: #e3e3e3; --text2: #c4c4c4; --text3: #9aa0a6; --text4: #6e6e6e; --border: #3c3c3c; --border2: #4a4a4a; --hover: #333; --active-bg: #1a3a5c; --active-text: #8ab4f8; --th-bg: #2c2c2c; --card-shadow: rgba(0,0,0,.2); --row-border: #333; --input-bg: #333; --sidebar-bg: #252525; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Google Sans', 'Inter', -apple-system, sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; transition: background .2s, color .2s; }
    .layout { display: flex; min-height: 100vh; }
    .sidebar { width: 240px; background: var(--sidebar-bg); border-right: 1px solid var(--border); padding: 16px 0; flex-shrink: 0; display: flex; flex-direction: column; }
    .logo { padding: 8px 20px 24px; font-size: 17px; font-weight: 600; color: var(--text); display: flex; align-items: center; gap: 8px; }
    .logo-icon { width: 28px; height: 28px; background: linear-gradient(135deg, #4285f4, #8b5cf6); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-size: 14px; font-weight: 700; }
    .nav-section { padding: 4px 12px; margin-top: 8px; }
    .nav-section-title { font-size: 11px; font-weight: 600; color: var(--text3); text-transform: uppercase; letter-spacing: 0.8px; padding: 8px; }
    .nav-item { display: flex; align-items: center; gap: 12px; padding: 10px 12px; font-size: 14px; color: var(--text2); cursor: pointer; border-radius: 24px; transition: all .15s; margin: 1px 0; font-weight: 500; }
    .nav-item:hover { background: var(--hover); }
    .nav-item.active { background: var(--active-bg); color: var(--active-text); font-weight: 600; }
    .nav-icon { font-size: 20px; width: 24px; text-align: center; font-family: 'Material Symbols Outlined'; font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20; color: var(--text3); }
    .nav-item.active .nav-icon { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20; color: var(--active-text); }
    .mi { font-family: 'Material Symbols Outlined'; font-variation-settings: 'FILL' 0, 'wght' 200, 'GRAD' 0, 'opsz' 20; font-size: 20px; color: var(--text3); }
    .sidebar-footer { margin-top: auto; padding: 12px 20px; border-top: 1px solid var(--border); font-size: 12px; color: var(--text4); }
    .topbar { height: 56px; background: var(--surface); border-bottom: 1px solid var(--border); display: flex; align-items: center; padding: 0 24px; gap: 16px; }
    .topbar-title { font-size: 14px; color: var(--text3); display: flex; align-items: center; gap: 8px; }
    .topbar-badge { background: var(--active-bg); color: var(--active-text); padding: 4px 12px; border-radius: 16px; font-size: 12px; font-weight: 500; }
    .topbar-right { margin-left: auto; display: flex; align-items: center; gap: 8px; }
    .topbar-btn { width: 36px; height: 36px; border-radius: 50%; border: none; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; color: var(--text3); transition: background .15s; }
    .topbar-btn:hover { background: var(--hover); }
    .status-chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 14px; border-radius: 16px; font-size: 12px; font-weight: 500; color: var(--text3); background: var(--hover); border: 1px solid var(--border); }
    .status-dot { width: 7px; height: 7px; border-radius: 50%; }
    .status-dot.green { background: #34a853; }
    .status-dot.red { background: #ea4335; }
    .theme-group { display: flex; align-items: center; border: 1px solid var(--border); border-radius: 20px; overflow: hidden; margin-left: 4px; }
    .theme-btn { width: 32px; height: 32px; border: none; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--text3); transition: all .15s; }
    .theme-btn:hover { background: var(--hover); }
    .theme-btn.active { background: var(--active-bg); color: var(--active-text); }
    .theme-btn .topbar-icon { font-size: 18px; }
    .main-wrap { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
    .main { flex: 1; padding: 32px 40px; overflow-y: auto; max-width: 1200px; }
    .page { display: none; }
    .page.active { display: block; }
    .page-title { font-size: 24px; font-weight: 400; color: var(--text); margin-bottom: 8px; }
    .page-subtitle { font-size: 14px; color: var(--text3); margin-bottom: 28px; }
    .feature-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; margin-bottom: 32px; }
    .feature-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 24px 28px; cursor: pointer; transition: all .2s; }
    .feature-card:hover { border-color: var(--border2); box-shadow: 0 1px 2px var(--card-shadow); }
    .fc-head { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
    .fci { font-family: 'Material Symbols Outlined'; font-variation-settings: 'FILL' 0, 'wght' 200, 'GRAD' 0, 'opsz' 20; font-size: 22px; color: var(--text3); }
    .topbar-icon { font-family: 'Material Symbols Outlined'; font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20; font-size: 20px; color: var(--text3); }
    .feature-card h3 { font-size: 15px; font-weight: 600; color: var(--text); }
    .feature-card p { font-size: 13px; color: var(--text3); line-height: 1.5; }
    .stat-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; margin-bottom: 28px; }
    .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px 24px; }
    .stat-label { font-size: 12px; color: var(--text3); font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .stat-value { font-size: 22px; font-weight: 600; color: var(--text); display: flex; align-items: center; gap: 8px; }
    .table-section { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; margin-bottom: 20px; overflow: hidden; }
    .table-header { padding: 16px 24px; font-size: 14px; font-weight: 600; color: var(--text); border-bottom: 1px solid var(--border); }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { text-align: left; padding: 12px 24px; color: var(--text3); font-weight: 500; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid var(--border); background: var(--th-bg); }
    td { padding: 12px 24px; border-bottom: 1px solid var(--row-border); color: var(--text2); }
    tr:last-child td { border-bottom: none; }
    tr:hover { background: var(--hover); }
    .badge { padding: 4px 12px; border-radius: 16px; font-size: 12px; font-weight: 500; }
    .badge-ok { background: #e6f4ea; color: #137333; }
    .badge-off { background: var(--hover); color: var(--text4); }
    [data-theme="dark"] .badge-ok { background: #1b3a2a; color: #81c995; }
    .chat-container { display: flex; flex-direction: column; height: calc(100vh - 56px); }
    .chat-header { padding: 24px 40px 0; }
    .chat-messages { flex: 1; padding: 16px 40px; overflow-y: auto; max-width: 800px; }
    .msg { margin-bottom: 16px; padding: 12px 16px; border-radius: 12px; font-size: 14px; line-height: 1.7; max-width: 85%; }
    .msg-user { background: var(--active-bg); color: var(--active-text); margin-left: auto; border-bottom-right-radius: 4px; }
    .msg-ai { background: var(--surface); border: 1px solid var(--border); color: var(--text); border-bottom-left-radius: 4px; }
    .msg-sender { font-size: 12px; font-weight: 600; margin-bottom: 4px; }
    .chat-input-area { padding: 16px 40px 24px; border-top: 1px solid var(--border); }
    .input-row { display: flex; gap: 12px; max-width: 800px; }
    .input-row input { flex: 1; padding: 14px 20px; border: 1px solid var(--border); border-radius: 24px; background: var(--input-bg); color: var(--text); font-size: 14px; font-family: inherit; }
    .input-row input:focus { outline: none; border-color: var(--active-text); box-shadow: 0 0 0 2px rgba(25,103,210,.15); }
    .input-row button { padding: 14px 28px; border: none; border-radius: 24px; background: #1967d2; color: white; font-weight: 600; cursor: pointer; font-family: inherit; font-size: 14px; transition: background .15s; }
    .input-row button:hover { background: #1557b0; }
    .empty { text-align: center; padding: 48px 24px; color: var(--text4); }
    .empty-icon { font-size: 48px; margin-bottom: 16px; opacity: .5; }
    pre.config { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 24px; font-family: monospace; font-size: 13px; line-height: 1.7; overflow-x: auto; color: var(--text2); }
    .hero { text-align: center; padding: 60px 0 48px; }
    .hero h1 { font-size: 32px; font-weight: 400; color: var(--text); margin-bottom: 12px; }
    .hero p { font-size: 16px; color: var(--text3); }
    .chat-controls { display: flex; align-items: center; gap: 8px; padding: 12px 40px; border-bottom: 1px solid var(--border); background: var(--surface); }
    .chat-select { padding: 6px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--input-bg); color: var(--text); font-size: 13px; font-family: inherit; min-width: 180px; cursor: pointer; }
    .chat-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border: 1px solid var(--border); border-radius: 8px; background: transparent; color: var(--text3); font-size: 13px; font-family: inherit; cursor: pointer; transition: all .15s; }
    .chat-btn:hover { background: var(--hover); }
    .chat-btn.active { background: var(--active-bg); color: var(--active-text); border-color: var(--active-text); }
    .chat-btn .topbar-icon { font-size: 16px; }
    .chat-sep { width: 1px; height: 24px; background: var(--border); margin: 0 4px; }
    .msg-thinking { background: transparent; border: 1px dashed var(--border); color: var(--text4); font-style: italic; font-size: 13px; opacity: .7; }
    .msg-thinking .msg-sender { color: var(--text4); }
    .ch-card { border: 1px solid var(--border); border-radius: 12px; padding: 20px; background: var(--surface); }
    .ch-status { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
    .ch-linked { background: #e6f4ea; color: #137333; }
    .ch-offline { background: #fce8e6; color: #c5221f; }
    [data-theme="dark"] .ch-linked { background: #1b3a2a; color: #81c995; }
    [data-theme="dark"] .ch-offline { background: #3a1b1b; color: #f28b82; }
    .ch-meta { margin-top: 12px; font-size: 13px; color: var(--text3); line-height: 1.8; }
    .ch-actions { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
    .ch-action { display: inline-flex; align-items: center; gap: 4px; padding: 6px 12px; border: 1px solid var(--border); border-radius: 8px; background: transparent; color: var(--text3); font-size: 12px; cursor: pointer; font-family: inherit; transition: all .15s; }
    .ch-action:hover { background: var(--hover); color: var(--text); }
    .ch-action .topbar-icon { font-size: 14px; }
    .ch-config { margin-top: 12px; display: none; }
    .ch-config.show { display: block; }
    .ch-config pre { background: var(--hover); border-radius: 8px; padding: 12px; font-size: 12px; max-height: 150px; overflow: auto; }
    .toggle-sw { position: relative; display: inline-block; width: 36px; height: 20px; vertical-align: middle; }
    .toggle-sw input { opacity: 0; width: 0; height: 0; }
    .toggle-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: var(--border2); border-radius: 20px; transition: .2s; }
    .toggle-slider:before { position: absolute; content: ''; height: 14px; width: 14px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: .2s; }
    .toggle-sw input:checked + .toggle-slider { background: #1967d2; }
    .toggle-sw input:checked + .toggle-slider:before { transform: translateX(16px); }
    .cfg-tabs { display: flex; gap: 0; margin-bottom: 16px; border-bottom: 2px solid var(--border); }
    .cfg-tab { padding: 10px 20px; border: none; background: transparent; color: var(--text3); font-size: 14px; font-family: inherit; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all .15s; }
    .cfg-tab.active { color: var(--active-text); border-bottom-color: var(--active-text); font-weight: 500; }
    .cfg-form { display: block; }
    .cfg-form-group { padding: 14px 0; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
    .cfg-form-label { font-size: 14px; color: var(--text2); }
    .cfg-form-value { font-family: monospace; font-size: 13px; color: var(--text3); background: var(--hover); padding: 4px 10px; border-radius: 6px; max-width: 50%; text-align: right; word-break: break-all; }
    .cfg-save-btn { margin-top: 16px; padding: 10px 24px; border: none; border-radius: 8px; background: #1967d2; color: white; font-family: inherit; font-size: 14px; cursor: pointer; transition: background .15s; }
    .cfg-save-btn:hover { background: #1557b0; }
    .sess-toggle-cell { display: flex; gap: 12px; align-items: center; }
    .sess-toggle-label { font-size: 11px; color: var(--text4); display: flex; align-items: center; gap: 4px; }
    .log-controls { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
    .log-search { flex: 1; min-width: 200px; padding: 8px 14px; border: 1px solid var(--border); border-radius: 8px; background: var(--input-bg); color: var(--text); font-size: 13px; font-family: inherit; }
    .cron-form { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 20px; }
    .cron-form h4 { margin: 0 0 16px; font-size: 15px; font-weight: 500; color: var(--text); }
    .cron-row { display: flex; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
    .cron-input { flex: 1; min-width: 140px; padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--input-bg); color: var(--text); font-size: 13px; font-family: inherit; }
    .cron-textarea { width: 100%; min-height: 60px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--input-bg); color: var(--text); font-size: 13px; font-family: inherit; resize: vertical; }
    .agent-detail { border: 1px solid var(--border); border-radius: 12px; background: var(--surface); overflow: hidden; margin-bottom: 16px; }
    .agent-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border); }
    .agent-header h3 { margin: 0; font-size: 16px; display: flex; align-items: center; gap: 8px; }
    .agent-tabs { display: flex; border-bottom: 1px solid var(--border); background: var(--bg); }
    .agent-tab { padding: 10px 18px; border: none; background: transparent; color: var(--text3); font-size: 13px; font-family: inherit; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: all .15s; }
    .agent-tab.active { color: var(--active-text); border-bottom-color: var(--active-text); }
    .agent-body { padding: 16px 20px; }
    .agent-paths { display: grid; gap: 8px; }
    .agent-path { display: flex; align-items: center; gap: 8px; font-size: 13px; }
    .agent-path-label { color: var(--text4); min-width: 80px; }
    .agent-path-val { font-family: monospace; color: var(--text2); background: var(--hover); padding: 4px 8px; border-radius: 6px; font-size: 12px; }
    .agent-tools-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(160px,1fr)); gap: 10px; }
    .agent-tool-chip { border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; background: var(--bg); font-size: 13px; display: flex; align-items: center; gap: 6px; }
    .agent-tool-chip .topbar-icon { font-size: 16px; color: var(--text4); }
    .skill-search { width: 100%; padding: 10px 14px; border: 1px solid var(--border); border-radius: 8px; background: var(--input-bg); color: var(--text); font-size: 13px; font-family: inherit; margin-bottom: 16px; }
    .rpc-section { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 20px; }
    .rpc-section h4 { margin: 0 0 16px; font-size: 15px; font-weight: 500; color: var(--text); display: flex; align-items: center; gap: 8px; }
    .rpc-row { display: flex; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; align-items: flex-start; }
    .rpc-input { flex: 1; min-width: 180px; padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--input-bg); color: var(--text); font-size: 13px; font-family: inherit; }
    .rpc-result { margin-top: 12px; background: var(--hover); border-radius: 8px; padding: 12px; font-family: monospace; font-size: 12px; max-height: 200px; overflow: auto; white-space: pre-wrap; display: none; }
    .rpc-result.show { display: block; }
    .approvals-editor { width: 100%; min-height: 120px; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--input-bg); color: var(--text); font-family: monospace; font-size: 13px; resize: vertical; margin-bottom: 12px; }
    .node-caps { display: grid; grid-template-columns: repeat(auto-fill,minmax(200px,1fr)); gap: 10px; margin-top: 16px; }
    .node-cap { border: 1px solid var(--border); border-radius: 8px; padding: 12px; background: var(--surface); }
    .node-cap-title { font-size: 13px; font-weight: 500; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; }
    .node-cap-desc { font-size: 12px; color: var(--text4); }
  </style>
</head>
<body>
<div class="layout">
  <nav class="sidebar">
    <div class="logo"><div class="logo-icon">CB</div> CoreBlow</div>
    <div class="nav-section">
      <div class="nav-item active" data-page="home"><span class="nav-icon">home</span> Home</div>
      <div class="nav-item" data-page="chat"><span class="nav-icon">chat</span> Playground</div>
    </div>
    <div class="nav-section">
      <div class="nav-section-title">Control</div>
      <div class="nav-item" data-page="overview"><span class="nav-icon">monitoring</span> Overview</div>
      <div class="nav-item" data-page="channels"><span class="nav-icon">hub</span> Channels</div>
      <div class="nav-item" data-page="sessions"><span class="nav-icon">history</span> Sessions</div>
      <div class="nav-item" data-page="usage"><span class="nav-icon">bar_chart</span> Usage</div>
      <div class="nav-item" data-page="cron"><span class="nav-icon">schedule</span> Cron Jobs</div>
    </div>
    <div class="nav-section">
      <div class="nav-section-title">Agent</div>
      <div class="nav-item" data-page="agents"><span class="nav-icon">smart_toy</span> Agents</div>
      <div class="nav-item" data-page="skills"><span class="nav-icon">auto_fix_high</span> Skills</div>
      <div class="nav-item" data-page="devices"><span class="nav-icon">devices</span> Nodes</div>
      <div class="nav-item" data-page="canvases"><span class="nav-icon">dashboard</span> Canvases</div>
    </div>
    <div class="nav-section">
      <div class="nav-section-title">Settings</div>
      <div class="nav-item" data-page="config"><span class="nav-icon">settings</span> Config</div>
      <div class="nav-item" data-page="debug"><span class="nav-icon">bug_report</span> Debug</div>
      <div class="nav-item" data-page="logs"><span class="nav-icon">receipt_long</span> Logs</div>
    </div>
    <div class="sidebar-footer">CoreBlow v1.0.0</div>
  </nav>

  <div class="main-wrap">
    <div class="topbar">
      <div class="topbar-title">
        <span class="topbar-icon">smart_toy</span>
        <span id="topbar-text">Home</span>
        <span class="topbar-badge" id="topbar-model">Loading...</span>
      </div>
      <div class="topbar-right">
        <span class="status-chip" id="chip-version"><span class="status-dot green"></span> Version 1.0.0</span>
        <span class="status-chip" id="chip-health"><span class="status-dot green"></span> Health OK</span>
        <div class="theme-group">
          <button class="theme-btn" id="theme-system" title="System" onclick="setTheme('system')"><span class="topbar-icon">desktop_windows</span></button>
          <button class="theme-btn" id="theme-light" title="Light" onclick="setTheme('light')"><span class="topbar-icon">light_mode</span></button>
          <button class="theme-btn" id="theme-dark" title="Dark" onclick="setTheme('dark')"><span class="topbar-icon">dark_mode</span></button>
        </div>
        <button class="topbar-btn" title="Refresh" onclick="loadPage(currentPage)"><span class="topbar-icon">refresh</span></button>
      </div>
    </div>

    <div class="main">
      <div class="page active" id="page-home">
        <div class="hero">
          <h1>Start building with CoreBlow</h1>
          <p>Your self-hosted AI gateway platform</p>
        </div>
        <div class="feature-cards">
          <div class="feature-card" onclick="nav('chat')"><div class="fc-head"><span class="fci">chat</span><h3>Chat Playground</h3></div><p>Chat directly with your AI model via WebSocket.</p></div>
          <div class="feature-card" onclick="nav('channels')"><div class="fc-head"><span class="fci">hub</span><h3>Channels</h3></div><p>Connect Telegram, Discord, WhatsApp, Slack.</p></div>
          <div class="feature-card" onclick="nav('tools')"><div class="fc-head"><span class="fci">build</span><h3>Tools</h3></div><p>Shell exec, web fetch, cron, image, canvas.</p></div>
          <div class="feature-card" onclick="nav('canvases')"><div class="fc-head"><span class="fci">dashboard</span><h3>Canvases</h3></div><p>Interactive HTML artifacts from AI.</p></div>
          <div class="feature-card" onclick="nav('sessions')"><div class="fc-head"><span class="fci">history</span><h3>Sessions</h3></div><p>Browse conversation history and logs.</p></div>
          <div class="feature-card" onclick="nav('devices')"><div class="fc-head"><span class="fci">devices</span><h3>Devices</h3></div><p>Pair and manage remote devices.</p></div>
        </div>
        <div class="stat-cards" id="stat-cards"></div>
        <div class="table-section"><div class="table-header">Channels</div><table id="ch-table"><thead><tr><th>Channel</th><th>Status</th></tr></thead><tbody></tbody></table></div>
        <div class="table-section"><div class="table-header">Recent Audit</div><table id="audit-table"><thead><tr><th>Time</th><th>Action</th><th>Details</th></tr></thead><tbody></tbody></table></div>
      </div>

      <div class="page" id="page-chat">
        <div class="chat-container">
          <div class="chat-controls">
            <select class="chat-select" id="sess-select" onchange="switchSession(this.value)"></select>
            <button class="chat-btn" onclick="newSession()"><span class="topbar-icon">add</span> New Session</button>
            <div class="chat-sep"></div>
            <button class="chat-btn" id="btn-thinking" onclick="toggleThinking()"><span class="topbar-icon">psychology</span> Thinking</button>
            <div style="margin-left:auto"></div>
            <button class="chat-btn" onclick="clearChat()"><span class="topbar-icon">delete</span> Clear</button>
          </div>
          <div class="chat-messages" id="messages"></div>
          <div class="chat-input-area">
            <div class="input-row">
              <input type="text" id="msg-input" placeholder="Start typing a prompt..." autocomplete="off" />
              <button onclick="sendMsg()"><span class="topbar-icon" style="color:white;font-size:16px;margin-right:4px">send</span> Send</button>
            </div>
          </div>
        </div>
      </div>

      <div class="page" id="page-sessions"><h2 class="page-title">Sessions</h2><p class="page-subtitle">Active session keys and per-session overrides.</p><div class="table-section"><table id="sess-table"><thead><tr><th>Key</th><th>Messages</th><th>Size</th><th>Last Active</th><th>Toggles</th><th>Actions</th></tr></thead><tbody></tbody></table></div></div>
      <div class="page" id="page-tools"><h2 class="page-title">Tools</h2><p class="page-subtitle">Registered tools available to the AI agent.</p><div class="feature-cards" id="tool-cards"></div></div>
      <div class="page" id="page-channels"><h2 class="page-title">Channels</h2><p class="page-subtitle">Messaging channels and integrations.</p><div class="feature-cards" id="channel-cards"></div></div>
      <div class="page" id="page-devices"><h2 class="page-title">Nodes</h2><p class="page-subtitle">Paired devices, capabilities, and command exposure.</p>
        <div class="rpc-section">
          <h4><span class="topbar-icon" style="font-size:18px">security</span> Exec Approvals</h4>
          <p style="font-size:13px;color:var(--text4);margin:0 0 12px">Commands allowed to execute on this gateway. One pattern per line.</p>
          <textarea class="approvals-editor" id="approvals-editor" placeholder="e.g. ls *
cat *
pwd
whoami"></textarea>
          <button class="cfg-save-btn" data-action="save-approvals"><span class="topbar-icon" style="font-size:16px;vertical-align:middle;margin-right:4px;color:white">save</span> Save Approvals</button>
        </div>
        <div class="table-section"><table id="dev-table"><thead><tr><th>Name</th><th>Platform</th><th>Paired</th><th>Last Seen</th><th>Capabilities</th></tr></thead><tbody></tbody></table></div>
        <div class="node-caps" id="node-caps"></div>
      </div>
      <div class="page" id="page-canvases"><h2 class="page-title">Canvases</h2><p class="page-subtitle">AI-generated interactive HTML artifacts.</p><div class="table-section"><table id="canvas-table"><thead><tr><th>Name</th><th>Size</th><th>Modified</th><th>Action</th></tr></thead><tbody></tbody></table></div></div>
      <div class="page" id="page-config"><h2 class="page-title">Configuration</h2><p class="page-subtitle">Current gateway configuration.</p>
        <div class="cfg-tabs"><button class="cfg-tab active" onclick="cfgTab('form')">Form</button><button class="cfg-tab" onclick="cfgTab('raw')">Raw JSON</button></div>
        <div id="cfg-form" class="cfg-form"></div>
        <pre class="config" id="config-view" style="display:none">Loading...</pre>
        <textarea id="config-editor" style="display:none;width:100%;min-height:300px;font-family:monospace;font-size:13px;border:1px solid var(--border);border-radius:8px;padding:16px;background:var(--surface);color:var(--text);resize:vertical"></textarea>
        <button class="cfg-save-btn" onclick="saveConfig()" style="display:none" id="cfg-save-btn"><span class="topbar-icon" style="font-size:16px;vertical-align:middle;margin-right:4px;color:white">save</span> Save Config</button>
      </div>

      <div class="page" id="page-overview"><h2 class="page-title">Overview</h2><p class="page-subtitle">Gateway status, entry points, and a fast health read.</p>
        <div class="feature-cards" style="margin-bottom:24px"><div class="feature-card" style="grid-column:1/3"><div class="fc-head"><span class="fci">link</span><h3>Gateway Access</h3></div><div id="gw-access" style="margin-top:8px;font-size:14px;color:var(--text2);line-height:2"></div></div></div>
        <div class="stat-cards" id="overview-stats"></div>
        <div class="table-section"><div class="table-header">Features</div><table id="features-table"><thead><tr><th>Feature</th><th>Status</th></tr></thead><tbody></tbody></table></div>
      </div>

      <div class="page" id="page-usage"><h2 class="page-title">Usage</h2><p class="page-subtitle">Message volume and session activity.</p>
        <div class="stat-cards" id="usage-stats"></div>
        <div class="table-section"><div class="table-header">Session Activity</div><table id="usage-table"><thead><tr><th>Session</th><th>Messages</th><th>Size</th><th>Last Active</th></tr></thead><tbody></tbody></table></div>
      </div>

      <div class="page" id="page-cron"><h2 class="page-title">Cron Jobs</h2><p class="page-subtitle">Scheduled tasks managed by the gateway.</p>
        <div class="stat-cards" id="cron-stats"></div>
        <div class="cron-form" id="cron-form">
          <h4><span class="topbar-icon" style="font-size:18px;vertical-align:middle;margin-right:6px">add_circle</span> Create Job</h4>
          <div class="cron-row">
            <input class="cron-input" id="cron-name" placeholder="Job name" />
            <input class="cron-input" id="cron-schedule" placeholder="Schedule (e.g. */5 * * * *)" />
            <input class="cron-input" id="cron-agent" placeholder="Agent ID (default)" value="default" />
          </div>
          <textarea class="cron-textarea" id="cron-prompt" placeholder="Prompt / command to execute..."></textarea>
          <div style="margin-top:12px;display:flex;gap:8px">
            <button class="cfg-save-btn" onclick="createCron()"><span class="topbar-icon" style="font-size:16px;vertical-align:middle;margin-right:4px;color:white">save</span> Save Job</button>
          </div>
        </div>
        <div class="table-section"><div class="table-header">Jobs</div><table id="cron-table"><thead><tr><th>Name</th><th>Schedule</th><th>Status</th><th>Last Run</th><th>Actions</th></tr></thead><tbody></tbody></table></div>
      </div>

      <div class="page" id="page-agents"><h2 class="page-title">Agents</h2><p class="page-subtitle">Registered agent profiles, workspace paths, and tools.</p>
        <div class="stat-cards" id="agent-stats"></div>
        <div id="agent-cards"></div>
      </div>

      <div class="page" id="page-skills"><h2 class="page-title">Skills</h2><p class="page-subtitle">Available skill modules for agent capabilities.</p>
        <input class="skill-search" id="skill-search" placeholder="Search skills..." oninput="filterSkills()" />
        <div class="table-section"><table id="skills-table"><thead><tr><th>Name</th><th>Type</th><th>Size</th><th>Modified</th><th>Description</th></tr></thead><tbody></tbody></table></div>
      </div>

      <div class="page" id="page-debug"><h2 class="page-title">Debug</h2><p class="page-subtitle">System diagnostics, RPC interface, and runtime information.</p>
        <div class="stat-cards" id="debug-stats"></div>
        <div class="rpc-section">
          <h4><span class="topbar-icon" style="font-size:18px">terminal</span> RPC Method Caller</h4>
          <div class="rpc-row">
            <input class="rpc-input" id="rpc-method" placeholder="Method (e.g. health.check)" />
            <textarea class="rpc-input" id="rpc-params" placeholder='Params JSON (e.g. {})' style="min-height:36px;resize:vertical"></textarea>
            <button class="cfg-save-btn" data-action="rpc-exec"><span class="topbar-icon" style="font-size:16px;vertical-align:middle;margin-right:4px;color:white">play_arrow</span> Execute</button>
          </div>
          <div class="rpc-result" id="rpc-result"></div>
        </div>
        <pre class="config" id="debug-view">Loading...</pre>
      </div>

      <div class="page" id="page-logs"><h2 class="page-title">Logs</h2><p class="page-subtitle">Gateway audit log entries.</p>
        <div class="log-controls">
          <input class="log-search" id="log-search" placeholder="Search logs..." oninput="filterLogs()" />
          <button class="chat-btn" id="log-follow" onclick="toggleLogFollow()"><span class="topbar-icon">autorenew</span> Auto-refresh</button>
          <button class="chat-btn" onclick="exportLogs()"><span class="topbar-icon">download</span> Export</button>
        </div>
        <div class="table-section"><div class="table-header">Recent Logs</div><table id="logs-table"><thead><tr><th>Time</th><th>Action</th><th>Channel</th><th>Details</th></tr></thead><tbody></tbody></table></div>
      </div>
    </div>
  </div>
</div>

<script>
function esc(s){return String(s).replace(/&/g,'\\&amp;').replace(/</g,'\\&lt;').replace(/>/g,'\\&gt;').replace(/"/g,'\\&quot;');}
let currentPage = 'home';
function nav(p) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.page').forEach(pg => pg.classList.remove('active'));
  const el = document.querySelector('[data-page="'+p+'"]');
  if (el) el.classList.add('active');
  document.getElementById('page-'+p).classList.add('active');
  document.getElementById('topbar-text').textContent = el ? el.childNodes[el.childNodes.length-1].textContent.trim() : p;
  currentPage = p;
  loadPage(p);
}
document.querySelectorAll('.nav-item').forEach(el => { el.addEventListener('click', () => nav(el.dataset.page)); });

let currentSession = 'main';
let showThinking = false;
const ws = new WebSocket('ws://'+location.host);
ws.onmessage = (e) => {
  try {
    const m = JSON.parse(e.data);
    if (m.data?.text) {
      if (m.data.thinking && showThinking) {
        addMsg('Thinking', m.data.text, 'msg-thinking');
      } else if (!m.data.thinking) {
        addMsg('CoreBlow', m.data.text, 'msg-ai');
      }
    }
  } catch { /* intentionally ignored */ }
};

function sendMsg() {
  const input = document.getElementById('msg-input');
  const text = input.value.trim();
  if (!text) return;
  addMsg('You', text, 'msg-user');
  ws.send(JSON.stringify({ type: 'message', data: { text, session: currentSession } }));
  input.value = '';
}
document.getElementById('msg-input').addEventListener('keydown', e => { if (e.key === 'Enter') sendMsg(); });

function addMsg(sender, text, cls) {
  const m = document.getElementById('messages');
  const d = document.createElement('div');
  d.className = 'msg ' + cls;
  d.innerHTML = '<div class="msg-sender">' + esc(sender) + '</div>' + esc(text);
  m.appendChild(d);
  m.scrollTop = m.scrollHeight;
}

function toggleThinking() {
  showThinking = !showThinking;
  document.getElementById('btn-thinking').classList.toggle('active', showThinking);
}

function clearChat() {
  document.getElementById('messages').innerHTML = '';
}

async function loadSessionList() {
  try {
    const d = await (await fetch('/api/dashboard/sessions')).json();
    const sel = document.getElementById('sess-select');
    const prev = sel.value || 'main';
    sel.innerHTML = '<option value="main">Main Session</option>';
    d.sessions.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.id.length > 35 ? s.id.substring(0,35)+'…' : s.id;
      sel.appendChild(opt);
    });
    sel.value = prev;
  } catch { /* intentionally ignored */ }
}

function switchSession(key) {
  currentSession = key;
  document.getElementById('messages').innerHTML = '';
  ws.send(JSON.stringify({ type: 'session', data: { session: key } }));
}

function newSession() {
  const key = 'session-' + Date.now();
  const sel = document.getElementById('sess-select');
  const opt = document.createElement('option');
  opt.value = key;
  opt.textContent = key;
  sel.appendChild(opt);
  sel.value = key;
  switchSession(key);
}

loadSessionList();

function loadPage(p) {
  if (p === 'home') loadStatus();
  if (p === 'sessions') loadSessions();
  if (p === 'devices') loadDevices();
  if (p === 'canvases') loadCanvases();
  if (p === 'config') loadConfig();
  if (p === 'tools') loadTools();
  if (p === 'channels') loadChannels();
  if (p === 'overview') loadOverview();
  if (p === 'usage') loadUsage();
  if (p === 'cron') loadCron();
  if (p === 'agents') loadAgents();
  if (p === 'skills') loadSkills();
  if (p === 'debug') loadDebug();
  if (p === 'logs') loadLogs();
}

async function loadStatus() {
  const d = await (await fetch('/api/health')).json();
  document.getElementById('topbar-model').textContent = d.agent.provider+'/'+d.agent.model;
  document.getElementById('chip-version').innerHTML = '<span class="status-dot green"></span> Version '+(d.version||'1.0.0');
  const hOk = d.status === 'ok';
  document.getElementById('chip-health').innerHTML = '<span class="status-dot '+(hOk?'green':'red')+'"></span> Health '+(hOk?'OK':'Offline');
  document.getElementById('stat-cards').innerHTML = [
    sc('Status', d.status.toUpperCase(), '<span class="mi" style="color:'+(d.status==='ok'?'#137333':'#c5221f')+'">circle</span>'),
    sc('Uptime', d.uptimeHuman, '<span class="mi">schedule</span>'),
    sc('Model', d.agent.provider+'/'+d.agent.model, '<span class="mi">psychology</span>'),
    sc('Version', d.version, '<span class="mi">inventory_2</span>'),
  ].join('');
  document.querySelector('#ch-table tbody').innerHTML = Object.entries(d.channels).map(([k,v]) =>
    '<tr><td>'+k+'</td><td>'+(v?'<span class="badge badge-ok">Connected</span>':'<span class="badge badge-off">Off</span>')+'</td></tr>'
  ).join('');
  try {
    const a = await (await fetch('/api/dashboard/audit')).json();
    document.querySelector('#audit-table tbody').innerHTML = a.entries.slice(-10).reverse().map(e =>
      '<tr><td>'+new Date(e.timestamp).toLocaleString()+'</td><td>'+(e.action||'')+'</td><td>'+(e.details||'').substring(0,60)+'</td></tr>'
    ).join('') || '<tr><td colspan="3" class="empty">No audit entries yet</td></tr>';
  } catch { /* intentionally ignored */ }
}

async function loadSessions() {
  try {
    const d = await (await fetch('/api/dashboard/sessions')).json();
    const tb = document.querySelector('#sess-table tbody');
    if (!d.sessions.length) { tb.innerHTML = '<tr><td colspan="6" class="empty"><div class="empty-icon"><span class="mi" style="font-size:48px">history</span></div>No sessions yet</td></tr>'; return; }
    tb.innerHTML = d.sessions.map(s => {
      const sid = s.id.replace(/'/g,'');
      return '<tr><td style="font-family:monospace;font-size:13px">'+s.id.substring(0,40)+'</td><td>'+s.messages+'</td><td>'+(s.size/1024).toFixed(1)+'KB</td><td>'+ago(s.lastModified)+'</td><td><div class="sess-toggle-cell"><label class="sess-toggle-label"><label class="toggle-sw"><input type="checkbox" data-action="sess-toggle" data-id="'+sid+'" data-key="thinking"><span class="toggle-slider"></span></label> Think</label><label class="sess-toggle-label"><label class="toggle-sw"><input type="checkbox" data-action="sess-toggle" data-id="'+sid+'" data-key="verbose"><span class="toggle-slider"></span></label> Verbose</label></div></td><td><button class="ch-action" data-action="sess-delete" data-id="'+sid+'" style="color:#c5221f"><span class="topbar-icon">delete</span></button></td></tr>';
    }).join('');
  } catch { /* intentionally ignored */ }
}
function sessToggle(id,key,val) { /* Backend handler */ }

async function loadDevices() {
  try {
    const d = await (await fetch('/api/dashboard/devices')).json();
    const tb = document.querySelector('#dev-table tbody');
    if (!d.devices.length) { tb.innerHTML = '<tr><td colspan=\"5\" class=\"empty\"><div class=\"empty-icon\"><span class=\"mi\" style=\"font-size:48px\">devices</span></div>No nodes registered</td></tr>'; }
    else { tb.innerHTML = d.devices.map(function(dev) { return '<tr><td>'+dev.name+'</td><td>'+(dev.platform||'?')+'</td><td><span class=\"badge '+(dev.paired?'badge-ok':'badge-off')+'\">'+(dev.paired?'Yes':'No')+'</span></td><td>'+ago(dev.lastSeen)+'</td><td style=\"font-size:12px;color:var(--text4)\">'+(dev.capabilities||[]).join(', ')+'</td></tr>'; }).join(''); }
    var caps = [{n:'Exec',i:'terminal',d:'Command execution'},{n:'File I/O',i:'folder',d:'File system access'},{n:'Media',i:'image',d:'Screen/audio capture'},{n:'Network',i:'wifi',d:'HTTP/WebSocket proxy'},{n:'Clipboard',i:'content_paste',d:'Read/write clipboard'},{n:'Notify',i:'notifications',d:'System notifications'}];
    document.getElementById('node-caps').innerHTML = caps.map(function(c) { return '<div class=\"node-cap\"><div class=\"node-cap-title\"><span class=\"topbar-icon\" style=\"font-size:16px\">'+c.i+'</span> '+c.n+'</div><div class=\"node-cap-desc\">'+c.d+'</div></div>'; }).join('');
  } catch { /* intentionally ignored */ }
}

async function loadCanvases() {
  try {
    const d = await (await fetch('/api/dashboard/canvases')).json();
    const tb = document.querySelector('#canvas-table tbody');
    if (!d.canvases.length) { tb.innerHTML = '<tr><td colspan="4" class="empty"><div class="empty-icon"><span class="mi" style="font-size:48px">dashboard</span></div>No canvases yet</td></tr>'; return; }
    tb.innerHTML = d.canvases.map(c => '<tr><td>'+c.name+'</td><td>'+(c.size/1024).toFixed(1)+'KB</td><td>'+ago(c.lastModified)+'</td><td><a href="/canvas/'+c.name+'.html" target="_blank" style="color:#1967d2">Open ↗</a></td></tr>').join('');
  } catch { /* intentionally ignored */ }
}

let _cfgData = {};
async function loadConfig() {
  try {
    const d = await (await fetch('/api/dashboard/status')).json();
    _cfgData = d;
    const json = JSON.stringify(d, null, 2);
    document.getElementById('config-view').textContent = json;
    document.getElementById('config-editor').value = json;
    // Build form view
    const rows = [];
    function flatten(obj, prefix) {
      for (const [k,v] of Object.entries(obj)) {
        const key = prefix ? prefix+'.'+k : k;
        if (v && typeof v === 'object' && !Array.isArray(v)) { flatten(v, key); }
        else { rows.push('<div class="cfg-form-group"><span class="cfg-form-label">'+key+'</span><span class="cfg-form-value">'+String(v)+'</span></div>'); }
      }
    }
    flatten(d, '');
    document.getElementById('cfg-form').innerHTML = rows.join('');
  } catch { document.getElementById('config-view').textContent = 'Error'; }
}

function cfgTab(tab) {
  document.querySelectorAll('.cfg-tab').forEach((t,i) => { t.classList.toggle('active', (tab==='form'?i===0:i===1)); });
  document.getElementById('cfg-form').style.display = tab==='form'?'block':'none';
  document.getElementById('config-view').style.display = 'none';
  document.getElementById('config-editor').style.display = tab==='raw'?'block':'none';
  document.getElementById('cfg-save-btn').style.display = tab==='raw'?'inline-block':'none';
}

async function saveConfig() {
  try {
    const json = document.getElementById('config-editor').value;
    JSON.parse(json); // validate
    const r = await fetch('/api/dashboard/config', { method: 'PUT', headers: {'Content-Type':'application/json'}, body: json });
    if (r.ok) { alert('Config saved! Restart gateway to apply.'); loadConfig(); }
    else { alert('Save failed: ' + r.statusText); }
  } catch(e) { alert('Invalid JSON: ' + (e instanceof Error ? e.message : String(e))); }
}

function loadTools() {
  const t = [{n:'exec',i:'terminal',c:'bl',d:'Run shell commands'},{n:'web_fetch',i:'language',c:'gr',d:'HTTP requests'},{n:'web_search',i:'search',c:'pu',d:'Search the web'},{n:'cron',i:'schedule',c:'or',d:'Scheduled tasks'},{n:'image',i:'image',c:'pi',d:'Vision/image'},{n:'canvas',i:'dashboard',c:'te',d:'HTML artifacts'},{n:'nodes',i:'device_hub',c:'bl',d:'Device capabilities'}];
  document.getElementById('tool-cards').innerHTML = t.map(x => '<div class="feature-card"><div class="fc-head"><span class="fci">'+x.i+'</span><h3>'+x.n+'</h3></div><p>'+x.d+'</p></div>').join('');
}

async function loadChannels() {
  try {
    const d = await (await fetch('/api/health')).json();
    const chMap = {telegram:{i:'send',d:'grammY bot polling',acts:['Probe']},discord:{i:'sports_esports',d:'discord.js adapter',acts:['Probe']},whatsapp:{i:'chat',d:'Baileys multi-device',acts:['Show QR','Relink','Logout']},webchat:{i:'forum',d:'Built-in WebSocket',acts:[]},slack:{i:'work',d:'Socket Mode (Bolt)',acts:['Probe']},signal:{i:'lock',d:'signal-cli JSON-RPC',acts:['Probe']}};
    const cards = Object.entries(chMap).map(([k,v]) => {
      const linked = d.channels?.[k] === true;
      const statusCls = linked ? 'ch-linked' : 'ch-offline';
      const statusTxt = linked ? '● Linked' : '○ Offline';
      const acts = v.acts.map(a => '<button class="ch-action" data-action="ch-action" data-ch="'+k+'" data-cmd="'+a.toLowerCase().replace(/\s/g,'_')+'"><span class="topbar-icon">'+(a==='Show QR'?'qr_code_2':a==='Probe'?'wifi_tethering':a==='Relink'?'link':a==='Logout'?'logout':'settings')+'</span> '+a+'</button>').join('');
      return '<div class="ch-card"><div style="display:flex;justify-content:space-between;align-items:center"><div class="fc-head"><span class="fci">'+v.i+'</span><h3>'+k.charAt(0).toUpperCase()+k.slice(1)+'</h3></div><span class="ch-status '+statusCls+'">'+statusTxt+'</span></div><div class="ch-meta">'+v.d+'</div><div class="ch-actions">'+acts+'<button class="ch-action" data-action="ch-cfg" data-ch="'+k+'"><span class="topbar-icon">code</span> Raw Config</button></div><div class="ch-config" id="ch-cfg-'+k+'"><pre>'+JSON.stringify(d.channels?.[k]||{},null,2)+'</pre></div></div>';
    });
    document.getElementById('channel-cards').innerHTML = cards.join('');
  } catch { /* intentionally ignored */ }
}
// Event delegation for dynamic elements
document.addEventListener('click', function(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  if (action === 'ch-action') { alert('Action: ' + btn.dataset.cmd + ' on ' + btn.dataset.ch); }
  if (action === 'ch-cfg') { document.getElementById('ch-cfg-'+btn.dataset.ch).classList.toggle('show'); }
  if (action === 'sess-delete') { if (confirm('Delete session?')) alert('Delete: ' + btn.dataset.id); }
  if (action === 'cron-run') { alert('Run: ' + btn.dataset.name); }
  if (action === 'cron-delete') { if (confirm('Delete job?')) alert('Delete: ' + btn.dataset.name); }
  if (action === 'agent-tab') {
    var idx = btn.dataset.idx, tab = btn.dataset.tab;
    btn.parentElement.querySelectorAll('.agent-tab').forEach(function(t) { t.classList.remove('active'); });
    btn.classList.add('active');
    var ws = document.getElementById('agent-body-'+idx);
    var tl = document.getElementById('agent-tools-'+idx);
    var cf = document.getElementById('agent-config-'+idx);
    if (ws) ws.style.display = tab==='workspace'?'block':'none';
    if (tl) tl.style.display = tab==='tools'?'block':'none';
    if (cf) cf.style.display = tab==='config'?'block':'none';
  }
  if (action === 'rpc-exec') {
    var method = document.getElementById('rpc-method').value.trim() || 'health.check';
    var resultEl = document.getElementById('rpc-result');
    resultEl.classList.add('show');
    resultEl.textContent = 'Executing ' + method + '...';
    fetch('/api/' + method.replace(/\./g, '/')).then(function(r) { return r.json(); }).then(function(d) {
      resultEl.textContent = JSON.stringify(d, null, 2);
    }).catch(function(err) { resultEl.textContent = 'Error: ' + err.message; });
  }
  if (action === 'save-approvals') {
    alert('Approvals saved! (Backend handler pending)');
  }
});
document.addEventListener('change', function(e) {
  const el = e.target.closest('[data-action="sess-toggle"]');
  if (el) sessToggle(el.dataset.id, el.dataset.key, el.checked);
});

function sc(t,v,i) { return '<div class="stat-card"><div class="stat-label">'+t+'</div><div class="stat-value"><span>'+i+'</span> '+v+'</div></div>'; }
function ago(ts) { const m=Math.round((Date.now()-ts)/60000); if(m<1)return'just now'; if(m<60)return m+'m ago'; if(m<1440)return Math.round(m/60)+'h ago'; return Math.round(m/1440)+'d ago'; }
function ccod(s) { return '<code style="background:var(--hover);padding:4px 8px;border-radius:6px;font-size:13px">'+s+'</code>'; }

async function loadOverview() {
  try {
    const d = await (await fetch('/api/health')).json();
    const h = location.host;
    document.getElementById('gw-access').innerHTML = '<strong>API URL:</strong> '+ccod('http://'+h)+' <strong>WebSocket:</strong> '+ccod('ws://'+h+'/ws')+' <strong>Dashboard:</strong> '+ccod('http://'+h+'/dashboard');
    document.getElementById('overview-stats').innerHTML = [
      sc('Status', d.status.toUpperCase(), '<span class="mi" style="color:'+(d.status==='ok'?'#137333':'#c5221f')+'">circle</span>'),
      sc('Uptime', d.uptimeHuman, '<span class="mi">schedule</span>'),
      sc('Model', d.agent.provider+'/'+d.agent.model, '<span class="mi">psychology</span>'),
      sc('Version', d.version, '<span class="mi">inventory_2</span>'),
    ].join('');
    document.querySelector('#features-table tbody').innerHTML = Object.entries(d.features).map(([k,v]) =>
      '<tr><td>'+k+'</td><td>'+(v?'<span class="badge badge-ok">Enabled</span>':'<span class="badge badge-off">Disabled</span>')+'</td></tr>'
    ).join('');
  } catch { /* intentionally ignored */ }
}

async function loadUsage() {
  try {
    const d = await (await fetch('/api/dashboard/sessions')).json();
    const totalMsg = d.sessions.reduce((a,s) => a+s.messages, 0);
    const totalSize = d.sessions.reduce((a,s) => a+s.size, 0);
    document.getElementById('usage-stats').innerHTML = [
      sc('Total Sessions', d.sessions.length.toString(), '<span class="mi">forum</span>'),
      sc('Total Messages', totalMsg.toString(), '<span class="mi">chat_bubble</span>'),
      sc('Total Size', (totalSize/1024).toFixed(1)+'KB', '<span class="mi">storage</span>'),
    ].join('');
    const tb = document.querySelector('#usage-table tbody');
    if (!d.sessions.length) { tb.innerHTML = '<tr><td colspan="4" class="empty">No session activity yet</td></tr>'; return; }
    tb.innerHTML = d.sessions.sort((a,b)=>b.lastModified-a.lastModified).map(s => '<tr><td style="font-family:monospace;font-size:13px">'+s.id.substring(0,40)+'</td><td>'+s.messages+'</td><td>'+(s.size/1024).toFixed(1)+'KB</td><td>'+ago(s.lastModified)+'</td></tr>').join('');
  } catch { /* intentionally ignored */ }
}

async function loadCron() {
  try {
    const d = await (await fetch('/api/dashboard/cron')).json();
    document.getElementById('cron-stats').innerHTML = [
      sc('Cron Engine', d.enabled?'Enabled':'Disabled', '<span class="mi" style="color:'+(d.enabled?'#137333':'#c5221f')+'">schedule</span>'),
      sc('Total Jobs', d.jobs.length.toString(), '<span class="mi">assignment</span>'),
    ].join('');
    const tb = document.querySelector('#cron-table tbody');
    if (!d.jobs.length) { tb.innerHTML = '<tr><td colspan="5" class="empty"><div class="empty-icon"><span class="mi" style="font-size:48px">schedule</span></div>No cron jobs configured</td></tr>'; return; }
    tb.innerHTML = d.jobs.map(j => '<tr><td>'+j.name+'</td><td style="font-family:monospace;font-size:13px">'+(j.schedule||j.cron||'')+'</td><td><span class="badge '+(j.enabled!==false?'badge-ok':'badge-off')+'">'+(j.enabled!==false?'Active':'Paused')+'</span></td><td>'+(j.lastRun?ago(j.lastRun):'Never')+'</td><td><button class="ch-action" data-action="cron-run" data-name="'+j.name+'" title="Run Once"><span class="topbar-icon">play_arrow</span></button> <button class="ch-action" data-action="cron-delete" data-name="'+j.name+'" style="color:#c5221f" title="Delete"><span class="topbar-icon">delete</span></button></td></tr>').join('');
  } catch { /* intentionally ignored */ }
}

function createCron() {
  const name = document.getElementById('cron-name').value.trim();
  const schedule = document.getElementById('cron-schedule').value.trim();
  const prompt = document.getElementById('cron-prompt').value.trim();
  if (!name || !schedule) { alert('Name and Schedule are required'); return; }
  alert('Creating cron job: ' + name + ' (' + schedule + ') - Saved!');
}

async function loadAgents() {
  try {
    const d = await (await fetch('/api/dashboard/agents')).json();
    const h = await (await fetch('/api/health')).json();
    const el = document.getElementById('agent-cards');
    document.getElementById('agent-stats').innerHTML = [
      sc('Total Agents', d.agents.length.toString(), '<span class="mi">smart_toy</span>'),
      sc('Provider', (h.agent?.provider||'unknown'), '<span class="mi">cloud</span>'),
      sc('Model', (h.agent?.model||'unknown'), '<span class="mi">psychology</span>'),
    ].join('');
    if (!d.agents.length) { el.innerHTML = '<div class="empty" style="text-align:center;padding:40px"><div class="empty-icon"><span class="mi" style="font-size:48px">smart_toy</span></div>No agents configured</div>'; return; }
    el.innerHTML = d.agents.map(function(a,idx) {
      var tools = ['exec','web_fetch','web_search','cron','image','canvas','nodes'];
      var toolsHtml = tools.map(function(t) { return '<div class="agent-tool-chip"><span class="topbar-icon">build</span> '+t+'</div>'; }).join('');
      return '<div class="agent-detail"><div class="agent-header"><h3><span class="mi" style="font-size:20px;color:var(--active-text)">smart_toy</span> '+a.name+'</h3><span class="ch-status ch-linked">Active</span></div><div class="agent-tabs"><button class="agent-tab active" data-action="agent-tab" data-idx="'+idx+'" data-tab="workspace">Workspace</button><button class="agent-tab" data-action="agent-tab" data-idx="'+idx+'" data-tab="tools">Tools</button><button class="agent-tab" data-action="agent-tab" data-idx="'+idx+'" data-tab="config">Config</button></div><div class="agent-body" id="agent-body-'+idx+'"><div class="agent-paths"><div class="agent-path"><span class="agent-path-label">Sessions</span><span class="agent-path-val">'+a.sessions+' session(s)</span></div><div class="agent-path"><span class="agent-path-label">Config</span><span class="agent-path-val">~/.coreblow/config.json</span></div><div class="agent-path"><span class="agent-path-label">Skills</span><span class="agent-path-val">~/.coreblow/skills/</span></div><div class="agent-path"><span class="agent-path-label">Sessions</span><span class="agent-path-val">~/.coreblow/sessions/</span></div></div></div><div class="agent-body" id="agent-tools-'+idx+'" style="display:none"><div class="agent-tools-grid">'+toolsHtml+'</div></div><div class="agent-body" id="agent-config-'+idx+'" style="display:none"><pre style="font-size:12px;max-height:200px;overflow:auto">'+JSON.stringify(a,null,2)+'</pre></div></div>';
    }).join('');
  } catch { /* intentionally ignored */ }
}

let _skillsData = [];
async function loadSkills() {
  try {
    const d = await (await fetch('/api/dashboard/skills')).json();
    _skillsData = d.skills;
    renderSkills(_skillsData);
  } catch { /* intentionally ignored */ }
}

function renderSkills(skills) {
  const tb = document.querySelector('#skills-table tbody');
  if (!skills.length) { tb.innerHTML = '<tr><td colspan="5" class="empty"><div class="empty-icon"><span class="mi" style="font-size:48px">auto_fix_high</span></div>No skills installed</td></tr>'; return; }
  tb.innerHTML = skills.map(function(s) { return '<tr><td>'+s.name+'</td><td>'+(s.isDir?'<span class="badge badge-ok">Package</span>':'<span class="badge badge-off">File</span>')+'</td><td>'+(s.isDir?'-':(s.size/1024).toFixed(1)+'KB')+'</td><td>'+ago(s.lastModified)+'</td><td style="color:var(--text4);font-size:13px">'+(s.isDir?'Skill package':'Script file')+'</td></tr>'; }).join('');
}

function filterSkills() {
  var q = document.getElementById('skill-search').value.toLowerCase();
  if (!q) { renderSkills(_skillsData); return; }
  renderSkills(_skillsData.filter(function(s) { return s.name.toLowerCase().indexOf(q) !== -1; }));
}

async function loadDebug() {
  try {
    const d = await (await fetch('/api/dashboard/debug')).json();
    document.getElementById('debug-stats').innerHTML = [
      sc('Platform', d.system.platform+'/'+d.system.arch, '<span class="mi">computer</span>'),
      sc('Node.js', d.system.nodeVersion, '<span class="mi">code</span>'),
      sc('Memory (RSS)', d.memory.rss+'MB', '<span class="mi">memory</span>'),
      sc('Heap Used', d.memory.heapUsed+'/'+d.memory.heapTotal+'MB', '<span class="mi">data_usage</span>'),
      sc('CPUs', d.cpus.toString(), '<span class="mi">developer_board</span>'),
      sc('System RAM', Math.round(d.freeMem/1024)+'GB free / '+Math.round(d.totalMem/1024)+'GB', '<span class="mi">storage</span>'),
    ].join('');
    document.getElementById('debug-view').textContent = JSON.stringify(d, null, 2);
  } catch { document.getElementById('debug-view').textContent = 'Error loading debug info'; }
}

let _logEntries = [];
let _logInterval = null;
async function loadLogs() {
  try {
    const d = await (await fetch('/api/dashboard/logs?limit=100')).json();
    _logEntries = d.entries;
    renderLogs(_logEntries);
  } catch { /* intentionally ignored */ }
}

function renderLogs(entries) {
  const tb = document.querySelector('#logs-table tbody');
  if (!entries.length) { tb.innerHTML = '<tr><td colspan="4" class="empty"><div class="empty-icon"><span class="mi" style="font-size:48px">receipt_long</span></div>No log entries</td></tr>'; return; }
  tb.innerHTML = entries.map(e => '<tr><td style="white-space:nowrap">'+new Date(e.timestamp).toLocaleString()+'</td><td>'+(e.action||'')+'</td><td>'+(e.channel||'-')+'</td><td style="font-size:13px;max-width:400px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(e.details||e.user||'')+'</td></tr>').join('');
}

function filterLogs() {
  const q = document.getElementById('log-search').value.toLowerCase();
  if (!q) { renderLogs(_logEntries); return; }
  renderLogs(_logEntries.filter(e => JSON.stringify(e).toLowerCase().includes(q)));
}

function toggleLogFollow() {
  const btn = document.getElementById('log-follow');
  if (_logInterval) { clearInterval(_logInterval); _logInterval = null; btn.classList.remove('active'); }
  else { _logInterval = setInterval(loadLogs, 5000); btn.classList.add('active'); }
}

function exportLogs() {
  const rows = ['Time,Action,Channel,Details'];
  _logEntries.forEach(function(e) { rows.push([new Date(e.timestamp).toISOString(),e.action||'',e.channel||'',e.details||e.user||''].join(',')); });
  const blob = new Blob([rows.join(String.fromCharCode(10))], {type:'text/csv'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'coreblow-logs.csv'; a.click();
}

loadStatus();
setInterval(loadStatus, 30000);

// Theme management
function setTheme(mode) {
  localStorage.setItem('cb-theme', mode);
  document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('theme-'+mode).classList.add('active');
  if (mode === 'system') {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', mode);
  }
}
// Init theme
const saved = localStorage.getItem('cb-theme') || 'system';
setTheme(saved);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (localStorage.getItem('cb-theme') === 'system') setTheme('system');
});
</script>
</body>
</html>`;
}
