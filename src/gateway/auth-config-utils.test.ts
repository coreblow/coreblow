import { describe, expect, it } from "vitest";
import { withGatewayAuthPassword } from "./auth-config-utils.js";

describe("withGatewayAuthPassword()", () => {
  it("is a function", () => {
    expect(typeof withGatewayAuthPassword).toBe("function");
  });

  it("returns a new config object (immutable)", () => {
    const original = {} as never;
    const result = withGatewayAuthPassword(original, "secret");
    expect(result).not.toBe(original);
  });

  it("sets gateway.auth.password", () => {
    const result = withGatewayAuthPassword({} as never, "my-password");
    expect((result as Record<string, unknown> & { gateway: { auth: { password: string } } }).gateway.auth.password).toBe("my-password");
  });

  it("preserves existing config fields", () => {
    const cfg = { name: "test-cfg" } as never;
    const result = withGatewayAuthPassword(cfg, "pw");
    expect((result as Record<string, unknown>).name).toBe("test-cfg");
  });

  it("preserves existing gateway fields", () => {
    const cfg = { gateway: { port: 3000 } } as never;
    const result = withGatewayAuthPassword(cfg, "pw");
    expect((result as Record<string, unknown> & { gateway: { port: number } }).gateway.port).toBe(3000);
  });

  it("does not throw for empty config", () => {
    expect(() => withGatewayAuthPassword({} as never, "pw")).not.toThrow();
  });
});
