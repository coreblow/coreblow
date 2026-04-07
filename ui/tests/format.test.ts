import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatDuration, relativeTime } from "../src/ui/format.ts";

describe("formatDuration", () => {
    it("formats milliseconds", () => {
        expect(formatDuration(500)).toBe("500ms");
    });
    
    it("formats seconds", () => {
        expect(formatDuration(2500)).toBe("2s");
    });
    
    it("formats minutes and seconds", () => {
        expect(formatDuration(62500)).toBe("1m 2s");
    });
});

describe("relativeTime", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-04-02T12:00:00Z"));
    });
    
    afterEach(() => {
        vi.useRealTimers();
    });
    
    it("returns just now for current time", () => {
        expect(relativeTime(Date.now())).toBe("just now");
    });
    
    it("returns minutes ago", () => {
        expect(relativeTime(Date.now() - 5 * 60 * 1000)).toBe("5 minutes ago");
    });
    
    it("returns hours ago", () => {
        expect(relativeTime(Date.now() - 2 * 60 * 60 * 1000)).toBe("2 hours ago");
    });
    
    it("returns days ago", () => {
        expect(relativeTime(Date.now() - 3 * 24 * 60 * 60 * 1000)).toBe("3 days ago");
    });
});
