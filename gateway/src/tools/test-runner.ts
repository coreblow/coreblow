/**
 * CoreBlow — Test Runner
 *
 * Lightweight test runner for integration tests.
 * Supports suites, hooks (before/after), timeouts,
 * and detailed reporting.
 */

/** Test case */
export interface TestCase {
    name: string;
    fn: () => Promise<void>;
    timeout?: number;
    skip?: boolean;
    only?: boolean;
}

/** Test suite */
export interface TestSuite {
    name: string;
    tests: TestCase[];
    beforeAll?: () => Promise<void>;
    afterAll?: () => Promise<void>;
    beforeEach?: () => Promise<void>;
    afterEach?: () => Promise<void>;
}

/** Test result */
export interface TestResult {
    suite: string;
    test: string;
    status: 'passed' | 'failed' | 'skipped' | 'timeout';
    durationMs: number;
    error?: string;
}

/** Run report */
export interface RunReport {
    suites: number;
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    durationMs: number;
    results: TestResult[];
}

/**
 * CoreBlow Test Runner
 */
export class TestRunner {
    private suites: TestSuite[] = [];

    /**
     * Add a test suite.
     */
    addSuite(suite: TestSuite): void {
        this.suites.push(suite);
    }

    /**
     * Run all suites.
     */
    async run(): Promise<RunReport> {
        const start = Date.now();
        const results: TestResult[] = [];

        for (const suite of this.suites) {
            if (suite.beforeAll) await suite.beforeAll();

            const onlyTests = suite.tests.filter((t) => t.only);
            const testsToRun = onlyTests.length > 0 ? onlyTests : suite.tests;

            for (const test of testsToRun) {
                if (test.skip) {
                    results.push({ suite: suite.name, test: test.name, status: 'skipped', durationMs: 0 });
                    continue;
                }

                if (suite.beforeEach) await suite.beforeEach();
                const testStart = Date.now();
                const timeout = test.timeout ?? 5000;

                try {
                    await Promise.race([
                        test.fn(),
                        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('TIMEOUT')), timeout)),
                    ]);
                    results.push({ suite: suite.name, test: test.name, status: 'passed', durationMs: Date.now() - testStart });
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    results.push({
                        suite: suite.name, test: test.name,
                        status: msg === 'TIMEOUT' ? 'timeout' : 'failed',
                        durationMs: Date.now() - testStart, error: msg,
                    });
                }

                if (suite.afterEach) await suite.afterEach();
            }

            if (suite.afterAll) await suite.afterAll();
        }

        return {
            suites: this.suites.length,
            total: results.length,
            passed: results.filter((r) => r.status === 'passed').length,
            failed: results.filter((r) => r.status === 'failed').length,
            skipped: results.filter((r) => r.status === 'skipped').length,
            durationMs: Date.now() - start,
            results,
        };
    }

    /** Count suites */
    count(): number { return this.suites.length; }
}
