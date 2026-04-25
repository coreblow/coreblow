import { describe, beforeEach, expect, it } from "vitest";
import { TestRunner, type TestSuite } from "./test-runner.js";

let runner: TestRunner;

beforeEach(() => {
    runner = new TestRunner();
});

describe("TestRunner — construction", () => {
    it("starts with zero suites", () => {
        expect(runner.count()).toBe(0);
    });
});

describe("TestRunner — addSuite", () => {
    it("adds a suite", () => {
        runner.addSuite({ name: "basics", tests: [] });
        expect(runner.count()).toBe(1);
    });
});

describe("TestRunner — run", () => {
    it("runs an empty suite and returns report", async () => {
        runner.addSuite({ name: "empty", tests: [] });
        const report = await runner.run();
        expect(report.suites).toBe(1);
        expect(report.total).toBe(0);
        expect(report.passed).toBe(0);
        expect(report.failed).toBe(0);
        expect(report.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("runs passing tests", async () => {
        runner.addSuite({
            name: "pass-suite",
            tests: [
                { name: "adds numbers", fn: async () => { expect(1 + 1).toBe(2); } },
                { name: "true is true", fn: async () => { expect(true).toBe(true); } },
            ],
        });
        const report = await runner.run();
        expect(report.passed).toBe(2);
        expect(report.failed).toBe(0);
        expect(report.results[0].status).toBe("passed");
    });

    it("captures failing tests", async () => {
        runner.addSuite({
            name: "fail-suite",
            tests: [
                { name: "always fails", fn: async () => { throw new Error("boom"); } },
            ],
        });
        const report = await runner.run();
        expect(report.failed).toBe(1);
        expect(report.results[0].status).toBe("failed");
        expect(report.results[0].error).toBe("boom");
    });

    it("skips tests marked with skip", async () => {
        runner.addSuite({
            name: "skip-suite",
            tests: [
                { name: "skipped", fn: async () => {}, skip: true },
                { name: "runs", fn: async () => {} },
            ],
        });
        const report = await runner.run();
        expect(report.skipped).toBe(1);
        expect(report.passed).toBe(1);
        expect(report.results[0].status).toBe("skipped");
        expect(report.results[0].durationMs).toBe(0);
    });

    it("only runs tests marked with only", async () => {
        runner.addSuite({
            name: "only-suite",
            tests: [
                { name: "excluded", fn: async () => {} },
                { name: "included", fn: async () => {}, only: true },
            ],
        });
        const report = await runner.run();
        expect(report.total).toBe(1);
        expect(report.results[0].test).toBe("included");
    });

    it("handles timeout", async () => {
        runner.addSuite({
            name: "timeout-suite",
            tests: [
                {
                    name: "slow",
                    fn: () => new Promise(() => {}), // never resolves
                    timeout: 50,
                },
            ],
        });
        const report = await runner.run();
        expect(report.results[0].status).toBe("timeout");
    });

    it("runs beforeAll/afterAll hooks", async () => {
        const log: string[] = [];
        runner.addSuite({
            name: "hooks",
            beforeAll: async () => { log.push("before"); },
            afterAll: async () => { log.push("after"); },
            tests: [{ name: "test", fn: async () => { log.push("test"); } }],
        });
        await runner.run();
        expect(log).toEqual(["before", "test", "after"]);
    });

    it("runs beforeEach/afterEach per test", async () => {
        const log: string[] = [];
        runner.addSuite({
            name: "each-hooks",
            beforeEach: async () => { log.push("be"); },
            afterEach: async () => { log.push("ae"); },
            tests: [
                { name: "t1", fn: async () => { log.push("t1"); } },
                { name: "t2", fn: async () => { log.push("t2"); } },
            ],
        });
        await runner.run();
        expect(log).toEqual(["be", "t1", "ae", "be", "t2", "ae"]);
    });
});
