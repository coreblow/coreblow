/**
 * bridge/index.js
 * Node.js → Python Bridge for AIGateway Integration
 * Allows the Node.js gateway to invoke the Python scraper engine
 */

const { spawn } = require('child_process');
const path = require('path');
const EventEmitter = require('events');

class ScraperBridge extends EventEmitter {
    constructor(options = {}) {
        super();
        this.scraperDir = options.scraperDir || path.join(__dirname, '..', 'scraper');
        this.pythonBin = options.pythonBin || 'python3';
        this.workerUrl = options.workerUrl || process.env.WORKER_URL || '';
        this.apiKey = options.apiKey || process.env.WORKER_API_KEY || '';
        this.timeout = options.timeout || 60000;
    }

    /**
     * Execute a scrape via the Python engine
     * @param {Object} params - Scrape parameters
     * @param {string} params.url - URL to scrape
     * @param {Object} params.selectors - CSS/XPath selectors
     * @param {string} params.selectorType - 'css' or 'xpath'
     * @param {string} params.waitFor - Selector to wait for
     * @param {boolean} params.screenshot - Capture screenshot
     * @returns {Promise<Object>} Scrape results
     */
    async execute(params) {
        const { url, selectors, selectorType, waitFor, screenshot } = params;

        if (!url) {
            throw new Error('URL is required');
        }

        const args = [
            path.join(this.scraperDir, 'main.py'),
            '--url', url,
        ];

        if (selectors) {
            args.push('--selectors', JSON.stringify(selectors));
        }

        return this._runPython(args);
    }

    /**
     * Run a scrape for a specific target by ID
     * @param {number} targetId - Target ID from the database
     * @returns {Promise<Object>} Scrape results
     */
    async scrapeTarget(targetId) {
        const args = [
            path.join(this.scraperDir, 'main.py'),
            '--target-id', String(targetId),
        ];

        return this._runPython(args);
    }

    /**
     * Process all pending jobs from the queue
     * @returns {Promise<Object>} Results summary
     */
    async processPendingJobs() {
        const args = [path.join(this.scraperDir, 'main.py')];
        return this._runPython(args);
    }

    /**
     * Search scraped data via the Worker API
     * @param {Object} params - Search parameters
     * @returns {Promise<Object>} Search results
     */
    async search(params) {
        const { query, targetId } = params;
        const searchParams = new URLSearchParams();
        if (query) searchParams.set('search', query);
        if (targetId) searchParams.set('target_id', targetId);

        const res = await fetch(
            `${this.workerUrl}/api/data?${searchParams}`,
            { headers: { 'X-API-Key': this.apiKey } }
        );

        return res.json();
    }

    /**
     * Create a monitoring target
     * @param {Object} params - Monitor configuration
     * @returns {Promise<Object>} Created target
     */
    async monitor(params) {
        const { name, url, selectors, schedule, notifyOnChange } = params;

        const res = await fetch(`${this.workerUrl}/api/targets`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': this.apiKey,
            },
            body: JSON.stringify({
                name,
                url,
                selectors,
                schedule: schedule || '0 */6 * * *',
                notify_on_change_only: notifyOnChange ? 1 : 0,
            }),
        });

        return res.json();
    }

    /**
     * Get dashboard statistics
     * @returns {Promise<Object>} Stats
     */
    async getStats() {
        const res = await fetch(`${this.workerUrl}/api/stats`, {
            headers: { 'X-API-Key': this.apiKey },
        });
        return res.json();
    }

    /**
     * Internal: spawn Python process and collect output
     */
    _runPython(args) {
        return new Promise((resolve, reject) => {
            const env = {
                ...process.env,
                WORKER_URL: this.workerUrl,
                WORKER_API_KEY: this.apiKey,
            };

            const proc = spawn(this.pythonBin, args, {
                cwd: this.scraperDir,
                env,
                timeout: this.timeout,
            });

            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', (chunk) => {
                stdout += chunk.toString();
                this.emit('output', chunk.toString());
            });

            proc.stderr.on('data', (chunk) => {
                stderr += chunk.toString();
                this.emit('error', chunk.toString());
            });

            proc.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Scraper exited with code ${code}: ${stderr}`));
                    return;
                }

                try {
                    // Try to parse the JSON output (last JSON array/object in stdout)
                    const jsonMatch = stdout.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
                    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: stdout };
                    resolve(result);
                } catch {
                    resolve({ raw: stdout, stderr });
                }
            });

            proc.on('error', (err) => {
                reject(new Error(`Failed to start scraper: ${err.message}`));
            });
        });
    }
}

/**
 * Tool handler factory for AIGateway skill integration
 * Maps SKILL.md tool definitions to bridge methods
 */
function createToolHandlers(bridge) {
    return {
        scrape_execute: async (params) => {
            return bridge.execute(params);
        },

        scrape_search: async (params) => {
            return bridge.search(params);
        },

        scrape_monitor: async (params) => {
            return bridge.monitor(params);
        },
    };
}

module.exports = { ScraperBridge, createToolHandlers };
