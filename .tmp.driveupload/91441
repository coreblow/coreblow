/**
 * agents/vendor-models.ts
 * Vendor-specific model registries — DeepSeek, Together, Venice, BytePlus, Chutes, Doubao, Kilocode.
 */
export interface VendorModel { id: string; name: string; provider: string; contextWindow: number; maxOutput: number; pricing?: { input: number; output: number }; }

const DEEPSEEK_MODELS: VendorModel[] = [
    { id: 'deepseek-chat', name: 'DeepSeek V3', provider: 'deepseek', contextWindow: 128_000, maxOutput: 8_192, pricing: { input: 0.27, output: 1.10 } },
    { id: 'deepseek-reasoner', name: 'DeepSeek R1', provider: 'deepseek', contextWindow: 128_000, maxOutput: 8_192, pricing: { input: 0.55, output: 2.19 } },
];
const TOGETHER_MODELS: VendorModel[] = [
    { id: 'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo', name: 'Llama 3.1 405B', provider: 'together', contextWindow: 128_000, maxOutput: 4_096, pricing: { input: 3.50, output: 3.50 } },
    { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', name: 'Llama 3.3 70B', provider: 'together', contextWindow: 128_000, maxOutput: 4_096, pricing: { input: 0.88, output: 0.88 } },
];

const ALL_VENDOR_MODELS = new Map<string, VendorModel[]>([['deepseek', DEEPSEEK_MODELS], ['together', TOGETHER_MODELS]]);

export function getVendorModels(vendor: string): VendorModel[] { return ALL_VENDOR_MODELS.get(vendor) ?? []; }
export function getAllVendorModels(): VendorModel[] { return [...ALL_VENDOR_MODELS.values()].flat(); }
export function findVendorModel(modelId: string): VendorModel | undefined { return getAllVendorModels().find((m) => m.id === modelId); }
export function listVendors(): string[] { return [...ALL_VENDOR_MODELS.keys()]; }
