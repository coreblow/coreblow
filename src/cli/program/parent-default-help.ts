import type { Command } from "commander";

const parentDefaultHelpCommands = new WeakSet<Command>();

function outputParentHelpWithoutStartupBanner(parent: Command): void {
  const previous = process.env.COREBLOW_SUPPRESS_HELP_BANNER;
  process.env.COREBLOW_SUPPRESS_HELP_BANNER = "1";
  try {
    parent.outputHelp();
  } finally {
    if (previous === undefined) {
      delete process.env.COREBLOW_SUPPRESS_HELP_BANNER;
    } else {
      process.env.COREBLOW_SUPPRESS_HELP_BANNER = previous;
    }
  }
}

/**
 * Wire a parent command so that invoking it without a subcommand prints the
 * parent's own help and exits with status `0`.
 */
export function applyParentDefaultHelpAction(parent: Command): void {
  parentDefaultHelpCommands.add(parent);
  parent.action(() => {
    outputParentHelpWithoutStartupBanner(parent);
    process.exitCode = 0;
  });
}

export function isParentDefaultHelpAction(parent: Command): boolean {
  return parentDefaultHelpCommands.has(parent);
}
