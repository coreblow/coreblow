/**
 * src/dashboard/serve.ts
 * Dashboard — 8-page control UI with tab navigation
 */

import path from 'node:path';
import fs from 'node:fs';
import type { Application, Request, Response } from 'express';
import { getConfig, getHomeDir } from '../gateway/config.js';
import { readAuditLog } from '../security/audit.js';
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

  // Dashboard API endpoints
  app.get('/api/dashboard/status', (_req: Request, res: Response) => {
    res.json({
      gateway: { status: 'running', version: '1.0.0' },
      agent: { model: config.agent.model, provider: config.agent.provider },
      channels: config.channels,
      features: config.features,
    });
  });

  app.get('/api/dashboard/audit', (req: Request, res: Response) => {
    const date = req.query.date as string | undefined;
    const entries = readAuditLog(date);
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
      res.json({ devices: devices.map((d: any) => ({ ...d, token: undefined })) });
    } catch { res.json({ devices: [] }); }
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
    } catch { res.json({ canvases: [] }); }
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
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, sans-serif; background: #0a0a12; color: #e4e4ef; min-height: 100vh; }
    .layout { display: flex; min-height: 100vh; }

    /* Sidebar */
    .sidebar { width: 220px; background: #0f0f1a; border-right: 1px solid #1e1e35; padding: 20px 0; flex-shrink: 0; }
    .logo { padding: 0 20px 20px; font-size: 18px; font-weight: 700; color: #818cf8; display: flex; align-items: center; gap: 8px; }
    .logo span { font-size: 22px; }
    .nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 20px; font-size: 13px; color: #8888a8; cursor: pointer; transition: all .15s; border-left: 3px solid transparent; }
    .nav-item:hover { background: #16162a; color: #c4c4d8; }
    .nav-item.active { background: #1a1a32; color: #818cf8; border-left-color: #818cf8; font-weight: 600; }
    .nav-icon { font-size: 16px; width: 20px; text-align: center; }

    /* Main */
    .main { flex: 1; padding: 24px 32px; overflow-y: auto; }
    .page { display: none; }
    .page.active { display: block; }
    .page-title { font-size: 22px; font-weight: 700; margin-bottom: 20px; }

    /* Cards */
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .card { background: #14142a; border: 1px solid #1e1e38; border-radius: 12px; padding: 20px; }
    .card-title { font-size: 11px; color: #818cf8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; font-weight: 600; }
    .stat-value { font-size: 28px; font-weight: 700; }
    .stat-label { font-size: 12px; color: #6b6b88; margin-top: 4px; }

    /* Table */
    .table-card { background: #14142a; border: 1px solid #1e1e38; border-radius: 12px; padding: 20px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 10px 12px; color: #6b6b88; font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; border-bottom: 1px solid #1e1e38; }
    td { padding: 10px 12px; border-bottom: 1px solid #12122a; }
    tr:hover { background: #18183a; }

    /* Badges */
    .badge { padding: 3px 10px; border-radius: 10px; font-size: 11px; font-weight: 600; }
    .badge-ok { background: rgba(52,211,153,.12); color: #34d399; }
    .badge-off { background: rgba(100,100,130,.12); color: #5a5a78; }
    .badge-warn { background: rgba(251,191,36,.12); color: #fbbf24; }

    /* Chat */
    #messages { background: #0e0e1a; border: 1px solid #1e1e38; border-radius: 12px; padding: 16px; min-height: 300px; max-height: 500px; overflow-y: auto; margin-bottom: 12px; font-size: 14px; line-height: 1.6; }
    .msg { margin-bottom: 10px; }
    .msg-user { color: #818cf8; }
    .msg-ai { color: #34d399; }
    .msg b { font-weight: 600; }
    .input-row { display: flex; gap: 8px; }
    .input-row input { flex: 1; padding: 12px 16px; border: 1px solid #1e1e38; border-radius: 10px; background: #14142a; color: #e4e4ef; font-size: 14px; font-family: inherit; }
    .input-row input:focus { outline: none; border-color: #818cf8; }
    .input-row button { padding: 12px 24px; border: none; border-radius: 10px; background: #818cf8; color: white; font-weight: 600; cursor: pointer; font-family: inherit; transition: background .15s; }
    .input-row button:hover { background: #6366f1; }

    /* Empty state */
    .empty { text-align: center; padding: 40px; color: #5a5a78; }
    .empty-icon { font-size: 40px; margin-bottom: 12px; }

    /* Config view */
    pre.config { background: #0e0e1a; border: 1px solid #1e1e38; border-radius: 12px; padding: 20px; font-family: 'JetBrains Mono', monospace; font-size: 13px; line-height: 1.6; overflow-x: auto; color: #a5b4fc; }
  </style>
</head>
<body>
<div class="layout">
  <nav class="sidebar">
    <div class="logo"><span>🤖</span> CoreBlow</div>
    <div class="nav-item active" data-page="status"><span class="nav-icon">📊</span> Status</div>
    <div class="nav-item" data-page="chat"><span class="nav-icon">💬</span> WebChat</div>
    <div class="nav-item" data-page="sessions"><span class="nav-icon">📝</span> Sessions</div>
    <div class="nav-item" data-page="tools"><span class="nav-icon">🔧</span> Tools</div>
    <div class="nav-item" data-page="channels"><span class="nav-icon">📡</span> Channels</div>
    <div class="nav-item" data-page="devices"><span class="nav-icon">📱</span> Devices</div>
    <div class="nav-item" data-page="canvases"><span class="nav-icon">🎨</span> Canvases</div>
    <div class="nav-item" data-page="config"><span class="nav-icon">⚙️</span> Config</div>
  </nav>

  <main class="main">
    <!-- Page 1: Status -->
    <div class="page active" id="page-status">
      <h2 class="page-title">System Status</h2>
      <div class="cards" id="stat-cards"></div>
      <div class="table-card"><h3 class="card-title">Channels</h3><table id="ch-table"><thead><tr><th>Channel</th><th>Status</th></tr></thead><tbody></tbody></table></div>
      <div class="table-card"><h3 class="card-title">Recent Audit</h3><table id="audit-table"><thead><tr><th>Time</th><th>Action</th><th>Details</th></tr></thead><tbody></tbody></table></div>
    </div>

    <!-- Page 2: Chat -->
    <div class="page" id="page-chat">
      <h2 class="page-title">WebChat</h2>
      <div id="messages"></div>
      <div class="input-row">
        <input type="text" id="msg-input" placeholder="Type a message..." autocomplete="off" />
        <button onclick="sendMsg()">Send</button>
      </div>
    </div>

    <!-- Page 3: Sessions -->
    <div class="page" id="page-sessions">
      <h2 class="page-title">Chat Sessions</h2>
      <div class="table-card"><table id="sess-table"><thead><tr><th>Session ID</th><th>Messages</th><th>Size</th><th>Last Active</th></tr></thead><tbody></tbody></table></div>
    </div>

    <!-- Page 4: Tools -->
    <div class="page" id="page-tools">
      <h2 class="page-title">Registered Tools</h2>
      <div class="cards" id="tool-cards"></div>
    </div>

    <!-- Page 5: Channels -->
    <div class="page" id="page-channels">
      <h2 class="page-title">Channel Configuration</h2>
      <div class="cards" id="channel-cards"></div>
    </div>

    <!-- Page 6: Devices -->
    <div class="page" id="page-devices">
      <h2 class="page-title">Paired Devices</h2>
      <div class="table-card"><table id="dev-table"><thead><tr><th>Name</th><th>Platform</th><th>Paired</th><th>Last Seen</th></tr></thead><tbody></tbody></table></div>
    </div>

    <!-- Page 7: Canvases -->
    <div class="page" id="page-canvases">
      <h2 class="page-title">AI Canvases</h2>
      <div class="table-card"><table id="canvas-table"><thead><tr><th>Name</th><th>Size</th><th>Modified</th><th>Action</th></tr></thead><tbody></tbody></table></div>
    </div>

    <!-- Page 8: Config -->
    <div class="page" id="page-config">
      <h2 class="page-title">Configuration</h2>
      <pre class="config" id="config-view">Loading...</pre>
    </div>
  </main>
</div>

<script>
// Navigation
document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    el.classList.add('active');
    document.getElementById('page-' + el.dataset.page).classList.add('active');
    loadPage(el.dataset.page);
  });
});

// WebSocket
const ws = new WebSocket('ws://' + location.host);
ws.onmessage = (e) => {
  try {
    const msg = JSON.parse(e.data);
    if (msg.data?.text) addMsg('AI', msg.data.text, 'msg-ai');
  } catch {}
};

function sendMsg() {
  const input = document.getElementById('msg-input');
  const text = input.value.trim();
  if (!text) return;
  addMsg('You', text, 'msg-user');
  ws.send(JSON.stringify({ type: 'message', data: { text } }));
  input.value = '';
}
document.getElementById('msg-input').addEventListener('keydown', e => { if (e.key === 'Enter') sendMsg(); });

function addMsg(sender, text, cls) {
  const m = document.getElementById('messages');
  m.innerHTML += '<div class="msg ' + cls + '"><b>' + sender + ':</b> ' + text.replace(/</g,'&lt;') + '</div>';
  m.scrollTop = m.scrollHeight;
}

// Page loaders
function loadPage(page) {
  if (page === 'status') loadStatus();
  if (page === 'sessions') loadSessions();
  if (page === 'devices') loadDevices();
  if (page === 'canvases') loadCanvases();
  if (page === 'config') loadConfig();
  if (page === 'tools') loadTools();
  if (page === 'channels') loadChannels();
}

async function loadStatus() {
  const data = await (await fetch('/api/health')).json();
  document.getElementById('stat-cards').innerHTML = [
    statCard('Status', data.status.toUpperCase(), data.status === 'ok' ? '🟢' : '🔴'),
    statCard('Uptime', data.uptimeHuman, '⏱️'),
    statCard('Model', data.agent.provider + '/' + data.agent.model, '🧠'),
    statCard('Version', data.version, '📦'),
  ].join('');

  const chTbody = document.querySelector('#ch-table tbody');
  chTbody.innerHTML = Object.entries(data.channels).map(([k,v]) =>
    '<tr><td>' + k + '</td><td>' + (v ? '<span class="badge badge-ok">Connected</span>' : '<span class="badge badge-off">Off</span>') + '</td></tr>'
  ).join('');

  try {
    const audit = await (await fetch('/api/dashboard/audit')).json();
    const aTbody = document.querySelector('#audit-table tbody');
    aTbody.innerHTML = audit.entries.slice(-10).reverse().map(e =>
      '<tr><td>' + new Date(e.timestamp).toLocaleString() + '</td><td>' + (e.action||'') + '</td><td>' + (e.details||'').substring(0,60) + '</td></tr>'
    ).join('') || '<tr><td colspan="3" class="empty">No audit entries yet</td></tr>';
  } catch {}
}

async function loadSessions() {
  try {
    const data = await (await fetch('/api/dashboard/sessions')).json();
    const tbody = document.querySelector('#sess-table tbody');
    if (!data.sessions.length) { tbody.innerHTML = '<tr><td colspan="4" class="empty">No sessions yet</td></tr>'; return; }
    tbody.innerHTML = data.sessions.map(s =>
      '<tr><td style="font-family:monospace;font-size:12px">' + s.id.substring(0,40) + '</td><td>' + s.messages + '</td><td>' + (s.size/1024).toFixed(1) + 'KB</td><td>' + ago(s.lastModified) + '</td></tr>'
    ).join('');
  } catch { document.querySelector('#sess-table tbody').innerHTML = '<tr><td colspan="4">Error loading</td></tr>'; }
}

async function loadDevices() {
  try {
    const data = await (await fetch('/api/dashboard/devices')).json();
    const tbody = document.querySelector('#dev-table tbody');
    if (!data.devices.length) { tbody.innerHTML = '<tr><td colspan="4" class="empty">No paired devices</td></tr>'; return; }
    tbody.innerHTML = data.devices.map(d =>
      '<tr><td>' + d.name + '</td><td>' + (d.platform||'unknown') + '</td><td>' + new Date(d.pairedAt).toLocaleDateString() + '</td><td>' + ago(d.lastSeen) + '</td></tr>'
    ).join('');
  } catch {}
}

async function loadCanvases() {
  try {
    const data = await (await fetch('/api/dashboard/canvases')).json();
    const tbody = document.querySelector('#canvas-table tbody');
    if (!data.canvases.length) { tbody.innerHTML = '<tr><td colspan="4" class="empty">No canvases yet. Ask AI to create one!</td></tr>'; return; }
    tbody.innerHTML = data.canvases.map(c =>
      '<tr><td>' + c.name + '</td><td>' + (c.size/1024).toFixed(1) + 'KB</td><td>' + ago(c.lastModified) + '</td><td><a href="/canvas/' + c.name + '.html" target="_blank" style="color:#818cf8">Open</a></td></tr>'
    ).join('');
  } catch {}
}

async function loadConfig() {
  try {
    const data = await (await fetch('/api/dashboard/status')).json();
    document.getElementById('config-view').textContent = JSON.stringify(data, null, 2);
  } catch { document.getElementById('config-view').textContent = 'Error loading config'; }
}

function loadTools() {
  const tools = ['exec', 'web_fetch', 'web_search', 'cron', 'image', 'canvas', 'nodes', 'message', 'browser', 'scrape'];
  document.getElementById('tool-cards').innerHTML = tools.map(t =>
    '<div class="card"><div class="card-title">' + t + '</div><div style="font-size:13px;color:#8888a8">' + toolDesc(t) + '</div></div>'
  ).join('');
}

function loadChannels() {
  const chs = [
    { name: 'Telegram', icon: '✈️', desc: 'grammY bot polling' },
    { name: 'Discord', icon: '🎮', desc: 'discord.js adapter' },
    { name: 'WhatsApp', icon: '📱', desc: 'Baileys + anti-ban' },
    { name: 'WebChat', icon: '💬', desc: 'Built-in WebSocket' },
    { name: 'Slack', icon: '💼', desc: 'Socket Mode (Bolt)' },
    { name: 'Signal', icon: '🔐', desc: 'signal-cli JSON-RPC' },
  ];
  document.getElementById('channel-cards').innerHTML = chs.map(c =>
    '<div class="card"><div style="font-size:24px;margin-bottom:8px">' + c.icon + '</div><div class="card-title">' + c.name + '</div><div style="font-size:13px;color:#8888a8">' + c.desc + '</div></div>'
  ).join('');
}

function toolDesc(t) {
  const descs = { exec:'Run shell commands', web_fetch:'HTTP requests', web_search:'Search the web', cron:'Scheduled tasks', image:'Vision/image', canvas:'Generate HTML', nodes:'Device capabilities', message:'Cross-channel messaging', browser:'Playwright automation', scrape:'Super Scraper bridge' };
  return descs[t] || '';
}

function statCard(title, value, icon) {
  return '<div class="card"><div class="card-title">' + title + '</div><div class="stat-value">' + icon + ' ' + value + '</div></div>';
}

function ago(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm ago';
  if (m < 1440) return Math.round(m/60) + 'h ago';
  return Math.round(m/1440) + 'd ago';
}

// Auto-load status page
loadStatus();
setInterval(loadStatus, 30000);
</script>
</body>
</html>`;
}
