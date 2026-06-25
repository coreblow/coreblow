import { expect } from "vitest";

export {
  expectChannelInboundContextContract,
  primeChannelOutboundSendMock,
} from "../channels/plugins/contracts/suites.js";
export { buildDispatchInboundCaptureMock } from "../channels/plugins/contracts/inbound-testkit.js";
export {
  installChannelOutboundPayloadContractSuite,
  type OutboundPayloadHarnessParams,
} from "../channels/plugins/contracts/outbound-payload-testkit.js";

export function expectChannelTurnDispatchResultContract(
  result: { queuedFinal: boolean; counts: Record<string, number> },
  expected: {
    visible: boolean;
    final: boolean;
    counts?: Partial<Record<string, number>>;
  },
): void {
  const visible = Object.values(result.counts).some((count) => count > 0);
  expect(visible).toBe(expected.visible);
  expect(result.queuedFinal || (result.counts.final ?? 0) > 0).toBe(expected.final);
  if (expected.counts) {
    expect(result.counts).toMatchObject(expected.counts);
  }
}
