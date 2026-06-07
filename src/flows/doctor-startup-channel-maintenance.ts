import type { CoreBlowConfig } from "../config/config.js";

type DoctorStartupMaintenanceRuntime = {
  error: (message: string) => void;
  log: (message: string) => void;
};

type ChannelPluginStartupMaintenanceRunner = (params: {
  cfg: CoreBlowConfig;
  env: NodeJS.ProcessEnv;
  log: { info: (message: string) => void; warn: (message: string) => void };
  trigger: "doctor-fix";
  logPrefix: "doctor";
}) => Promise<void> | void;

export async function maybeRunDoctorStartupChannelMaintenance(params: {
  cfg: CoreBlowConfig;
  env?: NodeJS.ProcessEnv;
  runChannelPluginStartupMaintenance?: ChannelPluginStartupMaintenanceRunner;
  runtime: DoctorStartupMaintenanceRuntime;
  shouldRepair: boolean;
}): Promise<void> {
  if (!params.shouldRepair) {
    return;
  }
  const runStartupMaintenance = params.runChannelPluginStartupMaintenance;
  if (!runStartupMaintenance) {
    return;
  }
  await runStartupMaintenance({
    cfg: params.cfg,
    env: params.env ?? process.env,
    log: {
      info: (message: string) => params.runtime.log(message),
      warn: (message: string) => params.runtime.error(message),
    },
    trigger: "doctor-fix",
    logPrefix: "doctor",
  });
}
