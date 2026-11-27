import { describe, expect, it, vi } from "vitest";

const {
  printWizardHeaderMock,
  maybeOfferUpdateBeforeDoctorMock,
  maybeRepairUiProtocolFreshnessMock,
  noteSourceInstallIssuesMock,
  noteStartupOptimizationHintsMock,
  loadAndMaybeMigrateDoctorConfigMock,
  runDoctorHealthContributionsMock,
} = vi.hoisted(() => ({
  printWizardHeaderMock: vi.fn(),
  maybeOfferUpdateBeforeDoctorMock: vi.fn(async () => ({ handled: false })),
  maybeRepairUiProtocolFreshnessMock: vi.fn(async () => {}),
  noteSourceInstallIssuesMock: vi.fn(),
  noteStartupOptimizationHintsMock: vi.fn(),
  loadAndMaybeMigrateDoctorConfigMock: vi.fn(async () => ({
    cfg: {},
    path: "/tmp/coreblow.json",
    sourceConfigValid: true,
  })),
  runDoctorHealthContributionsMock: vi.fn(async () => {
    const { note } = await import("../terminal/note.js");
    note("Sample diagnostic finding", "Plugin registry");
  }),
}));

vi.mock("../commands/onboard-helpers.js", () => ({
  printWizardHeader: printWizardHeaderMock,
  guardCancel: vi.fn((val: unknown) => val),
}));

vi.mock("../commands/doctor-update.js", () => ({
  maybeOfferUpdateBeforeDoctor: maybeOfferUpdateBeforeDoctorMock,
}));

vi.mock("../commands/doctor-ui.js", () => ({
  maybeRepairUiProtocolFreshness: maybeRepairUiProtocolFreshnessMock,
}));

vi.mock("../commands/doctor-install.js", () => ({
  noteSourceInstallIssues: noteSourceInstallIssuesMock,
}));

vi.mock("../commands/doctor-platform-notes.js", () => ({
  noteStartupOptimizationHints: noteStartupOptimizationHintsMock,
}));

vi.mock("../commands/doctor-config-flow.js", () => ({
  loadAndMaybeMigrateDoctorConfig: loadAndMaybeMigrateDoctorConfigMock,
}));

vi.mock("./doctor-health-contributions.js", () => ({
  runDoctorHealthContributions: runDoctorHealthContributionsMock,
}));

import { doctorCommand } from "./doctor-health.js";

describe("doctorCommand --json", () => {
  it("implies non-interactive mode, suppresses TUI header/notes, and writes pure JSON", async () => {
    const writeJson = vi.fn();
    const log = vi.fn();
    const error = vi.fn();
    const exit = vi.fn();
    const stdoutWrite = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await doctorCommand(
      { log, error, exit, writeJson } as never,
      { json: true },
    );

    expect(printWizardHeaderMock).not.toHaveBeenCalled();
    expect(loadAndMaybeMigrateDoctorConfigMock).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ json: true, nonInteractive: true }),
      }),
    );
    expect(writeJson).toHaveBeenCalledTimes(1);
    const payload = writeJson.mock.calls[0]?.[0] as {
      ok: boolean;
      status: string;
      nonInteractive: boolean;
      diagnostics: Array<{ title?: string; message: string }>;
    };
    expect(payload.ok).toBe(true);
    expect(payload.status).toBe("ok");
    expect(payload.nonInteractive).toBe(true);
    expect(payload.diagnostics).toEqual([
      { title: "Plugin registry", message: "Sample diagnostic finding" },
    ]);

    stdoutWrite.mockRestore();
  });
});
