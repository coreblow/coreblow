import { describe, expect, it } from "vitest";
import { classifySessionKind } from "./classify-session-kind.js";

describe("classifySessionKind", () => {
  it.each([
    ["global", undefined, "global"],
    ["unknown", undefined, "unknown"],
    ["agent:main:cron:daily:run:1", undefined, "cron"],
    ["agent:main:telegram:direct:1", { spawnedBy: "agent:main" }, "spawn-child"],
    ["agent:main:telegram:group:1", undefined, "group"],
    ["agent:main:telegram:direct:1", undefined, "direct"],
  ] as const)("classifies %s", (key, entry, expected) => {
    expect(classifySessionKind(key, entry)).toBe(expected);
  });
});
