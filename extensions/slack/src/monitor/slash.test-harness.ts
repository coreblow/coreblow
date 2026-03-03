import { vi , Mock } from "vitest";

const mocks = vi.hoisted(() => ({
  dispatchMock: vi.fn(),
  readAllowFromStoreMock: vi.fn(),
  upsertPairingRequestMock: vi.fn(),
  resolveAgentRouteMock: vi.fn(),
  finalizeInboundContextMock: vi.fn(),
  resolveConversationLabelMock: vi.fn(),
  recordSessionMetaFromInboundMock: vi.fn(),
  resolveStorePathMock: vi.fn(),
}));

vi.mock("coreblow/plugin-sdk/reply-runtime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("coreblow/plugin-sdk/reply-runtime")>();
  return {
    ...actual,
    dispatchReplyWithDispatcher: (...args: unknown[]) => mocks.dispatchMock(...args),
    finalizeInboundContext: (...args: unknown[]) => mocks.finalizeInboundContextMock(...args),
  };
});

vi.mock("coreblow/plugin-sdk/routing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("coreblow/plugin-sdk/routing")>();
  return {
    ...actual,
    resolveAgentRoute: (...args: unknown[]) => mocks.resolveAgentRouteMock(...args),
  };
});

vi.mock("coreblow/plugin-sdk/conversation-runtime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("coreblow/plugin-sdk/conversation-runtime")>();
  return {
    ...actual,
    resolveConversationLabel: (...args: unknown[]) => mocks.resolveConversationLabelMock(...args),
    recordInboundSessionMetaSafe: (...args: unknown[]) =>
      mocks.recordSessionMetaFromInboundMock(...args),
  };
});

vi.mock("coreblow/plugin-sdk/config-runtime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("coreblow/plugin-sdk/config-runtime")>();
  return {
    ...actual,
    resolveStorePath: (...args: unknown[]) => mocks.resolveStorePathMock(...args),
  };
});

type SlashHarnessMocks = {
  dispatchMock: Mock;
  readAllowFromStoreMock: Mock;
  upsertPairingRequestMock: Mock;
  resolveAgentRouteMock: Mock;
  finalizeInboundContextMock: Mock;
  resolveConversationLabelMock: Mock;
  recordSessionMetaFromInboundMock: Mock;
  resolveStorePathMock: Mock;
};

export function getSlackSlashMocks(): SlashHarnessMocks {
  return mocks;
}

export function resetSlackSlashMocks() {
  mocks.dispatchMock.mockReset().mockResolvedValue({ counts: { final: 1, tool: 0, block: 0 } });
  mocks.readAllowFromStoreMock.mockReset().mockResolvedValue([]);
  mocks.upsertPairingRequestMock.mockReset().mockResolvedValue({ code: "PAIRCODE", created: true });
  mocks.resolveAgentRouteMock.mockReset().mockReturnValue({
    agentId: "main",
    sessionKey: "session:1",
    accountId: "acct",
  });
  mocks.finalizeInboundContextMock.mockReset().mockImplementation((ctx: unknown) => ctx);
  mocks.resolveConversationLabelMock.mockReset().mockReturnValue(undefined);
  mocks.recordSessionMetaFromInboundMock.mockReset().mockResolvedValue(undefined);
  mocks.resolveStorePathMock.mockReset().mockReturnValue("/tmp/coreblow-sessions.json");
}
