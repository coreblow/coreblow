import { describe, expect, it } from "vitest";
import { readCommandSource } from "./command-source.test-helpers.js";

describe("command-secret-resolution coverage", () => {
  const secretTargetCallsites = [
    "extensions/memory-core/src/cli.runtime.ts",
    "src/cli/qr-cli.ts",
    "src/commands/agent.ts",
    "src/commands/channels/resolve.ts",
    "src/commands/channels/shared.ts",
    "src/commands/message.ts",
    "src/commands/models/load-config.ts",
    "src/commands/status-all.ts",
    "src/commands/status.scan.ts",
  ] as const;

  function hasSupportedTargetIdsWiring(source: string): boolean {
    return (
      /targetIds:\s*get[A-Za-z0-9_]+\(\)/m.test(source) ||
      /targetIds:\s*scopedTargets\.targetIds/m.test(source)
    );
  }

  it.each(secretTargetCallsites)(
    "routes target-id command path through shared gateway resolver: %s",
    async (relativePath) => {
      const source = await readCommandSource(relativePath);
      expect(source).toContain("resolveCommandSecretRefsViaGateway");
      expect(hasSupportedTargetIdsWiring(source)).toBe(true);
      expect(source).toContain("resolveCommandSecretRefsViaGateway({");
    },
  );
});
