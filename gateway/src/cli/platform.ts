/**
 * src/cli/platform.ts
 * CLI: coreblow platform — install/manage platform services (LaunchAgent, systemd)
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('cli:platform');

const PLIST_LABEL = 'com.coreblow.gateway';
const SYSTEMD_SERVICE = 'coreblow-gateway';

export async function platformCommand(action?: string) {
    const platform = process.platform;

    switch (action) {
        case 'install':
            if (platform === 'darwin') {
                await installLaunchAgent();
            } else if (platform === 'linux') {
                await installSystemd();
            } else {
                console.log(`Platform services not supported on ${platform}.`);
                console.log('Supported: macOS (LaunchAgent), Linux (systemd)');
            }
            break;

        case 'uninstall':
            if (platform === 'darwin') {
                await uninstallLaunchAgent();
            } else if (platform === 'linux') {
                await uninstallSystemd();
            }
            break;

        case 'status':
            if (platform === 'darwin') {
                try {
                    const output = execSync(`launchctl list ${PLIST_LABEL} 2>&1`, { encoding: 'utf-8' });
                    console.log('✅ LaunchAgent is loaded');
                    console.log(output);
                } catch {
                    console.log('⚫ LaunchAgent not installed/loaded');
                }
            } else if (platform === 'linux') {
                try {
                    const output = execSync(`systemctl --user status ${SYSTEMD_SERVICE} 2>&1`, { encoding: 'utf-8' });
                    console.log(output);
                } catch (err: any) {
                    console.log(err.stdout || '⚫ Service not installed');
                }
            }
            break;

        default:
            console.log('Usage: coreblow platform <install|uninstall|status>');
            console.log('');
            console.log('  install    Set up auto-start on login');
            console.log('  uninstall  Remove auto-start');
            console.log('  status     Check service status');
    }
}

async function installLaunchAgent() {
    const home = process.env.HOME || '/Users/' + process.env.USER;
    const plistDir = path.join(home, 'Library', 'LaunchAgents');
    const plistPath = path.join(plistDir, `${PLIST_LABEL}.plist`);
    const nodePath = execSync('which node', { encoding: 'utf-8' }).trim();
    const gatewayPath = path.resolve(process.cwd(), 'dist', 'index.js');
    const logPath = path.join(home, '.coreblow', 'logs');

    fs.mkdirSync(plistDir, { recursive: true });
    fs.mkdirSync(logPath, { recursive: true });

    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${PLIST_LABEL}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${nodePath}</string>
        <string>${gatewayPath}</string>
        <string>gateway</string>
        <string>start</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${logPath}/gateway.log</string>
    <key>StandardErrorPath</key>
    <string>${logPath}/gateway.error.log</string>
    <key>WorkingDirectory</key>
    <string>${path.dirname(gatewayPath)}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:${path.dirname(nodePath)}</string>
    </dict>
</dict>
</plist>`;

    fs.writeFileSync(plistPath, plist);
    execSync(`launchctl load ${plistPath}`);

    console.log('✅ LaunchAgent installed!');
    console.log(`   Plist: ${plistPath}`);
    console.log(`   Logs: ${logPath}/gateway.log`);
    console.log('   Gateway will auto-start on login.');
    console.log('');
    console.log('   To start now: launchctl start com.coreblow.gateway');
    console.log('   To stop:      launchctl stop com.coreblow.gateway');
}

async function uninstallLaunchAgent() {
    const home = process.env.HOME || '/Users/' + process.env.USER;
    const plistPath = path.join(home, 'Library', 'LaunchAgents', `${PLIST_LABEL}.plist`);

    if (fs.existsSync(plistPath)) {
        try { execSync(`launchctl unload ${plistPath}`); } catch { /* might not be loaded */ }
        fs.unlinkSync(plistPath);
        console.log('✅ LaunchAgent removed.');
    } else {
        console.log('LaunchAgent not installed.');
    }
}

async function installSystemd() {
    const home = process.env.HOME || '';
    const serviceDir = path.join(home, '.config', 'systemd', 'user');
    const servicePath = path.join(serviceDir, `${SYSTEMD_SERVICE}.service`);
    const nodePath = execSync('which node', { encoding: 'utf-8' }).trim();
    const gatewayPath = path.resolve(process.cwd(), 'dist', 'index.js');

    fs.mkdirSync(serviceDir, { recursive: true });

    const unit = `[Unit]
Description=CoreBlow AI Gateway
After=network.target

[Service]
Type=simple
ExecStart=${nodePath} ${gatewayPath} gateway start
Restart=on-failure
RestartSec=5
WorkingDirectory=${path.dirname(gatewayPath)}
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
`;

    fs.writeFileSync(servicePath, unit);
    execSync('systemctl --user daemon-reload');
    execSync(`systemctl --user enable ${SYSTEMD_SERVICE}`);

    console.log('✅ systemd user service installed!');
    console.log(`   Unit: ${servicePath}`);
    console.log('');
    console.log(`   To start: systemctl --user start ${SYSTEMD_SERVICE}`);
    console.log(`   To stop:  systemctl --user stop ${SYSTEMD_SERVICE}`);
    console.log(`   Logs:     journalctl --user -u ${SYSTEMD_SERVICE} -f`);
}

async function uninstallSystemd() {
    const home = process.env.HOME || '';
    const servicePath = path.join(home, '.config', 'systemd', 'user', `${SYSTEMD_SERVICE}.service`);

    if (fs.existsSync(servicePath)) {
        try { execSync(`systemctl --user stop ${SYSTEMD_SERVICE}`); } catch { /* might not be running */ }
        try { execSync(`systemctl --user disable ${SYSTEMD_SERVICE}`); } catch { /* might not be enabled */ }
        fs.unlinkSync(servicePath);
        execSync('systemctl --user daemon-reload');
        console.log('✅ systemd service removed.');
    } else {
        console.log('systemd service not installed.');
    }
}
