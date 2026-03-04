/**
 * src/tools/scrape/bridge.ts
 * Node → Python bridge for Ultra Skills scraper engine
 * Communicates via JSON over stdin/stdout with child_process
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { createChildLogger } from '../../utils/logger.js';

const log = createChildLogger('scrape:bridge');

/**
 * Call the Ultra Skills Python scraper via stdin/stdout bridge
 */
export async function scrapeBridge(target: Record<string, any>): Promise<any> {
    // Find the bridge entry script
    const possiblePaths = [
        path.resolve(process.cwd(), '../ultra-skills/scraper/bridge_entry.py'),
        path.resolve(process.cwd(), '../ultra-skills/bridge/bridge_entry.py'),
        path.join(process.env.HOME || '', 'coreblow.com/ultra-skills/scraper/bridge_entry.py'),
    ];

    let bridgePath = '';
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            bridgePath = p;
            break;
        }
    }

    if (!bridgePath) {
        log.warn('Ultra Skills bridge not found, using fallback fetch scraper');
        return await fallbackScrape(target);
    }

    return new Promise((resolve, reject) => {
        const proc = spawn('python3', [bridgePath], {
            stdio: ['pipe', 'pipe', 'pipe'],
            timeout: 120_000,
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => { stdout += data.toString(); });
        proc.stderr.on('data', (data) => { stderr += data.toString(); });

        proc.on('close', (code) => {
            if (code === 0 && stdout) {
                try {
                    resolve(JSON.parse(stdout));
                } catch {
                    resolve(stdout);
                }
            } else {
                reject(new Error(stderr || `Bridge exited with code ${code}`));
            }
        });

        proc.on('error', (err) => {
            reject(new Error(`Bridge spawn failed: ${err.message}`));
        });

        // Send target as JSON via stdin
        proc.stdin.write(JSON.stringify(target));
        proc.stdin.end();
    });
}

/**
 * Fallback: simple fetch-based scraper (no Playwright needed)
 */
async function fallbackScrape(target: Record<string, any>): Promise<any> {
    const { url } = target;

    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            signal: AbortSignal.timeout(30000),
        });

        if (!res.ok) {
            return { status: 'failed', error: `HTTP ${res.status}`, url };
        }

        const html = await res.text();
        const title = html.match(/<title[^>]*>(.*?)<\/title>/i)?.[1] || '';

        // Basic extraction if selectors provided
        let extracted: Record<string, string> = {};
        const selectors = typeof target.selectors === 'string'
            ? JSON.parse(target.selectors)
            : target.selectors;

        if (selectors && Object.keys(selectors).length > 0) {
            // Simple regex extraction for common patterns
            for (const [key, selector] of Object.entries(selectors)) {
                const tag = (selector as string).replace(/[.#\[\]]/g, '');
                const regex = new RegExp(`<[^>]*(?:class|id)="[^"]*${tag}[^"]*"[^>]*>(.*?)<\/`, 'i');
                const match = html.match(regex);
                if (match) {
                    extracted[key] = match[1].replace(/<[^>]+>/g, '').trim();
                }
            }
        }

        return {
            status: 'success',
            url,
            title,
            extracted_data: extracted,
            content_length: html.length,
            note: 'Used fallback scraper (no Playwright). Install Ultra Skills for full functionality.',
        };
    } catch (err: any) {
        return { status: 'failed', error: err.message, url };
    }
}
