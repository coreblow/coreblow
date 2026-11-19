import React from "react";
import { render } from "ink";
import { CoreBlowApp } from "./CoreBlowApp.js";
import { resolveTuiBackend, type TuiBackend } from "../tui-backend.js";
import type { TuiOptions } from "../tui-types.js";
import { isProviderConfigured } from "../../cli/setup-state.js";

export async function runInkTui(opts: TuiOptions): Promise<void> {
  const backend: TuiBackend = opts.backend ?? (await resolveTuiBackend(opts));
  backend.start();

  const needsSetup = !isProviderConfigured();

  const app = render(
    <CoreBlowApp backend={backend} opts={opts} needsSetup={needsSetup} />,
    {
      exitOnCtrlC: false,
    },
  );

  try {
    await app.waitUntilExit();
  } finally {
    backend.stop();
  }
}
