import type { Command } from "commander";
import { registerCorebotCli } from "./corebot-cli.js";

export function registerClawbotCli(program: Command) {
  registerCorebotCli(program);
}
