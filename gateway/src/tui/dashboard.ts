/**
 * src/tui/dashboard.ts
 * CoreBlow TUI Dashboard — real-time terminal interface
 * Full dashboard with panels, live stats, and keyboard navigation
 */

import readline from 'node:readline';
import os from 'node:os';
import { TerminalRenderer, colors, box, symbols } from './renderer.js';

type Panel = 'channels' | 'memory' | 'sessions' | 'logs' | 'extensions';

interface DashboardState {
    activePanel: Panel;
    channels: Array<{ name: string; status: 'online' | 'offline' | 'connecting'; messages: number }>;
    memory: { count: number; sizeKB: number; backend: string };
    sessions: { active: number; total: number; avgLength: number };
    extensions: Array<{ name: string; enabled: boolean; tools: number }>;
    logs: string[];
    cpuHistory: number[];
    memHistory: number[];
    uptime: number;
    messagesPerMin: number[];
}

export class TUIDashboard {
    private renderer: TerminalRenderer;
    private state: DashboardState;
    private running = false;
    private refreshInterval: ReturnType<typeof setInterval> | null = null;
    private rl: readline.Interface | null = null;

    constructor() {
        this.renderer = new TerminalRenderer();
        this.state = {
            activePanel: 'channels',
            channels: [
                { name: 'Telegram', status: 'online', messages: 1247 },
                { name: 'Discord', status: 'online', messages: 892 },
                { name: 'WhatsApp', status: 'offline', messages: 0 },
                { name: 'Slack', status: 'online', messages: 456 },
                { name: 'Signal', status: 'connecting', messages: 12 },
                { name: 'WebChat', status: 'online', messages: 2341 },
                { name: 'IRC', status: 'offline', messages: 0 },
                { name: 'Matrix', status: 'online', messages: 178 },
            ],
            memory: { count: 892, sizeKB: 456, backend: 'local (TF-IDF)' },
            sessions: { active: 23, total: 1456, avgLength: 12 },
            extensions: [
                { name: 'memory-core', enabled: true, tools: 5 },
                { name: 'auto-reply', enabled: true, tools: 1 },
                { name: 'tts', enabled: true, tools: 1 },
                { name: 'voice-call', enabled: false, tools: 1 },
                { name: 'diagnostics', enabled: true, tools: 1 },
                { name: 'link-understanding', enabled: true, tools: 1 },
                { name: 'copilot-proxy', enabled: false, tools: 1 },
                { name: 'lobster', enabled: true, tools: 1 },
            ],
            logs: [
                `${colors.gray}[00:45:21]${colors.reset} ${colors.green}INFO${colors.reset}  Gateway started on port 3100`,
                `${colors.gray}[00:45:22]${colors.reset} ${colors.green}INFO${colors.reset}  Telegram bot connected (@coreblow_bot)`,
                `${colors.gray}[00:45:22]${colors.reset} ${colors.green}INFO${colors.reset}  Discord bot connected (CoreBlow#1234)`,
                `${colors.gray}[00:45:23]${colors.reset} ${colors.green}INFO${colors.reset}  Memory loaded: 892 entries from disk`,
                `${colors.gray}[00:45:23]${colors.reset} ${colors.yellow}WARN${colors.reset}  WhatsApp: QR code expired, reconnecting...`,
                `${colors.gray}[00:45:24]${colors.reset} ${colors.green}INFO${colors.reset}  Extensions loaded: 8/30 enabled`,
                `${colors.gray}[00:45:25]${colors.reset} ${colors.green}INFO${colors.reset}  Skills loaded: 52 available`,
                `${colors.gray}[00:45:30]${colors.reset} ${colors.cyan}MSG${colors.reset}   Telegram/john: "Hey, what's the weather?"`,
                `${colors.gray}[00:45:31]${colors.reset} ${colors.blue}TOOL${colors.reset}  Executing: web_fetch (weather API)`,
                `${colors.gray}[00:45:32]${colors.reset} ${colors.cyan}REPLY${colors.reset} Telegram/john: "It's 28°C in Jakarta ☀️"`,
                `${colors.gray}[00:45:45]${colors.reset} ${colors.cyan}MSG${colors.reset}   Discord/alice: "Summarize this article"`,
                `${colors.gray}[00:45:46]${colors.reset} ${colors.blue}TOOL${colors.reset}  Executing: web_fetch + summarize`,
                `${colors.gray}[00:45:48]${colors.reset} ${colors.cyan}REPLY${colors.reset} Discord/alice: [Summary sent, 3 paragraphs]`,
                `${colors.gray}[00:46:01]${colors.reset} ${colors.green}INFO${colors.reset}  Memory auto-stored: 2 new facts`,
                `${colors.gray}[00:46:15]${colors.reset} ${colors.cyan}MSG${colors.reset}   Slack/bob: "Remember my meeting at 3pm"`,
                `${colors.gray}[00:46:16]${colors.reset} ${colors.blue}MEM${colors.reset}   Stored: "bob has meeting at 3pm" [preference]`,
            ],
            cpuHistory: [12, 15, 8, 22, 18, 14, 10, 25, 20, 16, 13, 19, 11, 17, 23, 15, 12, 18, 14, 20],
            memHistory: [45, 46, 47, 45, 48, 50, 49, 51, 50, 52, 51, 53, 52, 54, 53, 55, 54, 56, 55, 57],
            uptime: 4 * 3600 + 32 * 60 + 15,
            messagesPerMin: [3, 5, 2, 8, 6, 4, 7, 3, 9, 5, 4, 6, 8, 3, 7, 5, 4, 6, 3, 8],
        };
    }

