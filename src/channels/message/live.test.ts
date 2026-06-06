import { describe, expect, it, vi } from "vitest";
import {
  createLiveMessageState,
  deliverFinalizableLivePreview,
  markLiveMessagePreviewUpdated,
} from "./live.js";

function createDraft(id: string | undefined = "preview-1") {
  return {
    flush: vi.fn(async () => {}),
    id: vi.fn(() => id),
    seal: vi.fn(async () => {}),
    discardPending: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
  };
}

describe("live message preview helpers", () => {
  it("creates and updates live message state", () => {
    const state = createLiveMessageState();
    expect(state).toEqual({ phase: "idle", canFinalizeInPlace: false });
    const rendered = { payloads: [{ text: "hello" }], plan: { payloadCount: 1 } } as never;
    expect(markLiveMessagePreviewUpdated(state, rendered)).toEqual({
      phase: "previewing",
      canFinalizeInPlace: false,
      lastRendered: rendered,
    });
  });

  it("finalizes a draft preview in place", async () => {
    const draft = createDraft("preview-1");
    const editFinal = vi.fn(async () => {});
    const deliverNormally = vi.fn(async () => {});

    const result = await deliverFinalizableLivePreview<{ text: string }, string, string>({
      kind: "final",
      payload: { text: "final" },
      liveState: createLiveMessageState({ canFinalizeInPlace: true }),
      draft,
      buildFinalEdit: (payload) => payload.text,
      editFinal,
      deliverNormally,
    });

    expect(result.kind).toBe("preview-finalized");
    expect(result.liveState?.phase).toBe("finalized");
    expect(draft.flush).toHaveBeenCalledTimes(1);
    expect(draft.seal).toHaveBeenCalledTimes(1);
    expect(editFinal).toHaveBeenCalledWith("preview-1", "final");
    expect(deliverNormally).not.toHaveBeenCalled();
  });

  it("retains preview when edit failure handler requests retain", async () => {
    const draft = createDraft("preview-1");

    const result = await deliverFinalizableLivePreview<{ text: string }, string, string>({
      kind: "final",
      payload: { text: "final" },
      liveState: createLiveMessageState({ canFinalizeInPlace: true }),
      draft,
      buildFinalEdit: (payload) => payload.text,
      editFinal: async () => {
        throw new Error("gone");
      },
      deliverNormally: vi.fn(async () => {}),
      handlePreviewEditError: () => "retain",
    });

    expect(result.kind).toBe("preview-retained");
    expect(result.liveState?.phase).toBe("previewing");
    expect(result.liveState?.canFinalizeInPlace).toBe(true);
  });
});
