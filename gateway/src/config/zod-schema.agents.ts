/** CoreBlow — Zod Schema: Agents */
import { validateString, validateNumber } from "./zod-schema.core.js";
export function validateAgentConfig(config: Record<string, unknown>): string[] {
  const errors: string[] = [];
  errors.push(...validateString(config.model, "agent.model"));
  errors.push(...validateString(config.provider, "agent.provider"));
  if (config.temperature !== undefined) errors.push(...validateNumber(config.temperature, "agent.temperature", 0, 2));
  if (config.maxTokens !== undefined) errors.push(...validateNumber(config.maxTokens, "agent.maxTokens", 1, 1_000_000));
  return errors;
}
