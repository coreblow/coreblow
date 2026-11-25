import type { RuntimeEnv } from "../runtime.js";
import type { DoctorOptions } from "./doctor-prompter.js";

export async function doctorCommand(runtime?: RuntimeEnv, options: DoctorOptions = {}) {
  if (options.net) {
    const [{ defaultRuntime }, { runDoctorNetProbe }] = await Promise.all([
      import("../runtime.js"),
      import("./doctor-net.js"),
    ]);
    await runDoctorNetProbe(runtime ?? defaultRuntime, {
      url: options.netUrl,
      samples: options.netSamples,
      json: options.json,
    });
    return;
  }

  const { doctorCommand: runFullDoctor } = await import("../flows/doctor-health.js");
  await runFullDoctor(runtime, options);
}

export {
  runDoctorNetProbe,
  probeGatewayLatency,
  calculateLatencyStats,
  formatDoctorNetOutput,
  type DoctorNetOptions,
  type DoctorNetResult,
} from "./doctor-net.js";
