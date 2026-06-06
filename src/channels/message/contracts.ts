import {
  channelMessageLiveCapabilities,
  channelMessageReceiveAckPolicies,
  durableFinalDeliveryCapabilities,
  livePreviewFinalizerCapabilities,
  type ChannelMessageAdapterShape,
  type ChannelMessageLiveCapability,
  type ChannelMessageReceiveAckPolicy,
  type ChannelMessageReceiveAdapterShape,
  type DurableFinalDeliveryRequirement,
  type DurableFinalDeliveryRequirementMap,
  type LivePreviewFinalizerCapability,
  type LivePreviewFinalizerCapabilityMap,
} from "./types.js";

export type CapabilityProofResult<TName extends string, TKey extends string> = Record<
  TKey,
  TName
> & {
  status: "verified" | "not_declared";
};

type ProofMap<TName extends string> = Partial<Record<TName, () => unknown | Promise<unknown>>>;

function listDeclaredInOrder<TName extends string>(
  order: readonly TName[],
  declarations: Partial<Record<TName, boolean>> | undefined,
): TName[] {
  return order.filter((name) => declarations?.[name] === true);
}

async function verifyDeclaredInOrder<TName extends string, TKey extends string>(params: {
  adapterName: string;
  label: string;
  key: TKey;
  order: readonly TName[];
  declared: readonly TName[];
  proofs?: ProofMap<TName>;
}): Promise<Array<CapabilityProofResult<TName, TKey>>> {
  const declared = new Set(params.declared);
  const results: Array<CapabilityProofResult<TName, TKey>> = [];

  for (const name of params.order) {
    if (!declared.has(name)) {
      results.push({ [params.key]: name, status: "not_declared" } as CapabilityProofResult<
        TName,
        TKey
      >);
      continue;
    }

    const proof = params.proofs?.[name];
    if (proof === undefined) {
      throw new Error(
        `${params.adapterName} declares ${params.label} "${name}" without a contract proof`,
      );
    }

    await proof();
    results.push({ [params.key]: name, status: "verified" } as CapabilityProofResult<
      TName,
      TKey
    >);
  }

  return results;
}

export function listDeclaredDurableFinalCapabilities(
  capabilities: DurableFinalDeliveryRequirementMap | undefined,
): DurableFinalDeliveryRequirement[] {
  return listDeclaredInOrder(durableFinalDeliveryCapabilities, capabilities);
}

export function listDeclaredLivePreviewFinalizerCapabilities(
  capabilities: LivePreviewFinalizerCapabilityMap | undefined,
): LivePreviewFinalizerCapability[] {
  return listDeclaredInOrder(livePreviewFinalizerCapabilities, capabilities);
}

export function listDeclaredChannelMessageLiveCapabilities(
  capabilities: Partial<Record<ChannelMessageLiveCapability, boolean>> | undefined,
): ChannelMessageLiveCapability[] {
  return listDeclaredInOrder(channelMessageLiveCapabilities, capabilities);
}

export function listDeclaredReceiveAckPolicies(
  receive: ChannelMessageReceiveAdapterShape | undefined,
): ChannelMessageReceiveAckPolicy[] {
  const declarations = receive?.supportedAckPolicies ?? (
    receive?.defaultAckPolicy !== undefined ? [receive.defaultAckPolicy] : []
  );
  const declared = new Set(declarations);
  return channelMessageReceiveAckPolicies.filter((policy) => declared.has(policy));
}

export function verifyDurableFinalCapabilityProofs(params: {
  adapterName: string;
  capabilities?: DurableFinalDeliveryRequirementMap;
  proofs?: ProofMap<DurableFinalDeliveryRequirement>;
}): Promise<Array<CapabilityProofResult<DurableFinalDeliveryRequirement, "capability">>> {
  return verifyDeclaredInOrder({
    adapterName: params.adapterName,
    label: "durable final capability",
    key: "capability",
    order: durableFinalDeliveryCapabilities,
    declared: listDeclaredDurableFinalCapabilities(params.capabilities),
    proofs: params.proofs,
  });
}

