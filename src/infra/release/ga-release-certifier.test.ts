import { beforeEach, describe, expect, it } from "vitest";
import { GaReleaseCertifier } from "./ga-release-certifier.js";

describe("GaReleaseCertifier", () => {
  let certifier: GaReleaseCertifier;

  beforeEach(async () => {
    certifier = new GaReleaseCertifier();
    await certifier.start();
  });

  it("satisfies GatewayService lifecycle and health", async () => {
    expect(certifier.health().status).toBe("healthy");
    await certifier.stop();
    expect(certifier.health().status).toBe("down");
  });

  it("certifies VPS Server Mode under hardened security posture", () => {
    const report = certifier.certifyVpsServerMode({
      runAsNonRoot: true,
      trustedProxiesConfigured: true,
      walStorageHealthy: true,
      tlsCertValid: true,
    });

    expect(report.certified).toBe(true);
    expect(report.checksPassed).toBe(4);
    expect(report.checksFailed).toBe(0);
    expect(report.findings).toHaveLength(4);
  });

  it("fails VPS certification when running as root or missing trusted proxy bounds", () => {
    const report = certifier.certifyVpsServerMode({
      runAsNonRoot: false,
      trustedProxiesConfigured: false,
    });

    expect(report.certified).toBe(false);
    expect(report.checksFailed).toBe(2);
    expect(report.findings.some((f) => f.includes("root user"))).toBe(true);
  });

  it("certifies Terminal CLI Mode for unified coreblow binary and doctor health", () => {
    const report = certifier.certifyTerminalCliMode({
      cliBinaryReady: true,
      doctorHealthy: true,
      acpProtocolCompliant: true,
    });

    expect(report.certified).toBe(true);
    expect(report.checksPassed).toBe(3);
    expect(report.checksFailed).toBe(0);
  });

  it("certifies Desktop GUI Mode for telemetry cockpit, MLX TTS RTF, and kill-switch", () => {
    const report = certifier.certifyDesktopGuiMode({
      cockpitBridgeReady: true,
      mlxTtsCertified: true,
      killSwitchResponsive: true,
    });

    expect(report.certified).toBe(true);
    expect(report.checksPassed).toBe(3);
    expect(report.checksFailed).toBe(0);
  });

  it("certifies Full CoreBlow v1.0.0 GA Release readiness across all 3 modes", () => {
    const certificate = certifier.certifyFullGaRelease();

    expect(certificate.version).toBe("1.0.0");
    expect(certificate.certifiedGa).toBe(true);
    expect(certificate.reports.vps_server.certified).toBe(true);
    expect(certificate.reports.terminal_cli.certified).toBe(true);
    expect(certificate.reports.desktop_gui.certified).toBe(true);
    expect(certificate.summary).toContain("100% GA Certified");
  });
});
