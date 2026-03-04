/**
 * src/dashboard/serve.ts
 * Dashboard static file server + API endpoints
 */

import path from 'node:path';
import fs from 'node:fs';
import type { Express, Request, Response } from 'express';
import { getConfig } from '../gateway/config.js';
import { readAuditLog } from '../security/audit.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('dashboard');

/**
 * Mount dashboard routes on the Express app
 */
export function mountDashboard(app: Express) {
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

    // Serve static dashboard files
    const dashboardDir = path.join(path.dirname(new URL(import.meta.url).pathname), '../../dashboard-ui');
    if (fs.existsSync(dashboardDir)) {
        const { default: express } = await import('express') as any;
        app.use('/dashboard', express.static(dashboardDir));
        log.info({ path: dashboardDir }, 'Dashboard UI mounted at /dashboard');
    } else {
        // Serve a minimal built-in dashboard
        app.get('/dashboard', (_req: Request, res: Response) => {
            res.send(getMinimalDashboard());
        });
        log.info('Minimal dashboard mounted at /dashboard');
    }
}

function getMinimalDashboard(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CoreBlow Gateway</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, sans-serif; background: #0a0a0f; color: #e4e4ef; min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 40px 20px; }
    h1 { font-size: 28px; margin-bottom: 8px; }
    .subtitle { color: #8888a8; margin-bottom: 32px; }
    .card { background: #16162a; border: 1px solid #2a2a45; border-radius: 12px; padding: 24px; width: 100%; max-width: 600px; margin-bottom: 16px; }
    .card h3 { font-size: 14px; color: #818cf8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
    .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #2a2a45; font-size: 14px; }
    .row:last-child { border-bottom: none; }
    .row .label { color: #8888a8; }
    .row .value { font-weight: 600; }
    .badge { padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
    .badge-ok { background: rgba(52,211,153,.15); color: #34d399; }
    .badge-off { background: rgba(136,136,168,.15); color: #5a5a78; }
    #chat { margin-top: 16px; width: 100%; max-width: 600px; }
    #messages { background: #12121a; border: 1px solid #2a2a45; border-radius: 12px; padding: 16px; min-height: 200px; max-height: 400px; overflow-y: auto; margin-bottom: 12px; font-size: 14px; }
    .msg { margin-bottom: 8px; line-height: 1.5; }
    .msg-user { color: #818cf8; }
    .msg-ai { color: #34d399; }
    #input-row { display: flex; gap: 8px; }
    #input-row input { flex: 1; padding: 12px 16px; border: 1px solid #2a2a45; border-radius: 8px; background: #1a1a2e; color: #e4e4ef; font-size: 14px; font-family: inherit; }
    #input-row input:focus { outline: none; border-color: #818cf8; }
    #input-row button { padding: 12px 20px; border: none; border-radius: 8px; background: #818cf8; color: white; font-weight: 600; cursor: pointer; font-family: inherit; }
    #input-row button:hover { background: #6366f1; }
  </style>
</head>
<body>
  <h1>🤖 CoreBlow Gateway</h1>
  <p class="subtitle">AI Assistant Platform</p>

  <div class="card" id="status-card">
    <h3>System Status</h3>
    <div id="status">Loading...</div>
  </div>

  <div id="chat">
    <div class="card">
      <h3>WebChat</h3>
      <div id="messages"></div>
      <div id="input-row">
        <input type="text" id="msg-input" placeholder="Type a message..." autocomplete="off" />
        <button onclick="sendMsg()">Send</button>
      </div>
    </div>
  </div>

  <script>
    const ws = new WebSocket(\`ws://\${location.host}\`);
    const messages = document.getElementById('messages');
    const input = document.getElementById('msg-input');

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'response' && msg.data?.text) {
        addMsg('AI', msg.data.text, 'msg-ai');
      }
    };

    function sendMsg() {
      const text = input.value.trim();
      if (!text) return;
      addMsg('You', text, 'msg-user');
      ws.send(JSON.stringify({ type: 'message', data: { text } }));
      input.value = '';
    }

    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMsg(); });

    function addMsg(sender, text, cls) {
      messages.innerHTML += '<div class="msg ' + cls + '"><b>' + sender + ':</b> ' + text + '</div>';
      messages.scrollTop = messages.scrollHeight;
    }

    fetch('/api/health').then(r => r.json()).then(data => {
      const s = document.getElementById('status');
      s.innerHTML = [
        row('Status', badge(data.status, data.status === 'ok')),
        row('Uptime', data.uptimeHuman),
        row('Model', data.agent.provider + '/' + data.agent.model),
        row('Telegram', badge(data.channels.telegram ? 'on' : 'off', data.channels.telegram)),
        row('Discord', badge(data.channels.discord ? 'on' : 'off', data.channels.discord)),
        row('WebChat', badge(data.channels.webchat ? 'on' : 'off', data.channels.webchat)),
      ].join('');
    });

    function row(l, v) { return '<div class="row"><span class="label">' + l + '</span><span class="value">' + v + '</span></div>'; }
    function badge(t, ok) { return '<span class="badge ' + (ok ? 'badge-ok' : 'badge-off') + '">' + t + '</span>'; }
  </script>
</body>
</html>`;
}
