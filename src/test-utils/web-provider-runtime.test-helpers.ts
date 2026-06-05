import type { PluginWebSearchProviderEntry } from "../plugins/types.js";

type CommonWebProviderTestParams = {
  pluginId: string;
  id: string;
  credentialPath: string;
  autoDetectOrder?: number;
  requiresCredential?: boolean;
  getCredentialValue?: (config?: Record<string, unknown>) => unknown;
  getConfiguredCredentialValue?: (config?: Record<string, unknown>) => unknown;
};

function createDefaultProviderTool(providerId: string) {
  return {
    description: providerId,
    parameters: {},
    execute: async (args: Record<string, unknown>) => ({ ...args, provider: providerId }),
  };
}

export type WebSearchTestProviderParams = CommonWebProviderTestParams & {
  createTool?: PluginWebSearchProviderEntry["createTool"];
};

export type WebFetchTestProviderParams = WebSearchTestProviderParams;

export function createWebSearchTestProvider(
  params: WebSearchTestProviderParams,
): PluginWebSearchProviderEntry {
  return {
    pluginId: params.pluginId,
    id: params.id,
    label: params.id,
    hint: `${params.id} runtime provider`,
    envVars: [`${params.id.toUpperCase()}_API_KEY`],
    placeholder: `${params.id}-...`,
    signupUrl: `https://example.com/${params.id}`,
    credentialPath: params.credentialPath,
    getCredentialValue: params.getCredentialValue ?? (() => undefined),
    setCredentialValue: () => {},
    getConfiguredCredentialValue: params.getConfiguredCredentialValue,
    createTool: params.createTool ?? (() => createDefaultProviderTool(params.id)),
  };
}

export const createWebFetchTestProvider = createWebSearchTestProvider;
