import type { ModelDefinitionConfig } from "coreblow/plugin-sdk/provider-model-shared";

export const BYTEPLUS_BASE_URL = "https://ark.ap-southeast.bytepluses.com/api/v3";
export const BYTEPLUS_CODING_BASE_URL = "https://ark.ap-southeast.bytepluses.com/api/coding/v3";
export const BYTEPLUS_DEFAULT_MODEL_ID = "seed-1-8-251228";
export const BYTEPLUS_CODING_DEFAULT_MODEL_ID = "ark-code-latest";
export const BYTEPLUS_DEFAULT_MODEL_REF = `byteplus/${BYTEPLUS_DEFAULT_MODEL_ID}`;

const BYTEPLUS_DEFAULT_COST = {
  input: 0.0001,
  output: 0.0002,
  cacheRead: 0,
  cacheWrite: 0,
} as const;

const BYTEPLUS_KIMI_COST = {
  input: 0.6,
  output: 2.5,
  cacheRead: 0.12,
  cacheWrite: 0,
} as const;

export const BYTEPLUS_MODEL_CATALOG: ModelDefinitionConfig[] = [
  {
    id: "seed-1-8-251228",
    name: "Seed 1.8",
    reasoning: false,
    input: ["text", "image"],
    contextWindow: 256000,
    maxTokens: 4096,
    cost: { ...BYTEPLUS_DEFAULT_COST },
  },
  {
    id: "kimi-k2-5-260127",
    name: "Kimi K2.5",
    reasoning: true,
    input: ["text", "image"],
    contextWindow: 256000,
    maxTokens: 32768,
    cost: { ...BYTEPLUS_KIMI_COST },
  },
  {
    id: "glm-4-7-251222",
    name: "GLM 4.7",
    reasoning: false,
    input: ["text", "image"],
    contextWindow: 200000,
    maxTokens: 4096,
    cost: { ...BYTEPLUS_DEFAULT_COST },
  },
];

export const BYTEPLUS_CODING_MODEL_CATALOG: ModelDefinitionConfig[] = [
  {
    id: "ark-code-latest",
    name: "Ark Coding Plan",
    reasoning: false,
    input: ["text"],
    contextWindow: 256000,
    maxTokens: 4096,
    cost: { ...BYTEPLUS_DEFAULT_COST },
  },
  {
    id: "doubao-seed-code",
    name: "Doubao Seed Code",
    reasoning: false,
    input: ["text"],
    contextWindow: 256000,
    maxTokens: 4096,
    cost: { ...BYTEPLUS_DEFAULT_COST },
  },
  {
    id: "glm-4.7",
    name: "GLM 4.7 Coding",
    reasoning: false,
    input: ["text"],
    contextWindow: 200000,
    maxTokens: 4096,
    cost: { ...BYTEPLUS_DEFAULT_COST },
  },
  {
    id: "kimi-k2-thinking",
    name: "Kimi K2 Thinking",
    reasoning: true,
    input: ["text"],
    contextWindow: 256000,
    maxTokens: 32768,
    cost: { ...BYTEPLUS_KIMI_COST },
  },
  {
    id: "kimi-k2.5",
    name: "Kimi K2.5 Coding",
    reasoning: true,
    input: ["text"],
    contextWindow: 256000,
    maxTokens: 32768,
    cost: { ...BYTEPLUS_KIMI_COST },
  },
];

export function buildBytePlusModelDefinition(entry: ModelDefinitionConfig): ModelDefinitionConfig {
  return {
    ...entry,
    input: [...entry.input],
    cost: entry.cost ? { ...entry.cost } : { ...BYTEPLUS_DEFAULT_COST },
    compat: entry.compat ? { ...entry.compat } : undefined,
  };
}
