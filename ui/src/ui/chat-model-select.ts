/**
 * chat-model-select.ts
 * Per-session model override state management.
 * Follows OpenClaw's chat-model-select-state.ts pattern.
 */
import type { GatewayBrowserClient } from "./gateway.ts";
import type { ModelCatalogEntry } from "./controllers/models.ts";

export type ChatModelOverride = string | null;

export type ChatModelSelectOption = {
   value: string;
   label: string;
};

export type ChatModelSelectState = {
   currentOverride: string;
   defaultModel: string;
   defaultLabel: string;
   options: ChatModelSelectOption[];
};

export function resolveChatModelOverrideValue(
   overrides: Record<string, ChatModelOverride>,
   sessionKey: string,
): string {
   const cached = overrides[sessionKey];
   if (cached) return cached;
   return "";
}

export function buildChatModelOptions(
   catalog: ModelCatalogEntry[],
   currentOverride: string,
   defaultModel: string,
): ChatModelSelectOption[] {
   const seen = new Set<string>();
   const options: ChatModelSelectOption[] = [];

   const add = (value: string, label?: string) => {
      const trimmed = value.trim();
      if (!trimmed || seen.has(trimmed.toLowerCase())) return;
      seen.add(trimmed.toLowerCase());
      options.push({ value: trimmed, label: label ?? trimmed });
   };

   for (const entry of catalog) {
      add(entry.id, `${entry.name} (${entry.provider})`);
   }
   if (currentOverride) add(currentOverride);
   if (defaultModel) add(defaultModel);

   return options;
}

export function resolveChatModelSelectState(
   catalog: ModelCatalogEntry[],
   overrides: Record<string, ChatModelOverride>,
   sessionKey: string,
   defaultModel: string,
): ChatModelSelectState {
   const currentOverride = resolveChatModelOverrideValue(overrides, sessionKey);
   const defaultEntry = catalog.find(m => m.id === defaultModel);
   const defaultLabel = defaultEntry ? `Default (${defaultEntry.name})` : defaultModel ? `Default (${defaultModel})` : "Default model";

   return {
      currentOverride,
      defaultModel,
      defaultLabel,
      options: buildChatModelOptions(catalog, currentOverride, defaultModel),
   };
}

export async function switchChatModel(
   client: GatewayBrowserClient,
   sessionKey: string,
   model: string,
   overrides: Record<string, ChatModelOverride>,
): Promise<Record<string, ChatModelOverride>> {
   const prevOverride = overrides[sessionKey];
   const newOverrides = { ...overrides, [sessionKey]: model || null };

   try {
      await client.request("sessions.patch", { key: sessionKey, model: model || null });
      return newOverrides;
   } catch {
      // Rollback on failure
      return { ...overrides, [sessionKey]: prevOverride ?? null };
   }
}
