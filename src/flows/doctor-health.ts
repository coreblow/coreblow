import { intro as clackIntro, outro as clackOutro } from "@clack/prompts";
import { loadAndMaybeMigrateDoctorConfig } from "../commands/doctor-config-flow.js";
import { noteSourceInstallIssues } from "../commands/doctor-install.js";
import { noteStartupOptimizationHints } from "../commands/doctor-platform-notes.js";
import { createDoctorPrompter, type DoctorOptions } from "../commands/doctor-prompter.js";
import { maybeRepairUiProtocolFreshness } from "../commands/doctor-ui.js";
import { maybeOfferUpdateBeforeDoctor } from "../commands/doctor-update.js";
import { printWizardHeader } from "../commands/onboard-helpers.js";
import { CONFIG_PATH } from "../config/config.js";
import { resolveCoreBlowPackageRoot } from "../infra/coreblow-root.js";
import { t } from "../infra/i18n/index.js";
import type { RuntimeEnv } from "../runtime.js";
import { defaultRuntime } from "../runtime.js";
import { withCapturedNotes } from "../terminal/note.js";
import { stylePromptTitle } from "../terminal/prompt-style.js";
import { runDoctorHealthContributions } from "./doctor-health-contributions.js";

const intro = (message: string) => clackIntro(stylePromptTitle(message) ?? message);
const outro = (message: string) => clackOutro(stylePromptTitle(message) ?? message);

export async function doctorCommand(
  runtime: RuntimeEnv = defaultRuntime,
  options: DoctorOptions = {},
) {
  if (options.net) {
    const { runDoctorNetProbe } = await import("../commands/doctor-net.js");
    await runDoctorNetProbe(runtime, {
      url: options.netUrl,
      samples: options.netSamples,
      json: options.json,
    });
    return;
  }

  const effectiveOptions: DoctorOptions = options.json
    ? { ...options, nonInteractive: true }
    : options;

  const runDiagnostics = async () => {
    const prompter = createDoctorPrompter({ runtime, options: effectiveOptions });
    if (!effectiveOptions.json) {
      printWizardHeader(runtime);
      intro(t("doctor.title"));
    }

    const root = await resolveCoreBlowPackageRoot({
      moduleUrl: import.meta.url,
      argv1: process.argv[1],
      cwd: process.cwd(),
    });

    const updateResult = await maybeOfferUpdateBeforeDoctor({
      runtime,
      options: effectiveOptions,
      root,
      confirm: (p) => prompter.confirm(p),
      outro: effectiveOptions.json ? () => {} : outro,
    });
    if (updateResult.handled) {
      return { handled: true as const, configPath: CONFIG_PATH, sourceConfigValid: true };
    }

    await maybeRepairUiProtocolFreshness(runtime, prompter);
    noteSourceInstallIssues(root);
    noteStartupOptimizationHints();

    const configResult = await loadAndMaybeMigrateDoctorConfig({
      options: effectiveOptions,
      confirm: (p) => prompter.confirm(p),
    });
    const ctx = {
      runtime,
      options: effectiveOptions,
      prompter,
      configResult,
      cfg: configResult.cfg,
      cfgForPersistence: structuredClone(configResult.cfg),
      sourceConfigValid: configResult.sourceConfigValid ?? true,
      configPath: configResult.path ?? CONFIG_PATH,
    };
    await runDoctorHealthContributions(ctx);

    if (!effectiveOptions.json) {
      outro(t("doctor.complete"));
    }
    return {
      handled: false as const,
      configPath: ctx.configPath,
      sourceConfigValid: ctx.sourceConfigValid,
    };
  };

  if (effectiveOptions.json) {
    const { result, notes } = await withCapturedNotes(runDiagnostics);
    const payload = {
      ok: true,
      status: result.handled ? "handled" : "ok",
      nonInteractive: true,
      configPath: result.configPath,
      sourceConfigValid: result.sourceConfigValid,
      diagnostics: notes,
    };
    if ("writeJson" in runtime && typeof runtime.writeJson === "function") {
      (runtime as typeof defaultRuntime).writeJson(payload);
    } else {
      defaultRuntime.writeJson(payload);
    }
    return;
  }

  await runDiagnostics();
}
