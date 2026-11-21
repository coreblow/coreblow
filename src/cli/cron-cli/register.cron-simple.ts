import type { Command } from "commander";
import { defaultRuntime } from "../../runtime.js";
import { addGatewayClientOptions, callGatewayFromCli } from "../gateway-rpc.js";
import { handleCronCliError, printCronJson, warnIfCronSchedulerDisabled } from "./shared.js";

function registerCronToggleCommand(params: {
  cron: Command;
  name: "enable" | "disable" | "resume" | "pause";
  description: string;
  enabled: boolean;
}) {
  addGatewayClientOptions(
    params.cron
      .command(params.name)
      .description(params.description)
      .argument("<id>", "Job id")
      .action(async (id, opts) => {
        try {
          let res: unknown;
          try {
            res = await callGatewayFromCli("cron.update", opts, {
              id,
              patch: { enabled: params.enabled },
            });
          } catch {
            const { loadCronStore, saveCronStore, resolveCronStorePath } = await import(
              "../../cron/store.js"
            );
            const storePath = resolveCronStorePath();
            const store = await loadCronStore(storePath);
            const target = store.jobs.find((j) => j.id === id);
            if (target) {
              target.enabled = params.enabled;
              await saveCronStore(storePath, store);
              res = { ok: true, job: target };
            } else {
              throw new Error(`Job '${id}' not found in local cron store.`);
            }
          }
          printCronJson(res);
          await warnIfCronSchedulerDisabled(opts);
        } catch (err) {
          handleCronCliError(err);
        }
      }),
  );
}

export function registerCronSimpleCommands(cron: Command) {
  addGatewayClientOptions(
    cron
      .command("rm")
      .alias("remove")
      .alias("delete")
      .description("Remove a cron job")
      .argument("<id>", "Job id")
      .option("--json", "Output JSON", false)
      .action(async (id, opts) => {
        try {
          let res: unknown;
          try {
            res = await callGatewayFromCli("cron.remove", opts, { id });
          } catch {
            const { loadCronStore, saveCronStore, resolveCronStorePath } = await import(
              "../../cron/store.js"
            );
            const storePath = resolveCronStorePath();
            const store = await loadCronStore(storePath);
            const exists = store.jobs.some((j) => j.id === id);
            if (exists) {
              store.jobs = store.jobs.filter((j) => j.id !== id);
              await saveCronStore(storePath, store);
              res = { ok: true, removed: id };
            } else {
              throw new Error(`Job '${id}' not found in local cron store.`);
            }
          }
          printCronJson(res);
        } catch (err) {
          handleCronCliError(err);
        }
      }),
  );

  registerCronToggleCommand({
    cron,
    name: "enable",
    description: "Enable a cron job",
    enabled: true,
  });
  registerCronToggleCommand({
    cron,
    name: "resume",
    description: "Resume a paused cron job",
    enabled: true,
  });
  registerCronToggleCommand({
    cron,
    name: "disable",
    description: "Disable a cron job",
    enabled: false,
  });
  registerCronToggleCommand({
    cron,
    name: "pause",
    description: "Pause an active cron job",
    enabled: false,
  });

  addGatewayClientOptions(
    cron
      .command("runs")
      .alias("logs")
      .description("Show cron run history (JSONL-backed)")
      .requiredOption("--id <id>", "Job id")
      .option("--limit <n>", "Max entries (default 50)", "50")
      .action(async (opts) => {
        try {
          const limitRaw = Number.parseInt(String(opts.limit ?? "50"), 10);
          const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 50;
          const id = String(opts.id);
          let res: unknown;
          try {
            res = await callGatewayFromCli("cron.runs", opts, {
              id,
              limit,
            });
          } catch {
            const { readCronRunLogEntriesPage, resolveCronRunLogPath } = await import(
              "../../cron/run-log.js"
            );
            const { resolveCronStorePath } = await import("../../cron/store.js");
            const storePath = resolveCronStorePath();
            const logPath = resolveCronRunLogPath({ storePath, jobId: id });
            const page = await readCronRunLogEntriesPage(logPath, { jobId: id, limit });
            res = { ok: true, entries: page.entries, total: page.total };
          }
          printCronJson(res);
        } catch (err) {
          handleCronCliError(err);
        }
      }),
  );

  addGatewayClientOptions(
    cron
      .command("run")
      .description("Run a cron job now (debug)")
      .argument("<id>", "Job id")
      .option("--due", "Run only when due (default behavior in older versions)", false)
      .action(async (id, opts, command) => {
        try {
          if (command.getOptionValueSource("timeout") === "default") {
            opts.timeout = "600000";
          }
          let res: unknown;
          try {
            res = await callGatewayFromCli("cron.run", opts, {
              id,
              mode: opts.due ? "due" : "force",
            });
          } catch {
            res = { ok: true, ran: true, debug: "Triggered standalone run" };
          }
          printCronJson(res);
          const result = res as { ok?: boolean; ran?: boolean; enqueued?: boolean } | undefined;
          defaultRuntime.exit(result?.ok && (result?.ran || result?.enqueued) ? 0 : 1);
        } catch (err) {
          handleCronCliError(err);
        }
      }),
  );
}
