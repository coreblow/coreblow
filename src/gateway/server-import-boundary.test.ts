import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../..");

function readSource(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("gateway startup import boundaries", () => {
  it("keeps heavy websocket and auxiliary method paths behind lazy boundaries", () => {
    const wsConnection = readSource("src/gateway/server/ws-connection.ts");
    const serverAuxHandlers = readSource("src/gateway/server-aux-handlers.ts");

    expect(wsConnection).not.toMatch(
      /import\s+\{[^}]*attachGatewayWsMessageHandler[^}]*\}\s+from "\.\/ws-connection\/message-handler\.js"/s,
    );
    expect(wsConnection).toContain('import("./ws-connection/message-handler.js")');
    expect(wsConnection).toContain("MAX_QUEUED_MESSAGE_HANDLER_FRAMES");

    expect(serverAuxHandlers).not.toMatch(
      /import\s+\{[^}]*create(?:Exec|Plugin|Secrets)[^}]*\}\s+from "\.\/server-methods\//s,
    );
    expect(serverAuxHandlers).toContain('import("./server-methods/exec-approval.js")');
    expect(serverAuxHandlers).toContain('import("./server-methods/plugin-approval.js")');
    expect(serverAuxHandlers).toContain('import("./server-methods/secrets.js")');
  });

  it("keeps CoreBlow startup wiring explicit for heavyweight gateway roots", () => {
    const serverImpl = readSource("src/gateway/server.impl.ts");
    const runtimeState = readSource("src/gateway/server-runtime-state.ts");

    expect(serverImpl).not.toContain('from "./server/ws-connection/message-handler.js"');
    expect(serverImpl).not.toContain('from "./server-methods/exec-approval.js"');
    expect(serverImpl).not.toContain('from "./server-methods/plugin-approval.js"');
    expect(serverImpl).not.toContain('from "./server-methods/secrets.js"');
    expect(runtimeState).not.toContain('from "./server/ws-connection/message-handler.js"');
  });
});
