/**
 * src/channels/discord/handlers/autocomplete.ts
 * Autocomplete suggestions for slash command options
 */

import type { DiscordInteraction } from '../types-sdk.js';
import { discordLog } from '../utils/logger.js';

/** Default model suggestions for autocomplete */
const MODEL_SUGGESTIONS = [
 { name: 'GPT-4o', value: 'gpt-4o' },
 { name: 'GPT-4o Mini', value: 'gpt-4o-mini' },
 { name: 'Claude 3.5 Sonnet', value: 'claude-3.5-sonnet' },
 { name: 'Claude 3 Opus', value: 'claude-3-opus' },
 { name: 'Gemini Pro', value: 'gemini-pro' },
 { name: 'Gemini 1.5 Flash', value: 'gemini-1.5-flash' },
 { name: 'Llama 3 (Ollama)', value: 'llama3' },
 { name: 'Mistral 7B (Ollama)', value: 'mistral-7b' },
];

export async function handleAutocomplete(interaction: DiscordInteraction & { respond?: (choices: Array<{ name: string; value: string }>) => Promise<void> }): Promise<void> {
 try {
 const focusedOption = interaction.options?.getString?.('focused') ? { name: 'model', value: interaction.options.getString('model') || '' } : undefined;
 if (!focusedOption) return;

 let choices: { name: string; value: string }[] = [];

 if (focusedOption.name === 'name' || focusedOption.name === 'model') {
  const query = (focusedOption.value || '').toLowerCase();
  choices = MODEL_SUGGESTIONS.filter(s => s.name.toLowerCase().includes(query) || s.value.toLowerCase().includes(query));
 }

 await interaction.respond?.(choices.slice(0, 25));
 } catch (err: unknown) {
 discordLog.debug({ err: (err instanceof Error ? err.message : String(err)) }, 'Autocomplete error');
 }
}
