/**
 * CoreBlow — Desktop Notification (Safe)
 *
 * Sends macOS desktop notifications via osascript.
 * Inputs are sanitized to prevent command injection.
 */

import { execSync } from 'node:child_process';

function sanitizeForAppleScript(input: string): string {
    return input
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/'/g, "\\'")
        .replace(/`/g, '\\`')
        .replace(/\$/g, '\\$')
        .replace(/\n/g, ' ')
        .replace(/\r/g, '')
        .slice(0, 256); // cap length to prevent abuse
}

export function notify(title: string, body: string): void {
    const safeTitle = sanitizeForAppleScript(title);
    const safeBody = sanitizeForAppleScript(body);

    try {
        execSync(
            `osascript -e 'display notification "${safeBody}" with title "${safeTitle}"'`,
            { stdio: 'ignore', timeout: 5_000 },
        );
    } catch {
        /* intentionally ignored: notification is best-effort, may fail on non-macOS */
    }
}
