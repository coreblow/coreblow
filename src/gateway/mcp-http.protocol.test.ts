import { describe, expect, it } from "vitest";
import {
  MCP_LOOPBACK_SERVER_NAME,
  MCP_LOOPBACK_SERVER_VERSION,
  MCP_LOOPBACK_SUPPORTED_PROTOCOL_VERSIONS,
  jsonRpcError,
  jsonRpcResult,
  type JsonRpcRequest,
} from "./mcp-http.protocol.js";

describe("MCP loopback protocol", () => {
  it("publishes CoreBlow server identity and supported protocol versions", () => {
    expect(MCP_LOOPBACK_SERVER_NAME).toBe("coreblow");
    expect(MCP_LOOPBACK_SERVER_VERSION).toBe("0.1.0");
    expect(MCP_LOOPBACK_SUPPORTED_PROTOCOL_VERSIONS).toEqual(["2025-03-26", "2024-11-05"]);
  });

  it("builds JSON-RPC success responses and normalizes missing ids", () => {
    expect(jsonRpcResult("request-1", { ok: true })).toEqual({
      jsonrpc: "2.0",
      id: "request-1",
      result: { ok: true },
    });
    expect(jsonRpcResult(undefined, { ok: true }).id).toBeNull();
  });

  it("builds JSON-RPC error responses", () => {
    expect(jsonRpcError(7, -32601, "Method not found")).toEqual({
      jsonrpc: "2.0",
      id: 7,
      error: { code: -32601, message: "Method not found" },
    });
  });

  it("models MCP JSON-RPC requests without handler dependencies", () => {
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: MCP_LOOPBACK_SUPPORTED_PROTOCOL_VERSIONS[0] },
    };

    expect(request.method).toBe("initialize");
  });
});
