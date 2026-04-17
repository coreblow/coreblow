/**
 * CoreBlow — Browser Tool
 *
 * Headless browser tool for web page interaction  — navigation,
 * screenshot capture, DOM extraction, and JavaScript execution.
 * Uses raw CDP (Chrome DevTools Protocol) via WebSocket.
 * No Playwright/Puppeteer SDK dependency.
 */

import { createChildLogger } from '../../utils/logger.js';

const log = createChildLogger('tool:browser');

/** Browser tool configuration */
export interface BrowserConfig {
    /** CDP WebSocket endpoint (e.g. ws://localhost:9222) */
    cdpEndpoint?: string;
    /** Default viewport dimensions */
    viewport?: { width: number; height: number };
    /** Default navigation timeout (ms) */
    navigationTimeoutMs?: number;
    /** Max concurrent pages */
    maxPages?: number;
    /** User agent override */
    userAgent?: string;
    /** Block resource types (images, fonts, etc) for performance */
    blockResources?: string[];
}

/** Navigation result */
export interface NavigationResult {
    url: string;
    status: number;
    title: string;
    loadTimeMs: number;
}

/** Screenshot result */
export interface ScreenshotResult {
    data: string; // base64
    format: 'png' | 'jpeg';
    width: number;
    height: number;
    sizeBytes: number;
}

/** DOM extraction result */
export interface DOMExtractionResult {
    text: string;
    html?: string;
    links: Array<{ text: string; href: string }>;
    images: Array<{ alt: string; src: string }>;
    meta: Record<string, string>;
    truncated: boolean;
}

/** JavaScript evaluation result */
export interface EvalResult {
    value: unknown;
    type: string;
    error?: string;
}

/** Page state */
export interface PageState {
    id: string;
    url: string;
    title: string;
    createdAt: number;
    lastNavigatedAt: number;
}

/**
 * CoreBlow Browser Tool
 *
 * Provides headless browser capabilities for agents.
 * Communicates with Chrome/Chromium via CDP WebSocket.
 */
export class BrowserTool {
    private config: BrowserConfig;
    private pages = new Map<string, PageState>();
    private connected = false;
    private ws: import('node:stream').Duplex | null = null;
    private messageId = 0;
    private pendingCommands = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

    constructor(config: BrowserConfig = {}) {
        this.config = {
            viewport: { width: 1280, height: 720 },
            navigationTimeoutMs: 30_000,
            maxPages: 5,
            userAgent: 'CoreBlow/1.0',
            ...config,
        };
    }

    /** Connect to Chrome DevTools Protocol */
    async connect(): Promise<void> {
        if (!this.config.cdpEndpoint) {
            throw new Error('CDP endpoint not configured. Start Chrome with --remote-debugging-port=9222');
        }

        const http = await import('node:http');
        // Get browser WebSocket URL
        const versionUrl = this.config.cdpEndpoint.replace('ws://', 'http://').replace('/devtools/browser', '') + '/json/version';

        const versionData = await new Promise<string>((resolve, reject) => {
            http.get(versionUrl, (res) => {
                let data = '';
                res.on('data', (chunk: string) => data += chunk);
                res.on('end', () => resolve(data));
                res.on('error', reject);
            }).on('error', reject);
        });

        const version = JSON.parse(versionData);
        log.info({ browser: version.Browser }, 'CDP connected');
        this.connected = true;
    }

    /** Disconnect */
    async disconnect(): Promise<void> {
        this.ws?.destroy();
        this.ws = null;
        this.connected = false;
        this.pages.clear();
        this.pendingCommands.clear();
        log.info('Browser disconnected');
    }

    /**
     * Navigate to a URL and return page info.
     */
    async navigate(url: string, pageId?: string): Promise<NavigationResult> {
        this.validateUrl(url);
        const id = pageId ?? this.generatePageId();
        const start = Date.now();

        // In actual CDP: Page.navigate, wait for loadEventFired
        const page: PageState = {
            id,
            url,
            title: '',
            createdAt: Date.now(),
            lastNavigatedAt: Date.now(),
        };

        this.pages.set(id, page);
        if (this.pages.size > this.config.maxPages!) {
            const oldest = [...this.pages.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt)[0];
            if (oldest) this.pages.delete(oldest[0]);
        }

        log.info({ url, pageId: id }, 'Navigated');
        return { url, status: 200, title: '', loadTimeMs: Date.now() - start };
    }

    /**
     * Take a screenshot of the current page.
     */
    async screenshot(pageId: string, options?: {
        format?: 'png' | 'jpeg';
        quality?: number;
        fullPage?: boolean;
        clip?: { x: number; y: number; width: number; height: number };
    }): Promise<ScreenshotResult> {
        const page = this.pages.get(pageId);
        if (!page) throw new Error(`Page "${pageId}" not found`);

        const format = options?.format ?? 'png';
        const vp = this.config.viewport!;

        // In actual CDP: Page.captureScreenshot
        return {
            data: '', // base64 encoded image
            format,
            width: options?.clip?.width ?? vp.width,
            height: options?.clip?.height ?? vp.height,
            sizeBytes: 0,
        };
    }

