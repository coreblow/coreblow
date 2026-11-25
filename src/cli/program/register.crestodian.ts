import type { Command } from "commander";
import { defaultRuntime } from "../../runtime.js";
import { theme } from "../../terminal/theme.js";
import { runCommandWithRuntime } from "../cli-utils.js";
import { formatHelpExamples } from "../help-format.js";

export function registerCrestodianCommand(program: Command) {
  program
    .command("crestodian")
    .description("Open the ring-zero setup and repair helper")
    .option("-m, --message <text>", "Run one Crestodian request")
    .option("--yes", "Approve persistent config writes for this request", false)
    .option("--json", "Output startup overview as JSON", false)
    .addHelpText(
      "after",
      () =>
        `\n${theme.heading("Examples:")}\n${formatHelpExamples([
          ["coreblow", "Start Crestodian."],
          ["coreblow crestodian", "Start Crestodian explicitly."],
          ['coreblow crestodian -m "status"', "Run one status request."],
          [
            'coreblow crestodian -m "set default model openai/gpt-5.2" --yes',
            "Apply a typed config write.",
          ],
        ])}`,
    )
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        const { runCrestodian } = await import("../../crestodian/crestodian.js");
        await runCrestodian({
          message: opts.message as string | undefined,
          yes: Boolean(opts.yes),
          json: Boolean(opts.json),
        });
      });
    });
}
