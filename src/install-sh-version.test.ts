import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

function readRepoFile(file: string): string {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("install-sh-version", () => {
  it("runs install smoke on the supported Node release lines", () => {
    const workflow = parse(readRepoFile(".github/workflows/install-smoke.yml")) as {
      jobs?: {
        "npm-install-smoke"?: {
          strategy?: { matrix?: { node?: string[] } };
        };
      };
    };

    expect(workflow.jobs?.["npm-install-smoke"]?.strategy?.matrix?.node).toEqual(["22", "24"]);
  });

  it("checks the installed CLI version through npx", () => {
    const workflow = readRepoFile(".github/workflows/install-smoke.yml");

    expect(workflow).toContain("npx coreblow --version");
    expect(workflow).toContain("npx coreblow --help");
  });
});
