import { describe, expect, it } from "vitest";
import {
  canonicalizeConfiguredMcpServer,
  isKnownCliMcpTypeAlias,
  normalizeConfiguredMcpServers,
  resolveCoreBlowMcpTransportAlias,
} from "./mcp-config-normalize.js";

describe("MCP config normalization facade", () => {
  it("maps CLI transport aliases to CoreBlow MCP transports", () => {
    expect(resolveCoreBlowMcpTransportAlias("http")).toBe("streamable-http");
    expect(resolveCoreBlowMcpTransportAlias(" streamable-http ")).toBe("streamable-http");
    expect(resolveCoreBlowMcpTransportAlias("sse")).toBe("sse");
    expect(resolveCoreBlowMcpTransportAlias("stdio")).toBeUndefined();
    expect(isKnownCliMcpTypeAlias("stdio")).toBe(true);
  });

  it("canonicalizes configured server records", () => {
    expect(canonicalizeConfiguredMcpServer({ type: "http", url: "https://mcp.example" })).toEqual({
      transport: "streamable-http",
      url: "https://mcp.example",
    });
    expect(canonicalizeConfiguredMcpServer({ type: "http", transport: "sse" })).toEqual({
      transport: "sse",
    });
  });

  it("normalizes server maps and drops invalid entries", () => {
    expect(
      normalizeConfiguredMcpServers({
        docs: { type: "sse", url: "https://docs.example/sse" },
        invalid: "nope",
      }),
    ).toEqual({
      docs: { transport: "sse", url: "https://docs.example/sse" },
    });
  });
});
