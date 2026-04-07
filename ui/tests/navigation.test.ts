import { describe, it, expect } from "vitest";
import { iconForTab, titleForTab } from "../src/ui/navigation.ts";

describe("navigation utils", () => {
    it("returns correct icons for known tabs", () => {
        expect(iconForTab("chat")).toBe("messageSquare");
        expect(iconForTab("overview")).toBe("barChart");
        expect(iconForTab("config")).toBe("settings");
    });
    
    it("returns fallback icon for unknown tab", () => {
        expect(iconForTab("unknown_tab" as any)).toBe("folder");
    });
    
    it("returns correct titles", () => {
        expect(titleForTab("aiAgents")).toBe("AI Agents");
        expect(titleForTab("cron")).toBe("Cron");
    });
    
    it("returns raw tab name as fallback for unknown tab", () => {
        expect(titleForTab("unknown_tab" as any)).toBe("unknown_tab");
    });
});
