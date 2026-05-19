const allowedSteps = new Set(["install", "check", "test", "build"]);

export function createRunPlan(options = {}) {
  const steps = Array.isArray(options.steps) && options.steps.length > 0
    ? options.steps
    : ["install", "check", "test"];
  const invalid = steps.filter((step) => !allowedSteps.has(step));
  if (invalid.length > 0) {
    throw new Error(`unsupported steps: ${invalid.join(", ")}`);
  }
  return {
    workspace: options.workspace || ".",
    packageManager: options.packageManager || "pnpm",
    steps,
    commands: steps.map((step) => commandForStep(options.packageManager || "pnpm", step)),
  };
}

function commandForStep(packageManager, step) {
  if (step === "install") {
    return `${packageManager} install --frozen-lockfile`;
  }
  return `${packageManager} ${step}`;
}
