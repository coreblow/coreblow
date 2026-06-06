export type FinalizableDraftPreview<TPreviewId = string> = {
  flush: () => Promise<void> | void;
  id: () => TPreviewId | undefined;
  seal: () => Promise<void> | void;
  discardPending: () => Promise<void> | void;
  clear: () => Promise<void> | void;
};

export type DeliverFinalizableDraftPreviewResult =
  | "preview-finalized"
  | "normal-delivered"
  | "normal-skipped";

export type DeliverFinalizableDraftPreviewParams<TPayload, TFinalEdit, TPreviewId = string> = {
  kind: "partial" | "final" | string;
  payload: TPayload;
  draft: FinalizableDraftPreview<TPreviewId>;
  buildFinalEdit: (payload: TPayload) => TFinalEdit | undefined;
  editFinal: (id: TPreviewId, edit: TFinalEdit) => Promise<void> | void;
  deliverNormally: (payload: TPayload) => Promise<void> | void;
  logPreviewEditFailure?: (error: unknown) => void;
};

async function deliverNormalFallback<TPayload, TFinalEdit, TPreviewId>(
  params: DeliverFinalizableDraftPreviewParams<TPayload, TFinalEdit, TPreviewId>,
): Promise<DeliverFinalizableDraftPreviewResult> {
  await params.draft.discardPending();
  await params.deliverNormally(params.payload);
  await params.draft.clear();
  return "normal-delivered";
}

export async function deliverFinalizableDraftPreview<TPayload, TFinalEdit, TPreviewId = string>(
  params: DeliverFinalizableDraftPreviewParams<TPayload, TFinalEdit, TPreviewId>,
): Promise<DeliverFinalizableDraftPreviewResult> {
  if (params.kind !== "final") {
    return "normal-skipped";
  }

  const edit = params.buildFinalEdit(params.payload);
  const previewId = params.draft.id();
  if (edit === undefined || previewId === undefined) {
    return deliverNormalFallback(params);
  }

  await params.draft.flush();
  try {
    await params.draft.seal();
    await params.editFinal(previewId, edit);
    return "preview-finalized";
  } catch (error) {
    params.logPreviewEditFailure?.(error);
    return deliverNormalFallback(params);
  }
}
