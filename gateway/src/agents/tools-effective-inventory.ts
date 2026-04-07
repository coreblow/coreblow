/** Effective tool inventory — resolve enabled tools after policy. */
import { ToolCatalog } from './tool-catalog.js';
import { ToolPolicy } from './tool-policy.js';
export function getEffectiveTools(catalog: ToolCatalog, policy: ToolPolicy): string[] { return catalog.listEnabled().filter((t) => policy.evaluate(t.name).decision !== 'deny').map((t) => t.name); }
