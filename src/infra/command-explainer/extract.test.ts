import { describe, expect, it } from "vitest";
import { explainShellCommand } from "./extract.js";

describe("command explainer", () => {
  it("summarizes top-level commands and inline eval risk", async () => {
    const explanation = await explainShellCommand("ls | python3 -c 'print(1)'");

    expect(explanation.shapes).toContain("pipeline");
    expect(explanation.topLevelCommands.map((command) => command.executable)).toEqual([
      "ls",
      "python3",
    ]);
    expect(explanation.risks.map((risk) => risk.kind)).toContain("inline-eval");
  });
});
