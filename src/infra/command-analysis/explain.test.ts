import { describe, expect, it } from "vitest";
import { explainShellCommand } from "../command-explainer/index.js";

describe("command-analysis explanation summary", () => {
  it("keeps command explainer importable for display summaries", async () => {
    const explanation = await explainShellCommand("python3 -c 'print(1)'");
    expect(explanation.topLevelCommands).toHaveLength(1);
    expect(explanation.risks.map((risk) => risk.kind)).toContain("inline-eval");
  });
});
