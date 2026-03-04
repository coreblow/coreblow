/**
 * src/tools/browser.ts
 * Playwright browser tool — AI-controlled web browsing
 */

import type { ToolHandler } from './types.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('tool:browser');

let browserInstance: any = null;
let activePage: any = null;

export const browserTool: ToolHandler = {
    name: 'browser',
    description: 'Control a web browser: open URLs, take screenshots, click elements, type text, navigate. Use for web research, testing, and automation.',
    parameters: {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['open', 'screenshot', 'click', 'type', 'navigate', 'content', 'close', 'status'],
                description: 'Browser action to perform',
            },
            url: { type: 'string', description: 'URL to open or navigate to' },
            selector: { type: 'string', description: 'CSS selector for click/type' },
            text: { type: 'string', description: 'Text to type into element' },
        },
        required: ['action'],
    },

    async execute(args: Record<string, any>): Promise<string> {
        const { action, url, selector, text } = args;

        switch (action) {
            case 'open': {
                if (!url) return 'Error: url required for open action';
                try {
                    // @ts-ignore — playwright is optional
                    const { chromium } = await import('playwright');
                    if (!browserInstance) {
                        browserInstance = await chromium.launch({ headless: true });
                        log.info('Browser launched');
                    }
                    activePage = await browserInstance.newPage();
                    await activePage.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                    const title = await activePage.title();
                    return `Opened: ${url}\nTitle: ${title}`;
                } catch (err: any) {
                    return `Error opening browser: ${err.message}`;
                }
            }

            case 'screenshot': {
                if (!activePage) return 'Error: no page open. Use action "open" first.';
                try {
                    const buffer = await activePage.screenshot({ fullPage: false });
                    const base64 = buffer.toString('base64').slice(0, 5000);
                    const title = await activePage.title();
                    const pageUrl = activePage.url();
                    return `Screenshot captured.\nPage: ${title}\nURL: ${pageUrl}\nSize: ${buffer.length} bytes`;
                } catch (err: any) {
                    return `Error: ${err.message}`;
                }
            }

            case 'click': {
                if (!activePage) return 'Error: no page open';
                if (!selector) return 'Error: selector required for click';
                try {
                    await activePage.click(selector, { timeout: 5000 });
                    await activePage.waitForTimeout(1000);
                    return `Clicked: ${selector}`;
                } catch (err: any) {
                    return `Error clicking ${selector}: ${err.message}`;
                }
            }

            case 'type': {
                if (!activePage) return 'Error: no page open';
                if (!selector || !text) return 'Error: selector and text required';
                try {
                    await activePage.fill(selector, text);
                    return `Typed "${text}" into ${selector}`;
                } catch (err: any) {
                    return `Error typing: ${err.message}`;
                }
            }

            case 'navigate': {
                if (!activePage) return 'Error: no page open';
                if (!url) return 'Error: url required';
                try {
                    await activePage.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                    const title = await activePage.title();
                    return `Navigated to: ${url}\nTitle: ${title}`;
                } catch (err: any) {
                    return `Error navigating: ${err.message}`;
                }
            }

            case 'content': {
                if (!activePage) return 'Error: no page open';
                try {
                    const text = await activePage.textContent('body');
                    const truncated = (text || '').slice(0, 10000);
                    return truncated || '(empty page)';
                } catch (err: any) {
                    return `Error: ${err.message}`;
                }
            }

            case 'close': {
                if (browserInstance) {
                    await browserInstance.close();
                    browserInstance = null;
                    activePage = null;
                    return 'Browser closed';
                }
                return 'No browser to close';
            }

            case 'status': {
                return browserInstance
                    ? `Browser running. Page: ${activePage ? activePage.url() : 'none'}`
                    : 'Browser not running';
            }

            default:
                return `Unknown action: ${action}`;
        }
    },
};
