import { describe, expect, it } from "vitest";
import { resolveFirstGithubToken } from "./auth.js";

describe("resolveFirstGithubToken", () => {
  it("prefers env tokens when available", async () => {
    const result = await resolveFirstGithubToken({
      env: { GH_TOKEN: " env-token " } as NodeJS.ProcessEnv,
    });

    expect(result.githubToken).toBe("env-token");
  });
});
