import { Command } from "commander";
import { describe, expect, it, vi } from "vitest";

const registerQrCli = vi.hoisted(() =>
  vi.fn((program: { command: (name: string) => unknown }) => {
    program.command("qr");
  }),
);

vi.mock("./qr-cli.js", () => ({ registerQrCli }));

const { registerClawbotCli } = await import("./clawbot-cli.js");

describe("registerClawbotCli", () => {
  it("registers the legacy clawbot facade with CoreBlow QR behavior", () => {
    const program = new Command();

    registerClawbotCli(program);

    const clawbot = program.commands.find((command) => command.name() === "clawbot");
    expect(clawbot?.description()).toBe("Legacy clawbot command aliases");
    expect(registerQrCli).toHaveBeenCalledWith(clawbot);
    expect(clawbot?.commands.map((command) => command.name())).toContain("qr");
  });
});
