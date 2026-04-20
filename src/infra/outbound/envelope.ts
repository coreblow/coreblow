import type { ReplyPayload } from "../../auto-reply/types.js";
import type { OutboundDeliveryJson } from "./format.js";
import { normalizeOutboundPayloadsForJson, type OutboundPayloadJson } from "./payloads.js";

export type OutboundResultEnvelope = {
  payloads?: OutboundPayloadJson[];
  meta?: unknown;
  delivery?: OutboundDeliveryJson;
};

type BuildEnvelopeParams = {
  payloads?: readonly ReplyPayload[] | readonly OutboundPayloadJson[];
  meta?: unknown;
  delivery?: OutboundDeliveryJson;
  flattenDelivery?: boolean;
};

const isOutboundPayloadJson = (
  payload: ReplyPayload | OutboundPayloadJson,
): payload is OutboundPayloadJson => "mediaUrl" in payload;

export function buildOutboundResultEnvelope(
  params: BuildEnvelopeParams,
): OutboundResultEnvelope | OutboundDeliveryJson {
  const hasPayloads = params.payloads !== undefined;
  const payloads =
    params.payloads === undefined
      ? undefined
      : params.payloads.length === 0
        ? []
        : isOutboundPayloadJson(params.payloads[0])
          ? [...(params.payloads as readonly OutboundPayloadJson[])]
          : normalizeOutboundPayloadsForJson(params.payloads as readonly ReplyPayload[]);

  if (params.flattenDelivery !== false && params.delivery && !params.meta && !hasPayloads) {
    return params.delivery;
  }

  return {
    ...(hasPayloads ? { payloads } : {}),
    ...(params.meta ? { meta: params.meta } : {}),
    ...(params.delivery ? { delivery: params.delivery } : {}),
  };
}

// ---------------------------------------------------------------------------
// OutboundEnvelopeService — Tier-1 Standalone Singleton
// ---------------------------------------------------------------------------

import { createTestingHooks } from "../service-patterns.js";

export class OutboundEnvelopeService {
  buildOutboundResultEnvelope(params: Parameters<typeof buildOutboundResultEnvelope>[0]) {
    return buildOutboundResultEnvelope(params);
  }
}

let _outboundEnvelopeInstance: OutboundEnvelopeService | null = null;

export function getOutboundEnvelopeService(): OutboundEnvelopeService {
  if (!_outboundEnvelopeInstance) {
    _outboundEnvelopeInstance = new OutboundEnvelopeService();
  }
  return _outboundEnvelopeInstance;
}

export const __testing_outboundEnvelope = createTestingHooks<OutboundEnvelopeService>(
  () => { _outboundEnvelopeInstance = null; },
  (svc) => { _outboundEnvelopeInstance = svc; },
);
