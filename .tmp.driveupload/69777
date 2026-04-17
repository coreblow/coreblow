import type { GatewayBrowserClient } from "../gateway.ts";

export type ModelCatalogEntry = {
   id: string;
   name: string;
   provider: string;
   contextWindow?: number;
   reasoning?: boolean;
   input?: string[];
};

/**
 * Fetch model catalog from gateway.
 * Returns empty array on failure (never throws).
 */
export async function loadModels(client: GatewayBrowserClient): Promise<ModelCatalogEntry[]> {
   try {
      const result = await client.request<{ models: ModelCatalogEntry[] }>("models.list", {});
      return result?.models ?? [];
   } catch {
      return [];
   }
}
