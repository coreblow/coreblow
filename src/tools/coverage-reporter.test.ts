import { describe, beforeEach, expect, it } from "vitest";
import { CoverageReporter, type FileCoverage } from "./coverage-reporter.js";

let reporter: CoverageReporter;

function makeCoverage(file: string, opts?: {
    lines?: [number, number];
    fns?: [number, number];
    branches?: [number, number];
}): FileCoverage {
    return {
        file,
        lines: { total: opts?.lines?.[0] ?? 100, covered: opts?.lines?.[1] ?? 90 },
        functions: { total: opts?.fns?.[0] ?? 20, covered: opts?.fns?.[1] ?? 18 },
        branches: { total: opts?.branches?.[0] ?? 30, covered: opts?.branches?.[1] ?? 25 },
    };
}

beforeEach(() => {
    reporter = new CoverageReporter();
});

describe("CoverageReporter — construction", () => {
    it("constructs with zero files", () => {
        expect(reporter.count()).toBe(0);
    });
});

describe("CoverageReporter — addFile / getFile", () => {
    it("adds and retrieves a file coverage entry", () => {
        const cov = makeCoverage("src/foo.ts");
        reporter.addFile(cov);
        expect(reporter.count()).toBe(1);
        expect(reporter.getFile("src/foo.ts")).toEqual(cov);
    });

    it("returns null for unknown files", () => {
        expect(reporter.getFile("nonexistent")).toBeNull();
    });

    it("overwrites existing entry on same file", () => {
        reporter.addFile(makeCoverage("a.ts", { lines: [100, 50] }));
        reporter.addFile(makeCoverage("a.ts", { lines: [100, 99] }));
        expect(reporter.count()).toBe(1);
        expect(reporter.getFile("a.ts")!.lines.covered).toBe(99);
    });
});

describe("CoverageReporter — getSummary", () => {
    it("returns zeroed summary with no files", () => {
        const s = reporter.getSummary();
        expect(s.totalFiles).toBe(0);
        expect(s.overallCoverage).toBe(0);
        expect(s.belowThreshold).toHaveLength(0);
    });

    it("computes line/function/branch coverage correctly", () => {
        reporter.addFile(makeCoverage("a.ts", { lines: [100, 80], fns: [10, 10], branches: [20, 10] }));
        const s = reporter.getSummary();
        expect(s.lineCoverage).toBe(80);
        expect(s.functionCoverage).toBe(100);
        expect(s.branchCoverage).toBe(50);
        expect(s.overallCoverage).toBeCloseTo((80 + 100 + 50) / 3, 1);
    });

    it("identifies files below threshold", () => {
        reporter.setThreshold(90);
        reporter.addFile(makeCoverage("good.ts", { lines: [100, 95] }));
        reporter.addFile(makeCoverage("bad.ts", { lines: [100, 50] }));
        const s = reporter.getSummary();
        expect(s.belowThreshold).toEqual(["bad.ts"]);
    });

    it("aggregates across multiple files", () => {
        reporter.addFile(makeCoverage("a.ts", { lines: [100, 100] }));
        reporter.addFile(makeCoverage("b.ts", { lines: [100, 0] }));
        const s = reporter.getSummary();
        expect(s.totalFiles).toBe(2);
        expect(s.lineCoverage).toBe(50);
    });
});

describe("CoverageReporter — getTrend", () => {
    it("records history on each getSummary call", () => {
        reporter.addFile(makeCoverage("a.ts"));
        reporter.getSummary();
        reporter.getSummary();
        const trend = reporter.getTrend();
        expect(trend).toHaveLength(2);
        expect(trend[0]).toHaveProperty("timestamp");
        expect(trend[0]).toHaveProperty("coverage");
    });

    it("respects limit parameter", () => {
        reporter.addFile(makeCoverage("a.ts"));
        for (let i = 0; i < 20; i++) reporter.getSummary();
        expect(reporter.getTrend(5)).toHaveLength(5);
    });
});

describe("CoverageReporter — generateReport", () => {
    it("returns a markdown report string", () => {
        reporter.addFile(makeCoverage("src/index.ts", { lines: [100, 85], fns: [10, 9], branches: [20, 16] }));
        const report = reporter.generateReport();
        expect(report).toContain("# Coverage Report");
        expect(report).toContain("Lines");
        expect(report).toContain("Functions");
        expect(report).toContain("Branches");
        expect(report).toContain("Overall");
    });

    it("includes below-threshold section when files fail", () => {
        reporter.setThreshold(95);
        reporter.addFile(makeCoverage("bad.ts", { lines: [100, 50] }));
        const report = reporter.generateReport();
        expect(report).toContain("Below 95% Threshold");
        expect(report).toContain("bad.ts");
    });
});
