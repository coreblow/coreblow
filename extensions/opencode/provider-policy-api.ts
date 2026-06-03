type ThinkingLevelId = "off" | "minimal" | "low" | "medium" | "high" | "adaptive" | "xhigh" | "max";
type DefaultThinkingLevelId = Exclude<ThinkingLevelId, "max">;

type ThinkingProfile = {
  levels: Array<{ id: ThinkingLevelId }>;
  defaultLevel: DefaultThinkingLevelId;
};

function normalizedModelId(modelId: string): string {
  return modelId.trim().toLowerCase();
}

function matchesAnyPrefix(modelId: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => modelId.startsWith(prefix));
}

export function resolveThinkingProfile(params: { provider?: string; modelId: string }): ThinkingProfile | undefined {
  void params.provider;
  const modelId = normalizedModelId(params.modelId);
  if (
    matchesAnyPrefix(modelId, ["claude-opus-4-7", "claude-opus-4.7"])
  ) {
    return {
      levels: [
        { id: "off" },
        { id: "minimal" },
        { id: "low" },
        { id: "medium" },
        { id: "high" },
        { id: "xhigh" },
        { id: "adaptive" },
        { id: "max" },
      ],
      defaultLevel: "off",
    };
  }
  if (
    matchesAnyPrefix(modelId, [
      "claude-opus-4-6",
      "claude-opus-4.6",
      "claude-sonnet-4-6",
      "claude-sonnet-4.6",
    ])
  ) {
    return {
      levels: [
        { id: "off" },
        { id: "minimal" },
        { id: "low" },
        { id: "medium" },
        { id: "high" },
        { id: "adaptive" },
      ],
      defaultLevel: "adaptive",
    };
  }
  return undefined;
}
