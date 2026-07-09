// Compatibility types bridging OpenClaw channel turn admission surface.
// CoreBlow uses channels/inbound-event/context.ts for runtime AccessFacts.
// This module defines the ingress projection shape expected by channel-ingress.ts.

export type ChannelTurnAdmission =
  | { kind: "dispatch"; reason?: string }
  | { kind: "observeOnly"; reason: string }
  | { kind: "handled"; reason: string }
  | { kind: "drop"; reason: string; recordHistory?: boolean };

export type ProjectedAllowlistAccessFacts = {
  configured: boolean;
  matched: boolean;
  reasonCode?: string;
};

export type ProjectedEventAccessFacts = {
  kind: string;
  authorized?: boolean;
  reasonCode?: string;
};

export type AccessFacts = {
  dm?: {
    decision: "allow" | "pairing" | "deny";
    reason?: string;
    allowFrom: string[];
    allowlist?: ProjectedAllowlistAccessFacts;
  };
  group?: {
    policy: "open" | "allowlist" | "disabled";
    routeAllowed: boolean;
    senderAllowed: boolean;
    allowFrom: string[];
    requireMention: boolean;
    allowlist?: ProjectedAllowlistAccessFacts;
  };
  commands?: {
    authorized?: boolean;
    shouldBlockControlCommand?: boolean;
    reasonCode?: string;
    useAccessGroups: boolean;
    allowTextCommands: boolean;
    modeWhenAccessGroupsOff?: "allow" | "deny" | "configured";
    authorizers: Array<{ configured: boolean; allowed: boolean }>;
  };
  event?: ProjectedEventAccessFacts;
  mentions?: {
    canDetectMention: boolean;
    wasMentioned: boolean;
    hasAnyMention?: boolean;
    implicitMentionKinds?: Array<string>;
    requireMention?: boolean;
    effectiveWasMentioned?: boolean;
    shouldSkip?: boolean;
  };
};
