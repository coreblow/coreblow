import { describe, expect, it, vi } from "vitest";
import {
  listDeclaredChannelMessageLiveCapabilities,
  listDeclaredDurableFinalCapabilities,
  listDeclaredLivePreviewFinalizerCapabilities,
  listDeclaredReceiveAckPolicies,
  verifyChannelMessageAdapterCapabilityProofs,
  verifyChannelMessageLiveCapabilityAdapterProofs,
  verifyChannelMessageLiveFinalizerProofs,
  verifyChannelMessageLiveCapabilityProofs,
  verifyChannelMessageReceiveAckPolicyAdapterProofs,
  verifyChannelMessageReceiveAckPolicyProofs,
  verifyDurableFinalCapabilityProofs,
  verifyLivePreviewFinalizerCapabilityProofs,
} from "./contracts.js";

function verifiedEntries<T extends { status: string }>(results: readonly T[]): T[] {
  return results.filter((result) => result.status === "verified");
}

function expectOnlyVerifiedOrNotDeclared(results: readonly { status: string }[]): void {
  expect(
    results.every((result) => result.status === "verified" || result.status === "not_declared"),
  ).toBe(true);
}

describe("channel message capability contracts", () => {
  it("lists declared durable-final capabilities in stable order", () => {
    expect(
      listDeclaredDurableFinalCapabilities({
        batch: true,
        afterCommit: true,
        reconcileUnknownSend: true,
        text: true,
        silent: false,
        thread: true,
      }),
    ).toEqual(["text", "thread", "batch", "reconcileUnknownSend", "afterCommit"]);
  });

  it("runs proofs for durable final capabilities and adapter declarations", async () => {
    const text = vi.fn();
    const media = vi.fn();

    const results = await verifyChannelMessageAdapterCapabilityProofs({
      adapterName: "demo",
      adapter: {
        durableFinal: {
          capabilities: {
            text: true,
            media: true,
          },
        },
      },
      proofs: {
        text,
        media,
      },
    });

    expect(verifiedEntries(results)).toEqual([
      { capability: "text", status: "verified" },
      { capability: "media", status: "verified" },
    ]);
    expect(results).toHaveLength(12);
    expectOnlyVerifiedOrNotDeclared(results);
    expect(text).toHaveBeenCalledTimes(1);
    expect(media).toHaveBeenCalledTimes(1);
  });

  it("fails when declared durable-final capability has no proof", async () => {
    await expect(
      verifyDurableFinalCapabilityProofs({
        adapterName: "demo",
        capabilities: {
          text: true,
          nativeQuote: true,
        },
        proofs: {
          text: () => {},
        },
      }),
    ).rejects.toThrow(
      'demo declares durable final capability "nativeQuote" without a contract proof',
    );
  });

  it("runs live finalizer and live capability proofs", async () => {
    const finalEdit = vi.fn();
    const normalFallback = vi.fn();
    const draftPreview = vi.fn();
    const previewFinalization = vi.fn();

    expect(
      listDeclaredLivePreviewFinalizerCapabilities({
        previewReceipt: false,
        normalFallback: true,
        finalEdit: true,
      }),
    ).toEqual(["finalEdit", "normalFallback"]);

    expect(
      listDeclaredChannelMessageLiveCapabilities({
        nativeStreaming: false,
        previewFinalization: true,
        draftPreview: true,
      }),
    ).toEqual(["draftPreview", "previewFinalization"]);

    const finalizerResults = await verifyChannelMessageLiveFinalizerProofs({
      adapterName: "demo",
      adapter: {
        live: {
          finalizer: {
            capabilities: {
              finalEdit: true,
              normalFallback: true,
            },
          },
        },
      },
      proofs: {
        finalEdit,
        normalFallback,
      },
    });
    const liveResults = await verifyChannelMessageLiveCapabilityAdapterProofs({
      adapterName: "demo",
      adapter: {
        live: {
          capabilities: {
            draftPreview: true,
            previewFinalization: true,
          },
        },
      },
      proofs: {
        draftPreview,
        previewFinalization,
      },
    });

    expect(verifiedEntries(finalizerResults)).toEqual([
      { capability: "finalEdit", status: "verified" },
      { capability: "normalFallback", status: "verified" },
    ]);
    expect(finalizerResults).toHaveLength(5);
    expect(verifiedEntries(liveResults)).toEqual([
      { capability: "draftPreview", status: "verified" },
      { capability: "previewFinalization", status: "verified" },
    ]);
    expect(liveResults).toHaveLength(5);
  });

  it("fails when declared live capability proofs are missing", async () => {
    await expect(
      verifyLivePreviewFinalizerCapabilityProofs({
        adapterName: "demo",
        capabilities: {
          finalEdit: true,
          previewReceipt: true,
        },
        proofs: {
          finalEdit: () => {},
        },
      }),
    ).rejects.toThrow(
      'demo declares live preview finalizer capability "previewReceipt" without a contract proof',
    );

    await expect(
      verifyChannelMessageLiveCapabilityProofs({
        adapterName: "demo",
        capabilities: {
          draftPreview: true,
          progressUpdates: true,
        },
        proofs: {
          draftPreview: () => {},
        },
      }),
    ).rejects.toThrow('demo declares live capability "progressUpdates" without a contract proof');
  });

  it("runs receive ack policy proofs from channel message adapter declarations", async () => {
    const afterReceiveRecord = vi.fn();
    const afterAgentDispatch = vi.fn();

    expect(
      listDeclaredReceiveAckPolicies({
        defaultAckPolicy: "after_agent_dispatch",
        supportedAckPolicies: ["after_agent_dispatch", "after_receive_record"],
      }),
    ).toEqual(["after_receive_record", "after_agent_dispatch"]);

    const results = await verifyChannelMessageReceiveAckPolicyAdapterProofs({
      adapterName: "demo",
      adapter: {
        receive: {
          defaultAckPolicy: "after_agent_dispatch",
          supportedAckPolicies: ["after_receive_record", "after_agent_dispatch"],
        },
      },
      proofs: {
        after_receive_record: afterReceiveRecord,
        after_agent_dispatch: afterAgentDispatch,
      },
    });
    expect(verifiedEntries(results)).toEqual([
      { policy: "after_receive_record", status: "verified" },
      { policy: "after_agent_dispatch", status: "verified" },
    ]);
    expect(results).toHaveLength(4);
    expectOnlyVerifiedOrNotDeclared(results);
  });

  it("handles default and manual receive acknowledgement policies", async () => {
    const manual = vi.fn();
    expect(
      listDeclaredReceiveAckPolicies({
        defaultAckPolicy: "after_durable_send",
      }),
    ).toEqual(["after_durable_send"]);
    expect(
      listDeclaredReceiveAckPolicies({
        defaultAckPolicy: "manual",
        supportedAckPolicies: ["manual"],
      }),
    ).toEqual(["manual"]);

    const results = await verifyChannelMessageReceiveAckPolicyProofs({
      adapterName: "demo",
      receive: {
        defaultAckPolicy: "manual",
        supportedAckPolicies: ["manual"],
      },
      proofs: { manual },
    });
    expect(verifiedEntries(results)).toEqual([{ policy: "manual", status: "verified" }]);
  });

  it("fails when a declared receive ack policy has no proof", async () => {
    await expect(
      verifyChannelMessageReceiveAckPolicyProofs({
        adapterName: "demo",
        receive: {
          supportedAckPolicies: ["after_receive_record", "manual"],
        },
        proofs: {
          after_receive_record: () => {},
        },
      }),
    ).rejects.toThrow('demo declares receive ack policy "manual" without a contract proof');
  });
});
