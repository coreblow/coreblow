const allowedRisk = new Set(["low", "medium", "high"]);

export function createPatchPlan(input = {}) {
  const title = normalizeText(input.title, "Untitled patch");
  const risk = allowedRisk.has(input.risk) ? input.risk : "medium";
  const files = Array.isArray(input.files)
    ? input.files.filter((file) => typeof file === "string" && file.trim().length > 0)
    : [];
  return {
    title,
    risk,
    files,
    gates: gatesForRisk(risk),
  };
}

function normalizeText(value, fallback) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function gatesForRisk(risk) {
  if (risk === "low") {
    return ["targeted-test"];
  }
  if (risk === "high") {
    return ["targeted-test", "pnpm check", "pnpm build", "affected-ci"];
  }
  return ["targeted-test", "pnpm check"];
}
