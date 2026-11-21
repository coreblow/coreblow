import { describe, expect, it } from "vitest";
import {
  collapsePastedText,
  cyclePermissionMode,
  expandPastedChips,
  filterSlashCommands,
  getPermissionModeBadge,
  isDangerousShellCommand,
  parseShellEscape,
  resolveTabCompletion,
  DraftStashStack,
} from "./input-prefixes.js";

describe("input-prefixes", () => {
  describe("filterSlashCommands & Tab completion", () => {
    it("returns all commands when input is empty or just /", () => {
      const all = filterSlashCommands("/");
      expect(all.length).toBeGreaterThan(5);
      expect(all.some((c) => c.cmd === "/model")).toBe(true);
      expect(all.some((c) => c.cmd === "/help")).toBe(true);
      expect(all.some((c) => c.cmd === "/chat")).toBe(true);
      expect(all.some((c) => c.cmd === "/agent")).toBe(true);
      expect(all.some((c) => c.cmd === "/tool")).toBe(true);
    });

    it("filters commands matching query substring", () => {
      const matches = filterSlashCommands("/mod");
      expect(matches.length).toBe(2);
      expect(matches.some((c) => c.cmd === "/model")).toBe(true);
      expect(matches.some((c) => c.cmd === "/mode")).toBe(true);

      const chatMatch = filterSlashCommands("/cha");
      expect(chatMatch.length).toBe(2);
      expect(chatMatch.some((c) => c.cmd === "/chat")).toBe(true);
      expect(chatMatch.some((c) => c.cmd === "/channels")).toBe(true);
    });

    it("includes discovered CoreBlow skills in matching", () => {
      const matches = filterSlashCommands("/office", ["office-docs", "calculator"]);
      expect(matches.some((c) => c.cmd === "/office-docs")).toBe(true);
    });

    it("resolves tab completion target cleanly", () => {
      const matches = filterSlashCommands("/re");
      const completed = resolveTabCompletion("/re", matches);
      expect(completed.startsWith("/re")).toBe(true);
      expect(completed.endsWith(" ")).toBe(true);
    });
  });

  describe("parseShellEscape & danger detection", () => {
    it("identifies ! prefix as shell command", () => {
      expect(parseShellEscape("!git status")).toEqual({
        isShell: true,
        command: "git status",
      });
      expect(parseShellEscape("!pnpm test")).toEqual({
        isShell: true,
        command: "pnpm test",
      });
    });

    it("rejects non-shell inputs", () => {
      expect(parseShellEscape("hello world").isShell).toBe(false);
      expect(parseShellEscape("!").isShell).toBe(false);
    });

    it("detects dangerous catastrophic shell commands", () => {
      expect(isDangerousShellCommand("rm -rf /").dangerous).toBe(true);
      expect(isDangerousShellCommand("mkfs.ext4 /dev/sda1").dangerous).toBe(true);
      expect(isDangerousShellCommand(":(){ :|:& };:").dangerous).toBe(true);
    });

    it("allows safe commands like git status and pnpm check", () => {
      expect(isDangerousShellCommand("git status").dangerous).toBe(false);
      expect(isDangerousShellCommand("pnpm check").dangerous).toBe(false);
    });
  });

  describe("collapsePastedText & expandPastedChips", () => {
    it("leaves short single-line text uncollapsed", () => {
      const res = collapsePastedText("hello world");
      expect(res.isChip).toBe(false);
      expect(res.displayText).toBe("hello world");
    });

    it("collapses multi-line text exceeding 3 lines into a chip", () => {
      const multiLine = "line 1\nline 2\nline 3\nline 4\n";
      const res = collapsePastedText(multiLine, 0);
      expect(res.isChip).toBe(true);
      expect(res.displayText).toBe("[Pasted #1 +5 lines]");
      expect(res.fullContent).toBe(multiLine);
    });

    it("collapses long text exceeding 800 characters into a chip", () => {
      const longText = "a".repeat(850);
      const res = collapsePastedText(longText, 1);
      expect(res.isChip).toBe(true);
      expect(res.displayText).toBe("[Pasted #2 +1 lines]");
    });

    it("expands paste chips back to original full content", () => {
      const chips = new Map<string, string>();
      chips.set("[Pasted #1 +4 lines]", "line1\nline2\nline3\nline4");

      const textWithChip = "Here is the code: [Pasted #1 +4 lines] please review.";
      const expanded = expandPastedChips(textWithChip, chips);
      expect(expanded).toBe("Here is the code: line1\nline2\nline3\nline4 please review.");
    });
  });

  describe("cyclePermissionMode", () => {
    it("cycles in order: manual -> acceptEdits -> plan -> auto -> manual", () => {
      expect(cyclePermissionMode("manual")).toBe("acceptEdits");
      expect(cyclePermissionMode("acceptEdits")).toBe("plan");
      expect(cyclePermissionMode("plan")).toBe("auto");
      expect(cyclePermissionMode("auto")).toBe("manual");
    });

    it("returns correct badge formatting", () => {
      expect(getPermissionModeBadge("manual").label).toBe("manual");
      expect(getPermissionModeBadge("auto").label).toBe("auto");
    });
  });

  describe("DraftStashStack", () => {
    it("pushes and pops drafts cleanly (LIFO)", () => {
      const stack = new DraftStashStack();
      expect(stack.count()).toBe(0);

      stack.push("first draft");
      stack.push("second draft");
      expect(stack.count()).toBe(2);

      expect(stack.pop()).toBe("second draft");
      expect(stack.count()).toBe(1);
      expect(stack.pop()).toBe("first draft");
      expect(stack.pop()).toBeUndefined();
    });

    it("ignores empty whitespace drafts", () => {
      const stack = new DraftStashStack();
      stack.push("   ");
      expect(stack.count()).toBe(0);
    });
  });
});
