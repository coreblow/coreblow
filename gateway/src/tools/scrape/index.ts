/**
 * src/tools/scrape/index.ts
 * Scrape tool registration — exposes Ultra Skills engine as an AI tool
 */

import type { ToolHandler } from '../types.js';
import { scrapeBridge } from './bridge.js';
import { createChildLogger } from '../../utils/logger.js';

const log = createChildLogger('tool:scrape');

export const scrapeTool: ToolHandler = {
    name: 'scrape',
    description: 'Scrape a website using the Ultra Skills engine. Extract data with CSS/XPath selectors, handle pagination, proxy rotation, and stealth browsing.',
    parameters: {
        type: 'object',
        properties: {
            url: {
                type: 'string',
                description: 'URL to scrape',
            },
            selectors: {
                type: 'object',
                description: 'CSS selectors to extract data. Keys are field names, values are selectors. Example: {"title": "h1", "price": ".price"}',
            },
            selector_type: {
                type: 'string',
                enum: ['css', 'xpath'],
                description: 'Selector type (default: css)',
            },
            wait_for_selector: {
                type: 'string',
                description: 'Wait for this selector before extracting (for JS-rendered pages)',
            },
            screenshot: {
                type: 'boolean',
                description: 'Take a screenshot (default: false)',
            },
            pagination: {
                type: 'object',
                description: 'Pagination config: { "next_selector": ".next", "max_pages": 5 }',
            },
        },
        required: ['url'],
    },

    async execute(args: Record<string, any>): Promise<string> {
        const { url, selectors, selector_type, wait_for_selector, screenshot, pagination } = args;

        log.info({ url }, 'Scraping via Ultra Skills');

        const target = {
            url,
            selectors: selectors ? JSON.stringify(selectors) : '{}',
            selector_type: selector_type || 'css',
            wait_for_selector: wait_for_selector || null,
            screenshot_enabled: screenshot || false,
            pagination_config: pagination ? JSON.stringify(pagination) : null,
        };

        try {
            const result = await scrapeBridge(target);
            return typeof result === 'string' ? result : JSON.stringify(result, null, 2);
        } catch (err: any) {
            log.error({ err: err.message, url }, 'Scrape failed');
            return `Scrape error: ${err.message}`;
        }
    },
};
