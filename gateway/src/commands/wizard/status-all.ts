/**
 * commands/wizard/status-all.ts
 * Comprehensive system status dashboard.
 */

export interface SystemStatus {
    server: { uptime: number; version: string; port: number; memoryMb: number };
    sessions: { active: number; total: number };
    channels: Array<{ id: string; status: string; messages: number }>;
    models: Array<{ id: string; provider: string; available: boolean }>;
    plugins: Array<{ name: string; enabled: boolean }>;
    cron: { jobsTotal: number; jobsRunning: number };
    usage: { totalTokens: number; totalCostUsd: number };
}

export function formatSystemStatus(status: SystemStatus): string {
    const lines: string[] = ['📊 CoreBlow System Status\n'];

    // Server
    const uptimeH = (status.server.uptime / 3600).toFixed(1);
    lines.push(`🖥️  SERVER`);
    lines.push(`   Version: ${status.server.version} | Port: ${status.server.port}`);
    lines.push(`   Uptime: ${uptimeH}h | Memory: ${status.server.memoryMb.toFixed(0)}MB`);

    // Sessions
    lines.push(`\n💬 SESSIONS`);
    lines.push(`   Active: ${status.sessions.active} | Total: ${status.sessions.total}`);

    // Channels
    lines.push(`\n📡 CHANNELS (${status.channels.length})`);
    for (const c of status.channels) {
        const icon = c.status === 'connected' ? '🟢' : '🔴';
        lines.push(`   ${icon} ${c.id}: ${c.status} (${c.messages} msgs)`);
    }

    // Models
    lines.push(`\n🤖 MODELS (${status.models.length})`);
    for (const m of status.models) {
        lines.push(`   ${m.available ? '✅' : '❌'} ${m.id} (${m.provider})`);
    }

    // Plugins
    if (status.plugins.length > 0) {
        lines.push(`\n🔌 PLUGINS (${status.plugins.length})`);
        for (const p of status.plugins) lines.push(`   ${p.enabled ? '✅' : '⏸️'} ${p.name}`);
    }

    // Cron
    lines.push(`\n⏰ CRON JOBS: ${status.cron.jobsTotal} total, ${status.cron.jobsRunning} running`);

    // Usage
    lines.push(`\n💰 USAGE: ${(status.usage.totalTokens / 1000).toFixed(0)}K tokens | $${status.usage.totalCostUsd.toFixed(4)}`);

    return lines.join('\n');
}
