export type FlowDocsLink = {
  path: string;
  label?: string;
};

export type FlowContributionKind = "channel" | "core" | "provider" | "search";

export type FlowContributionSurface = "auth-choice" | "health" | "model-picker" | "setup";

export type FlowOptionGroup = {
  id: string;
  label: string;
  hint?: string;
};

export type FlowOption<Value extends string = string> = {
  value: Value;
  label: string;
  hint?: string;
  group?: FlowOptionGroup;
  docs?: FlowDocsLink;
};

export type FlowContribution<Value extends string = string> = {
  id: string;
  kind: FlowContributionKind;
  surface: FlowContributionSurface;
  option: FlowOption<Value>;
  source?: string;
};

export function mergeFlowContributions<T extends FlowContribution>(params: {
  primary: readonly T[];
  fallbacks?: readonly T[];
}): T[] {
  const contributionByValue = new Map<string, T>();
  for (const contribution of params.primary) {
    contributionByValue.set(contribution.option.value, contribution);
  }
  for (const contribution of params.fallbacks ?? []) {
    if (!contributionByValue.has(contribution.option.value)) {
      contributionByValue.set(contribution.option.value, contribution);
    }
  }
  return [...contributionByValue.values()];
}

export function sortFlowContributionsByLabel<T extends FlowContribution>(
  contributions: readonly T[],
): T[] {
  return [...contributions].toSorted(
    (left, right) =>
      left.option.label.localeCompare(right.option.label) ||
      left.option.value.localeCompare(right.option.value),
  );
}

// ─── Interactive Dialog Flow Types (used by flow-engine.ts) ──────

export type FlowState = 'active' | 'waiting_input' | 'completed' | 'cancelled';

export interface FlowStep {
  id?: string;
  prompt?: string;
  validator?: (input: string) => { valid: boolean; error?: string };
  transform?: (input: string) => any;
  onEnter?: () => Promise<void> | void;
  onExit?: () => Promise<void> | void;
  next?: string | ((value: any) => string | undefined);
  [key: string]: any;
}

export interface FlowDefinition {
  name: string;
  initialStep?: string;
  steps: FlowStep[] | Array<Record<string, any>>;
  timeoutMs?: number;
  onComplete?: (data: Record<string, any>) => Promise<void> | void;
  onCancel?: () => Promise<void> | void;
  [key: string]: any;
}

export interface FlowInstance {
  id: string;
  definition: FlowDefinition;
  currentStep: string;
  state: FlowState;
  data: Record<string, any>;
  startedAt: number;
  lastActivityAt: number;
  history: Array<{ step: string; input: any; at: number }>;
}
