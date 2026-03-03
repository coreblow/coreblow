/**
 * bridge/test.js
 * Quick integration test for the ScraperBridge
 */

const { ScraperBridge } = require('./index');

async function main() {
    console.log('🕷️ Testing ScraperBridge...\n');

    const bridge = new ScraperBridge({
        workerUrl: process.env.WORKER_URL || 'https://super-scraper-worker.febrinanda-co2.workers.dev',
        apiKey: process.env.WORKER_API_KEY || '',
    });

    // Listen for output events
    bridge.on('output', (data) => process.stdout.write(data));
    bridge.on('error', (data) => process.stderr.write(data));

    try {
        // Test 1: Quick scrape via Python engine
        console.log('--- Test 1: Quick Scrape ---');
        const result = await bridge.execute({
            url: 'https://example.com',
            selectors: { title: 'h1', content: 'p' },
        });
        console.log('\nResult:', JSON.stringify(result, null, 2));

        // Test 2: Get stats via API
        if (bridge.apiKey) {
            console.log('\n--- Test 2: API Stats ---');
            const stats = await bridge.getStats();
            console.log('Stats:', JSON.stringify(stats, null, 2));
        }

        console.log('\n✅ All tests passed!');
    } catch (err) {
        console.error('\n❌ Test failed:', err.message);
        process.exit(1);
    }
}

main();
