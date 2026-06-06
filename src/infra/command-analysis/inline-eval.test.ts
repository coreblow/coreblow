import { describe, expect, it } from "vitest";
import {
  describeInterpreterInlineEval,
  detectInterpreterInlineEvalArgv,
  isInterpreterLikeAllowlistPattern,
} from "./inline-eval.js";

describe("exec inline eval detection", () => {
  it("detects common interpreter eval flags", () => {
    expect(describeInterpreterInlineEval(detectInterpreterInlineEvalArgv(["python3", "-c", "print(1)"])!)).toBe("python3 -c");
    expect(describeInterpreterInlineEval(detectInterpreterInlineEvalArgv(["node", "--eval", "1"])!)).toBe("node --eval");
    expect(describeInterpreterInlineEval(detectInterpreterInlineEvalArgv(["awk", "BEGIN { print 1 }"])!)).toBe("awk inline program");
    expect(describeInterpreterInlineEval(detectInterpreterInlineEvalArgv(["xargs", "id"])!)).toBe("xargs inline command");
  });

  it("ignores ordinary script execution", () => {
    expect(detectInterpreterInlineEvalArgv(["python3", "script.py"])).toBeNull();
    expect(detectInterpreterInlineEvalArgv(["node", "script.js"])).toBeNull();
  });

  it("matches interpreter-like allowlist patterns", () => {
    expect(isInterpreterLikeAllowlistPattern("/usr/bin/python3")).toBe(true);
    expect(isInterpreterLikeAllowlistPattern("**/node")).toBe(true);
    expect(isInterpreterLikeAllowlistPattern("/usr/bin/rg")).toBe(false);
  });
});
