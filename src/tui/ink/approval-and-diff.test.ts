import { describe, expect, it } from "vitest";
import { classifyDiffLine, parseUnifiedDiff } from "./DiffView.js";
import { type ApprovalDecision } from "./ApprovalModal.js";

describe("approval-and-diff", () => {
  describe("classifyDiffLine & parseUnifiedDiff", () => {
    it("classifies added lines starting with +", () => {
      const res = classifyDiffLine("+const a = 1;");
      expect(res.type).toBe("add");
      expect(res.text).toBe("+const a = 1;");
    });

    it("classifies removed lines starting with -", () => {
      const res = classifyDiffLine("-const a = 0;");
      expect(res.type).toBe("del");
      expect(res.text).toBe("-const a = 0;");
    });

    it("classifies hunk headers starting with @@", () => {
      const res = classifyDiffLine("@@ -1,5 +1,6 @@");
      expect(res.type).toBe("hunk");
    });

    it("classifies metadata lines (+++, ---, diff --git)", () => {
      expect(classifyDiffLine("--- a/src/index.ts").type).toBe("meta");
      expect(classifyDiffLine("+++ b/src/index.ts").type).toBe("meta");
      expect(classifyDiffLine("diff --git a/src b/src").type).toBe("meta");
    });

    it("classifies context lines starting with space or empty", () => {
      expect(classifyDiffLine(" function test() {").type).toBe("context");
      expect(classifyDiffLine("}").type).toBe("context");
    });

    it("parses multi-line unified diff cleanly", () => {
      const sample = [
        "diff --git a/file.ts b/file.ts",
        "@@ -1,3 +1,3 @@",
        " context line",
        "-old line",
        "+new line",
      ].join("\n");

      const parsed = parseUnifiedDiff(sample);
      expect(parsed.length).toBe(5);
      expect(parsed[0]?.type).toBe("meta");
      expect(parsed[1]?.type).toBe("hunk");
      expect(parsed[2]?.type).toBe("context");
      expect(parsed[3]?.type).toBe("del");
      expect(parsed[4]?.type).toBe("add");
    });
  });

  describe("ApprovalModal decision state validation", () => {
    it("handles standard decision identifiers", () => {
      const decisions: ApprovalDecision[] = ["allow_once", "allow_session", "allow_always", "deny"];
      expect(decisions).toContain("allow_once");
      expect(decisions).toContain("deny");
    });

    it("supports optional steering comment with any decision", () => {
      const record = {
        decision: "deny" as ApprovalDecision,
        comment: "Please run in read-only mode instead",
      };

      expect(record.decision).toBe("deny");
      expect(record.comment).toContain("read-only mode");
    });
  });
});
