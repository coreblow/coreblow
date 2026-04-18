/** CoreBlow — E2E WS Harness */ export function createWsTestHarness(): { url: string; close: () => void } { return { url: "ws://localhost:3000", close: () => {} }; }