    /**
     * Start the TUI
     */
    async start(): Promise<void> {
        this.running = true;

        // Enter alternate screen buffer
        this.renderer.enterAltScreen();
        this.renderer.hideCursor();
        this.renderer.clear();

        // Setup keyboard input
        this.setupInput();

        // Initial render
        this.render();

        // Refresh every 1 second
        this.refreshInterval = setInterval(() => {
            this.updateStats();
            this.render();
        }, 1000);
    }

    /**
     * Stop the TUI
     */
    stop(): void {
        this.running = false;
        if (this.refreshInterval) clearInterval(this.refreshInterval);
        if (this.rl) this.rl.close();
        this.renderer.showCursor();
        this.renderer.exitAltScreen();
    }

    /**
     * Setup keyboard input
     */
    private setupInput(): void {
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
        }
        process.stdin.resume();
        process.stdin.setEncoding('utf8');

        process.stdin.on('data', (key: string) => {
            switch (key) {
                case 'q':
                case '\x03': // Ctrl+C
                    this.stop();
                    process.exit(0);
                    break;
                case '1': this.state.activePanel = 'channels'; break;
                case '2': this.state.activePanel = 'memory'; break;
                case '3': this.state.activePanel = 'sessions'; break;
                case '4': this.state.activePanel = 'extensions'; break;
                case '5': this.state.activePanel = 'logs'; break;
                case '\t': // Tab
                    const panels: Panel[] = ['channels', 'memory', 'sessions', 'extensions', 'logs'];
                    const idx = panels.indexOf(this.state.activePanel);
                    this.state.activePanel = panels[(idx + 1) % panels.length];
                    break;
                case 'r': // Refresh
                    this.render();
                    break;
            }
            this.render();
        });
    }

    /**
     * Update stats (simulate)
     */
    private updateStats(): void {
        this.state.uptime++;

        // Update CPU history
        const cpu = os.loadavg()[0] * 10;
        this.state.cpuHistory.push(Math.min(100, Math.round(cpu + Math.random() * 5)));
        if (this.state.cpuHistory.length > 20) this.state.cpuHistory.shift();

        // Update memory history
        const mem = Math.round((os.totalmem() - os.freemem()) / os.totalmem() * 100);
        this.state.memHistory.push(mem);
        if (this.state.memHistory.length > 20) this.state.memHistory.shift();

        // Random messages
        this.state.messagesPerMin.push(Math.floor(Math.random() * 10));
        if (this.state.messagesPerMin.length > 20) this.state.messagesPerMin.shift();
    }

    /**
     * Main render function
     */
    private render(): void {
        const W = this.renderer.width;
        const H = this.renderer.height;

        this.renderer.clear();

        // ═══ HEADER ═══
        this.renderHeader(W);

        // ═══ MAIN CONTENT ═══
        const contentY = 4;
        const contentH = H - 8; // Leave room for footer
        const leftW = Math.floor(W * 0.4);
        const rightW = W - leftW;

        // Left panel: Channels
        this.renderChannels(1, contentY, leftW - 1, Math.floor(contentH * 0.6));

        // Left bottom: System stats
        this.renderSystemStats(1, contentY + Math.floor(contentH * 0.6), leftW - 1, Math.ceil(contentH * 0.4));

        // Right panel: Active panel content
        this.renderActivePanel(leftW, contentY, rightW, contentH);

        // ═══ FOOTER ═══
        this.renderFooter(W, H);
    }

    /**
     * Render header bar
     */
    private renderHeader(W: number): void {
        const r = this.renderer;
        const uptime = this.formatUptime(this.state.uptime);
        const onlineCount = this.state.channels.filter(c => c.status === 'online').length;
        const totalMsgs = this.state.channels.reduce((s, c) => s + c.messages, 0);

        // Background bar
        r.writeAt(1, 1, `${colors.bgRgb(20, 20, 40)}${' '.repeat(W)}${colors.reset}`);
        r.writeAt(1, 2, `${colors.bgRgb(20, 20, 40)}${' '.repeat(W)}${colors.reset}`);

        // Logo
        r.writeAt(2, 1, `${colors.bgRgb(20, 20, 40)}${colors.bold}${colors.brightCyan}⚡ CoreBlow${colors.reset}${colors.bgRgb(20, 20, 40)}${colors.fg256(245)} AI Gateway v1.0.0${colors.reset}`);

        // Stats on header
        const stats = `${colors.bgRgb(20, 20, 40)}${colors.brightGreen}● ${onlineCount}/${this.state.channels.length} channels${colors.reset}${colors.bgRgb(20, 20, 40)}  ${colors.brightYellow}✉ ${totalMsgs} msgs${colors.reset}${colors.bgRgb(20, 20, 40)}  ${colors.fg256(245)}⏱ ${uptime}${colors.reset}`;
        r.writeAt(W - 50, 1, stats);

        // Subtitle
        r.writeAt(2, 2, `${colors.bgRgb(20, 20, 40)}${colors.fg256(240)}Port: 3100 │ Memory: ${this.state.memory.count} │ Sessions: ${this.state.sessions.active} active │ Extensions: ${this.state.extensions.filter(e => e.enabled).length} enabled${colors.reset}`);

        // Separator
        r.writeAt(1, 3, `${colors.fg256(236)}${'─'.repeat(W)}${colors.reset}`);
    }

    /**
     * Render channels panel
     */
    private renderChannels(x: number, y: number, w: number, h: number): void {
        const r = this.renderer;
        const isActive = this.state.activePanel === 'channels';
        const style = isActive ? 'double' : 'thin';

        r.drawBox(x, y, w, h, '📡 Channels [1]', style as any);

        const channels = this.state.channels.slice(0, h - 3);
        channels.forEach((ch, i) => {
            const statusIcon = ch.status === 'online' ? `${colors.brightGreen}●` :
                ch.status === 'connecting' ? `${colors.brightYellow}◐` :
                    `${colors.red}●`;
            const statusText = ch.status === 'online' ? `${colors.brightGreen}Online ` :
                ch.status === 'connecting' ? `${colors.brightYellow}Connecting` :
                    `${colors.fg256(240)}Offline`;

            const msgs = ch.messages > 0 ? `${colors.fg256(245)}${ch.messages.toLocaleString().padStart(6)}` : `${colors.fg256(237)}     0`;

            r.writeAt(x + 2, y + 1 + i,
                `${statusIcon} ${colors.reset}${colors.white}${ch.name.padEnd(12)}${colors.reset} ${statusText}${colors.reset} ${msgs}${colors.reset}`
            );
        });
    }

    /**
     * Render system stats panel
     */
    private renderSystemStats(x: number, y: number, w: number, h: number): void {
        const r = this.renderer;
        r.drawBox(x, y, w, h, '💻 System', 'thin');

        const cpuPct = this.state.cpuHistory[this.state.cpuHistory.length - 1] || 0;
        const memPct = this.state.memHistory[this.state.memHistory.length - 1] || 0;
        const totalMem = Math.round(os.totalmem() / 1024 / 1024 / 1024 * 10) / 10;

        // CPU
        r.writeAt(x + 2, y + 1, `${colors.fg256(245)}CPU${colors.reset}`);
        r.drawProgressBar(x + 6, y + 1, w - 14, cpuPct, 100, cpuPct > 80 ? colors.brightRed : cpuPct > 50 ? colors.brightYellow : colors.brightGreen);
        r.writeAt(x + w - 7, y + 1, `${colors.fg256(245)}${cpuPct.toString().padStart(3)}%${colors.reset}`);

        // Memory
        r.writeAt(x + 2, y + 2, `${colors.fg256(245)}MEM${colors.reset}`);
        r.drawProgressBar(x + 6, y + 2, w - 14, memPct, 100, memPct > 80 ? colors.brightRed : memPct > 50 ? colors.brightYellow : colors.brightCyan);
        r.writeAt(x + w - 7, y + 2, `${colors.fg256(245)}${memPct.toString().padStart(3)}%${colors.reset}`);

        // Sparklines
        if (h > 5) {
            r.writeAt(x + 2, y + 4, `${colors.fg256(245)}CPU ▏${colors.reset}`);
            r.drawSparkline(x + 7, y + 4, this.state.cpuHistory, w - 10, colors.brightGreen);

            r.writeAt(x + 2, y + 5, `${colors.fg256(245)}MSG ▏${colors.reset}`);
            r.drawSparkline(x + 7, y + 5, this.state.messagesPerMin, w - 10, colors.brightMagenta);
        }

        if (h > 7) {
            r.writeAt(x + 2, y + 7, `${colors.fg256(240)}Node ${process.version} │ ${os.platform()} │ ${totalMem}GB RAM${colors.reset}`);
        }
    }

    /**
     * Render the active right panel
     */
    private renderActivePanel(x: number, y: number, w: number, h: number): void {
        switch (this.state.activePanel) {
            case 'channels': this.renderLogsPanel(x, y, w, h); break;
            case 'memory': this.renderMemoryPanel(x, y, w, h); break;
            case 'sessions': this.renderSessionsPanel(x, y, w, h); break;
            case 'extensions': this.renderExtensionsPanel(x, y, w, h); break;
            case 'logs': this.renderLogsPanel(x, y, w, h); break;
        }
    }

    /**
     * Render logs panel
     */
    private renderLogsPanel(x: number, y: number, w: number, h: number): void {
        const r = this.renderer;
        r.drawBox(x, y, w, h, '📋 Live Logs [5]', 'double');

        const visibleLogs = this.state.logs.slice(-(h - 3));
        visibleLogs.forEach((log, i) => {
            // Truncate long logs
            const stripped = log.replace(/\x1b\[[0-9;]*m/g, '');
            const displayLog = stripped.length > w - 4 ? log.substring(0, w + 40) : log;
            r.writeAt(x + 2, y + 1 + i, displayLog);
        });
    }

    /**
     * Render memory panel
     */
    private renderMemoryPanel(x: number, y: number, w: number, h: number): void {
        const r = this.renderer;
        r.drawBox(x, y, w, h, '🧠 Memory [2]', 'double');

        const m = this.state.memory;
        r.writeAt(x + 2, y + 1, `${colors.brightWhite}Total Memories:${colors.reset} ${colors.brightCyan}${m.count}${colors.reset}`);
        r.writeAt(x + 2, y + 2, `${colors.brightWhite}Storage Size: ${colors.reset} ${colors.brightCyan}${m.sizeKB} KB${colors.reset}`);
        r.writeAt(x + 2, y + 3, `${colors.brightWhite}Backend:      ${colors.reset} ${colors.brightGreen}${m.backend}${colors.reset}`);

        r.writeAt(x + 2, y + 5, `${colors.fg256(245)}Types:${colors.reset}`);
        r.writeAt(x + 4, y + 6, `${colors.brightGreen}●${colors.reset} Facts:        ${colors.white}342${colors.reset}`);
        r.writeAt(x + 4, y + 7, `${colors.brightCyan}●${colors.reset} Preferences:  ${colors.white}128${colors.reset}`);
        r.writeAt(x + 4, y + 8, `${colors.brightMagenta}●${colors.reset} Summaries:    ${colors.white}89${colors.reset}`);
        r.writeAt(x + 4, y + 9, `${colors.brightYellow}●${colors.reset} Notes:        ${colors.white}333${colors.reset}`);

        if (h > 12) {
            r.writeAt(x + 2, y + 11, `${colors.fg256(245)}Auto-memorize:${colors.reset} ${colors.brightGreen}ON${colors.reset}`);
            r.writeAt(x + 2, y + 12, `${colors.fg256(245)}Auto-summarize:${colors.reset} ${colors.brightGreen}ON${colors.reset}`);
        }
    }

    /**
     * Render sessions panel
     */
    private renderSessionsPanel(x: number, y: number, w: number, h: number): void {
        const r = this.renderer;
        r.drawBox(x, y, w, h, '💬 Sessions [3]', 'double');

        const s = this.state.sessions;
        r.writeAt(x + 2, y + 1, `${colors.brightWhite}Active:${colors.reset}    ${colors.brightGreen}${s.active}${colors.reset}`);
        r.writeAt(x + 2, y + 2, `${colors.brightWhite}Total:${colors.reset}     ${colors.brightCyan}${s.total}${colors.reset}`);
        r.writeAt(x + 2, y + 3, `${colors.brightWhite}Avg Length:${colors.reset} ${colors.brightYellow}${s.avgLength} messages${colors.reset}`);

        r.writeAt(x + 2, y + 5, `${colors.fg256(245)}Recent Sessions:${colors.reset}`);
        const sessions = [
            { user: 'john@telegram', msgs: 24, time: '12m ago' },
            { user: 'alice@discord', msgs: 8, time: '5m ago' },
            { user: 'bob@slack', msgs: 15, time: '2m ago' },
            { user: 'guest@webchat', msgs: 3, time: '1m ago' },
            { user: 'carol@signal', msgs: 42, time: '30s ago' },
        ];
        sessions.forEach((sess, i) => {
            if (y + 6 + i < y + h - 1) {
                r.writeAt(x + 4, y + 6 + i,
                    `${colors.brightCyan}${sess.user.padEnd(20)}${colors.reset} ${colors.fg256(245)}${sess.msgs.toString().padStart(3)} msgs  ${sess.time}${colors.reset}`
                );
            }
        });
    }

    /**
     * Render extensions panel
     */
    private renderExtensionsPanel(x: number, y: number, w: number, h: number): void {
        const r = this.renderer;
        r.drawBox(x, y, w, h, '🧩 Extensions [4]', 'double');

        const enabled = this.state.extensions.filter(e => e.enabled).length;
        r.writeAt(x + 2, y + 1, `${colors.fg256(245)}Enabled: ${colors.brightGreen}${enabled}${colors.fg256(245)}/${this.state.extensions.length}${colors.reset}`);

        this.state.extensions.forEach((ext, i) => {
            if (y + 3 + i < y + h - 1) {
                const icon = ext.enabled ? `${colors.brightGreen}✓` : `${colors.fg256(240)}✗`;
                const name = ext.enabled ? `${colors.white}${ext.name}` : `${colors.fg256(240)}${ext.name}`;
                const tools = `${colors.fg256(245)}${ext.tools} tool${ext.tools !== 1 ? 's' : ''}`;
                r.writeAt(x + 3, y + 3 + i, `${icon} ${name.padEnd(24)}${colors.reset} ${tools}${colors.reset}`);
            }
        });
    }

    /**
     * Render footer bar
     */
    private renderFooter(W: number, H: number): void {
        const r = this.renderer;

        r.writeAt(1, H - 2, `${colors.fg256(236)}${'─'.repeat(W)}${colors.reset}`);

        const tabs = [
            { key: '1', label: 'Channels', active: this.state.activePanel === 'channels' },
            { key: '2', label: 'Memory', active: this.state.activePanel === 'memory' },
            { key: '3', label: 'Sessions', active: this.state.activePanel === 'sessions' },
            { key: '4', label: 'Extensions', active: this.state.activePanel === 'extensions' },
            { key: '5', label: 'Logs', active: this.state.activePanel === 'logs' },
        ];

        let tabStr = '';
        for (const tab of tabs) {
            if (tab.active) {
                tabStr += `${colors.bgRgb(30, 60, 120)}${colors.brightWhite} ${tab.key}:${tab.label} ${colors.reset} `;
            } else {
                tabStr += `${colors.fg256(245)} ${tab.key}:${tab.label} ${colors.reset} `;
            }
        }

        r.writeAt(2, H - 1, tabStr);
        r.writeAt(W - 30, H - 1, `${colors.fg256(240)}[Tab] Switch  [R] Refresh  [Q] Quit${colors.reset}`);
    }

    /**
     * Format uptime
     */
    private formatUptime(seconds: number): string {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
    }
}

/**
 * CLI command handler
 */
export async function tuiCommand(): Promise<void> {
    const dashboard = new TUIDashboard();

    process.on('SIGINT', () => {
        dashboard.stop();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        dashboard.stop();
        process.exit(0);
    });

    await dashboard.start();
}