export function verifyLivePreviewFinalizerCapabilityProofs(params: {
  adapterName: string;
  capabilities?: LivePreviewFinalizerCapabilityMap;
  proofs?: ProofMap<LivePreviewFinalizerCapability>;
}): Promise<Array<CapabilityProofResult<LivePreviewFinalizerCapability, "capability">>> {
  return verifyDeclaredInOrder({
    adapterName: params.adapterName,
    label: "live preview finalizer capability",
    key: "capability",
    order: livePreviewFinalizerCapabilities,
    declared: listDeclaredLivePreviewFinalizerCapabilities(params.capabilities),
    proofs: params.proofs,
  });
}

export function verifyChannelMessageLiveCapabilityProofs(params: {
  adapterName: string;
  capabilities?: Partial<Record<ChannelMessageLiveCapability, boolean>>;
  proofs?: ProofMap<ChannelMessageLiveCapability>;
}): Promise<Array<CapabilityProofResult<ChannelMessageLiveCapability, "capability">>> {
  return verifyDeclaredInOrder({
    adapterName: params.adapterName,
    label: "live capability",
    key: "capability",
    order: channelMessageLiveCapabilities,
    declared: listDeclaredChannelMessageLiveCapabilities(params.capabilities),
    proofs: params.proofs,
  });
}

export function verifyChannelMessageReceiveAckPolicyProofs(params: {
  adapterName: string;
  receive?: ChannelMessageReceiveAdapterShape;
  proofs?: ProofMap<ChannelMessageReceiveAckPolicy>;
}): Promise<Array<CapabilityProofResult<ChannelMessageReceiveAckPolicy, "policy">>> {
  return verifyDeclaredInOrder({
    adapterName: params.adapterName,
    label: "receive ack policy",
    key: "policy",
    order: channelMessageReceiveAckPolicies,
    declared: listDeclaredReceiveAckPolicies(params.receive),
    proofs: params.proofs,
  });
}

export function verifyChannelMessageAdapterCapabilityProofs(params: {
  adapterName: string;
  adapter?: ChannelMessageAdapterShape;
  proofs?: ProofMap<DurableFinalDeliveryRequirement>;
}): Promise<Array<CapabilityProofResult<DurableFinalDeliveryRequirement, "capability">>> {
  return verifyDurableFinalCapabilityProofs({
    adapterName: params.adapterName,
    capabilities: params.adapter?.durableFinal?.capabilities,
    proofs: params.proofs,
  });
}

export function verifyChannelMessageLiveFinalizerProofs(params: {
  adapterName: string;
  adapter?: ChannelMessageAdapterShape;
  proofs?: ProofMap<LivePreviewFinalizerCapability>;
}): Promise<Array<CapabilityProofResult<LivePreviewFinalizerCapability, "capability">>> {
  return verifyLivePreviewFinalizerCapabilityProofs({
    adapterName: params.adapterName,
    capabilities: params.adapter?.live?.finalizer?.capabilities,
    proofs: params.proofs,
  });
}

export function verifyChannelMessageLiveCapabilityAdapterProofs(params: {
  adapterName: string;
  adapter?: ChannelMessageAdapterShape;
  proofs?: ProofMap<ChannelMessageLiveCapability>;
}): Promise<Array<CapabilityProofResult<ChannelMessageLiveCapability, "capability">>> {
  return verifyChannelMessageLiveCapabilityProofs({
    adapterName: params.adapterName,
    capabilities: params.adapter?.live?.capabilities,
    proofs: params.proofs,
  });
}

export function verifyChannelMessageReceiveAckPolicyAdapterProofs(params: {
  adapterName: string;
  adapter?: ChannelMessageAdapterShape;
  proofs?: ProofMap<ChannelMessageReceiveAckPolicy>;
}): Promise<Array<CapabilityProofResult<ChannelMessageReceiveAckPolicy, "policy">>> {
  return verifyChannelMessageReceiveAckPolicyProofs({
    adapterName: params.adapterName,
    receive: params.adapter?.receive,
    proofs: params.proofs,
  });
}
