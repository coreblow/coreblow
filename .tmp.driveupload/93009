/**
 * CoreBlow — Mock Factory
 *
 * Creates mock objects, spy functions, and stub
 * services for testing. Supports call tracking,
 * return value configuration, and auto-mocking.
 */

/** Spy call record */
export interface SpyCall {
    args: unknown[];
    returnValue: unknown;
    timestamp: number;
}

/** Spy function */
export interface SpyFn {
    (...args: unknown[]): unknown;
    calls: SpyCall[];
    callCount: number;
    lastCall: SpyCall | null;
    reset: () => void;
}

/**
 * CoreBlow Mock Factory
 */
export class MockFactory {
    private mocks = new Map<string, unknown>();

    /**
     * Create a spy function.
     */
    createSpy(returnValue?: unknown): SpyFn {
        const calls: SpyCall[] = [];
        const spy = ((...args: unknown[]) => {
            const call: SpyCall = { args, returnValue, timestamp: Date.now() };
            calls.push(call);
            spy.calls = calls;
            spy.callCount = calls.length;
            spy.lastCall = call;
            return returnValue;
        }) as SpyFn;

        spy.calls = calls;
        spy.callCount = 0;
        spy.lastCall = null;
        spy.reset = () => { calls.length = 0; spy.callCount = 0; spy.lastCall = null; };
        return spy;
    }

    /**
     * Create a spy that returns different values in sequence.
     */
    createSequenceSpy(values: unknown[]): SpyFn {
        let index = 0;
        const calls: SpyCall[] = [];
        const spy = ((...args: unknown[]) => {
            const returnValue = values[Math.min(index, values.length - 1)];
            index++;
            const call: SpyCall = { args, returnValue, timestamp: Date.now() };
            calls.push(call);
            spy.calls = calls;
            spy.callCount = calls.length;
            spy.lastCall = call;
            return returnValue;
        }) as SpyFn;

        spy.calls = calls;
        spy.callCount = 0;
        spy.lastCall = null;
        spy.reset = () => { calls.length = 0; spy.callCount = 0; spy.lastCall = null; index = 0; };
        return spy;
    }

    /**
     * Create a mock object from template.
     */
    createMock<T extends Record<string, unknown>>(template: T): T & { __mocks: Record<string, SpyFn> } {
        const mocks: Record<string, SpyFn> = {};
        const mock: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(template)) {
            if (typeof value === 'function') {
                mocks[key] = this.createSpy(undefined);
                mock[key] = mocks[key];
            } else {
                mock[key] = value;
            }
        }

        (mock as Record<string, unknown>).__mocks = mocks;
        return mock as T & { __mocks: Record<string, SpyFn> };
    }

    /**
     * Register a named mock.
     */
    register(name: string, mock: unknown): void {
        this.mocks.set(name, mock);
    }

    /**
     * Get a named mock.
     */
    get<T = unknown>(name: string): T | null {
        return (this.mocks.get(name) as T) ?? null;
    }

    /**
     * Clear all mocks.
     */
    clear(): void {
        this.mocks.clear();
    }

    /** Count */
    count(): number { return this.mocks.size; }
}