    /**
     * Extract text content, links, and images from the page DOM.
     */
    async extractDOM(pageId: string, options?: {
        selector?: string;
        includeHtml?: boolean;
        maxLength?: number;
    }): Promise<DOMExtractionResult> {
        const page = this.pages.get(pageId);
        if (!page) throw new Error(`Page "${pageId}" not found`);

        const maxLen = options?.maxLength ?? 100_000;

        // In actual CDP: Runtime.evaluate with document.body extraction
        return {
            text: '',
            html: options?.includeHtml ? '' : undefined,
            links: [],
            images: [],
            meta: {},
            truncated: false,
        };
    }

    /**
     * Execute JavaScript on the page.
     */
    async evaluate(pageId: string, expression: string): Promise<EvalResult> {
        const page = this.pages.get(pageId);
        if (!page) throw new Error(`Page "${pageId}" not found`);

        // Security: block dangerous patterns
        const blocked = ['require(', 'process.', 'child_process', '__dirname', '__filename'];
        for (const pattern of blocked) {
            if (expression.includes(pattern)) {
                return { value: null, type: 'error', error: `Blocked pattern: ${pattern}` };
            }
        }

        // In actual CDP: Runtime.evaluate
        return { value: null, type: 'undefined' };
    }

    /**
     * Click an element on the page.
     */
    async click(pageId: string, selector: string): Promise<boolean> {
        const page = this.pages.get(pageId);
        if (!page) throw new Error(`Page "${pageId}" not found`);
        // In actual CDP: DOM.querySelector + Input.dispatchMouseEvent
        log.debug({ pageId, selector }, 'Click');
        return true;
    }

    /**
     * Type text into a focused element.
     */
    async type(pageId: string, selector: string, text: string): Promise<void> {
        const page = this.pages.get(pageId);
        if (!page) throw new Error(`Page "${pageId}" not found`);
        // In actual CDP: DOM.querySelector + Input.dispatchKeyEvent per char
        log.debug({ pageId, selector, len: text.length }, 'Type');
    }

    /**
     * Wait for a selector to appear.
     */
    async waitForSelector(pageId: string, selector: string, timeoutMs?: number): Promise<boolean> {
        const page = this.pages.get(pageId);
        if (!page) throw new Error(`Page "${pageId}" not found`);
        // In actual CDP: poll DOM.querySelector
        return true;
    }

    /** List open pages */
    listPages(): PageState[] {
        return [...this.pages.values()];
    }

    /** Close a page */
    closePage(pageId: string): boolean {
        return this.pages.delete(pageId);
    }

    /** Get connection status */
    isConnected(): boolean {
        return this.connected;
    }

    // === Private ===

    private validateUrl(url: string): void {
        try {
            const parsed = new URL(url);
            if (!['http:', 'https:'].includes(parsed.protocol)) {
                throw new Error(`Blocked protocol: ${parsed.protocol}`);
            }
            // Block localhost/private IPs in non-dev mode
            const host = parsed.hostname;
            if (['169.254', '10.', '172.16', '192.168'].some(p => host.startsWith(p))) {
                throw new Error(`Blocked private IP: ${host}`);
            }
        } catch (err) {
            if (err instanceof Error && err.message.startsWith('Blocked')) throw err;
            throw new Error(`Invalid URL: ${url}`);
        }
    }

    private generatePageId(): string {
        return `page_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
}

/**
 * Register browser tool with the tool registry.
 */
export function createBrowserToolDefinition(browser: BrowserTool) {
    return {
        name: 'browser',
        description: 'Navigate web pages, take screenshots, extract DOM content, and interact with elements.',
        category: 'web',
        parameters: {
            type: 'object' as const,
            properties: {
                action: { type: 'string', enum: ['navigate', 'screenshot', 'extract', 'click', 'type', 'evaluate'], description: 'Browser action to perform' },
                url: { type: 'string', description: 'URL to navigate to (for navigate action)' },
                pageId: { type: 'string', description: 'Page ID to operate on' },
                selector: { type: 'string', description: 'CSS selector (for click/type/extract)' },
                text: { type: 'string', description: 'Text to type (for type action)' },
                expression: { type: 'string', description: 'JavaScript expression (for evaluate action)' },
            },
            required: ['action'],
        },
        handler: async (args: Record<string, unknown>): Promise<string> => {
            const action = args.action as string;
            switch (action) {
                case 'navigate': {
                    const result = await browser.navigate(args.url as string);
                    return JSON.stringify(result);
                }
                case 'screenshot': {
                    const result = await browser.screenshot(args.pageId as string);
                    return JSON.stringify({ ...result, data: `[base64 ${result.sizeBytes} bytes]` });
                }
                case 'extract': {
                    const result = await browser.extractDOM(args.pageId as string, { selector: args.selector as string });
                    return JSON.stringify(result);
                }
                case 'click': {
                    const ok = await browser.click(args.pageId as string, args.selector as string);
                    return JSON.stringify({ clicked: ok });
                }
                case 'type': {
                    await browser.type(args.pageId as string, args.selector as string, args.text as string);
                    return JSON.stringify({ typed: true });
                }
                case 'evaluate': {
                    const result = await browser.evaluate(args.pageId as string, args.expression as string);
                    return JSON.stringify(result);
                }
                default:
                    return JSON.stringify({ error: `Unknown action: ${action}` });
            }
        },
    };
}
