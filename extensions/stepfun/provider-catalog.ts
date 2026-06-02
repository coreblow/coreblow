import type {
  ModelDefinitionConfig,
  ModelProviderConfig,
} from "coreblow/plugin-sdk/provider-model-shared";

export const STEPFUN_PROVIDER_ID = "stepfun";
export const STEPFUN_PLAN_PROVIDER_ID = "stepfun-plan";

export const STEPFUN_STANDARD_CN_BASE_URL = "https://api.stepfun.com/v1";
export const STEPFUN_STANDARD_INTL_BASE_URL = "https://api.stepfun.ai/v1";
export const STEPFUN_PLAN_CN_BASE_URL = "https://api.stepfun.com/step_plan/v1";
export const STEPFUN_PLAN_INTL_BASE_URL = "https://api.stepfun.ai/step_plan/v1";

const STEPFUN_DEFAULT_MODEL_ID = "step-3.5-flash";
export const STEPFUN_DEFAULT_MODEL_REF = `${STEPFUN_PROVIDER_ID}/${STEPFUN_DEFAULT_MODEL_ID}`;
export const STEPFUN_PLAN_DEFAULT_MODEL_REF = `${STEPFUN_PLAN_PROVIDER_ID}/${STEPFUN_DEFAULT_MODEL_ID}`;

const STEPFUN_DEFAULT_MODEL: ModelDefinitionConfig = {
  id: STEPFUN_DEFAULT_MODEL_ID,
  name: "Step 3.5 Flash",
  reasoning: true,
  input: ["text"],
  contextWindow: 262144,
  maxTokens: 65536,
  cost: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
  },
};

const STEPFUN_PLAN_MODELS: ModelDefinitionConfig[] = [
  STEPFUN_DEFAULT_MODEL,
  {
    ...STEPFUN_DEFAULT_MODEL,
    id: "step-3.5-flash-2603",
    name: "Step 3.5 Flash 2603",
  },
];

function withOpenAiCompletionsApi(model: ModelDefinitionConfig): ModelDefinitionConfig {
  return {
    ...model,
    input: [...model.input],
    cost: { ...model.cost },
    api: "openai-completions",
  };
}

export function buildStepFunProvider(
  baseUrl: string = STEPFUN_STANDARD_INTL_BASE_URL,
): ModelProviderConfig {
  return {
    baseUrl,
    api: "openai-completions",
    models: [STEPFUN_DEFAULT_MODEL].map(withOpenAiCompletionsApi),
  };
}

export function buildStepFunPlanProvider(
  baseUrl: string = STEPFUN_PLAN_INTL_BASE_URL,
): ModelProviderConfig {
  return {
    baseUrl,
    api: "openai-completions",
    models: STEPFUN_PLAN_MODELS.map(withOpenAiCompletionsApi),
  };
}
