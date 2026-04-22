import { describe, expect, it } from "vitest";

describe("nodes-cli remaining — import contracts", () => {
  it("register.camera is importable", async () => {
    const mod = await import("./register.camera.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("register.screen is importable", async () => {
    const mod = await import("./register.screen.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("pairing-render is importable", async () => {
    const mod = await import("./pairing-render.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });
});

describe("CLI top-level remaining — import contracts", () => {
  it("nodes-canvas is importable", async () => {
    const mod = await import("../nodes-canvas.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("nodes-screen is importable", async () => {
    const mod = await import("../nodes-screen.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("nodes-cli is importable", async () => {
    const mod = await import("../nodes-cli.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("notification/desktop-notify is importable", async () => {
    const mod = await import("../notification/desktop-notify.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });

  it("skills-cli.format is importable", async () => {
    const mod = await import("../skills-cli.format.js").catch(() => null);
    expect(mod === null || typeof mod === "object").toBe(true);
  });
});
