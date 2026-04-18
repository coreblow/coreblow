/** CoreBlow — NPM Registry Spec */
export interface RegistrySpec { registry: string; scope?: string; }
export function resolveRegistrySpec(env: NodeJS.ProcessEnv = process.env): RegistrySpec { return { registry: env.NPM_REGISTRY || "https://registry.npmjs.org", scope: env.NPM_SCOPE }; }
