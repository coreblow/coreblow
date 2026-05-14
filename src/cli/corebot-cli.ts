import type { Command } from "commander";
import { formatDocsLink } from "../terminal/links.js";
import { theme } from "../terminal/theme.js";
import { registerQrCli } from "./qr-cli.js";

export function registerCorebotCli(program: Command) {
  const corebot = program
    .command("corebot")
    .description("Legacy corebot command aliases")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/corebot", "docs.coreblow.com/cli/corebot")}\n`,
    );
  registerQrCli(corebot);
}
