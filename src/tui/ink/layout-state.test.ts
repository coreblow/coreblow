import { describe, expect, it } from "vitest";

type ModalType = "none" | "model" | "setup" | "help";

function shouldRenderStatusBar(modal: ModalType): boolean {
  return modal === "none";
}

function resolveCtrlCState(params: {
  hasInput: boolean;
  now: number;
  lastCtrlCAt: number;
  exitWindowMs?: number;
}): { action: "clear" | "warn" | "exit"; nextLastCtrlCAt: number } {
  const exitWindowMs = params.exitWindowMs ?? 1500;
  if (params.hasInput) {
    return { action: "clear", nextLastCtrlCAt: params.now };
  }
  if (params.lastCtrlCAt > 0 && params.now - params.lastCtrlCAt <= exitWindowMs) {
    return { action: "exit", nextLastCtrlCAt: params.lastCtrlCAt };
  }
  return { action: "warn", nextLastCtrlCAt: params.now };
}

describe("Ink TUI Layout & Collision Prevention", () => {
  describe("shouldRenderStatusBar (Anti-Collision Overlay Rule)", () => {
    it("renders StatusBar only when no modal is active", () => {
      expect(shouldRenderStatusBar("none")).toBe(true);
    });

    it("hides StatusBar when model picker modal is active", () => {
      expect(shouldRenderStatusBar("model")).toBe(false);
    });

    it("hides StatusBar when first run wizard is active", () => {
      expect(shouldRenderStatusBar("setup")).toBe(false);
    });

    it("hides StatusBar when help modal is active", () => {
      expect(shouldRenderStatusBar("help")).toBe(false);
    });
  });

  describe("resolveCtrlCState", () => {
    it("clears input on first Ctrl+C when input is not empty", () => {
      const res = resolveCtrlCState({
        hasInput: true,
        now: 1000,
        lastCtrlCAt: 0,
      });
      expect(res.action).toBe("clear");
      expect(res.nextLastCtrlCAt).toBe(1000);
    });

    it("warns on first Ctrl+C when input is empty", () => {
      const res = resolveCtrlCState({
        hasInput: false,
        now: 1000,
        lastCtrlCAt: 0,
      });
      expect(res.action).toBe("warn");
      expect(res.nextLastCtrlCAt).toBe(1000);
    });

    it("exits on second Ctrl+C within 1.5 seconds", () => {
      const res = resolveCtrlCState({
        hasInput: false,
        now: 1800,
        lastCtrlCAt: 1000,
      });
      expect(res.action).toBe("exit");
    });

    it("warns again if second Ctrl+C is after 1.5 seconds", () => {
      const res = resolveCtrlCState({
        hasInput: false,
        now: 2600,
        lastCtrlCAt: 1000,
      });
      expect(res.action).toBe("warn");
      expect(res.nextLastCtrlCAt).toBe(2600);
    });
  });
});
