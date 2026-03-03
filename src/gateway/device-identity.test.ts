import { describe, expect, it } from "vitest";
import {
  createDeviceIdentity,
  generateConnectNonce,
  verifyDeviceSignature,
} from "./device-identity.js";

describe("createDeviceIdentity()", () => {
  it("is a function", () => {
    expect(typeof createDeviceIdentity).toBe("function");
  });

  it("returns a DeviceIdentity object", () => {
    const identity = createDeviceIdentity("dev-001", "fake-pub-key");
    expect(typeof identity).toBe("object");
    expect(identity).not.toBeNull();
  });

  it("sets deviceId correctly", () => {
    const identity = createDeviceIdentity("dev-001", "key");
    expect(identity.deviceId).toBe("dev-001");
  });

  it("sets publicKey correctly", () => {
    const identity = createDeviceIdentity("dev-001", "my-pub-key");
    expect(identity.publicKey).toBe("my-pub-key");
  });

  it("sets registeredAt as a number", () => {
    const identity = createDeviceIdentity("dev-001", "key");
    expect(typeof identity.registeredAt).toBe("number");
    expect(identity.registeredAt).toBeGreaterThan(0);
  });

  it("accepts optional label", () => {
    const identity = createDeviceIdentity("dev-001", "key", "My Device");
    expect(identity.label).toBe("My Device");
  });
});

describe("generateConnectNonce()", () => {
  it("is a function", () => {
    expect(typeof generateConnectNonce).toBe("function");
  });

  it("returns a non-empty string", () => {
    const nonce = generateConnectNonce();
    expect(typeof nonce).toBe("string");
    expect(nonce.length).toBeGreaterThan(0);
  });

  it("generates unique nonces on successive calls", () => {
    const a = generateConnectNonce();
    const b = generateConnectNonce();
    expect(a).not.toBe(b);
  });
});

describe("verifyDeviceSignature()", () => {
  it("is a function", () => {
    expect(typeof verifyDeviceSignature).toBe("function");
  });

  it("returns verified=false for invalid params (no throw)", () => {
    const result = verifyDeviceSignature({
      device: { id: "dev-001", publicKey: "invalid-key" },
      connectParams: {} as never,
      signature: "invalid-sig",
    } as never);
    expect(result.verified).toBe(false);
  });
});
