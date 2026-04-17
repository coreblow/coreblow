/**
 * config/zod-schema.allowdeny.ts — Allow/deny rule validation
 */
import { z } from 'zod';

export const AllowDenySchema = z.object({
    allow: z.array(z.string()).optional(),
    deny: z.array(z.string()).optional(),
}).refine(
    data => !(data.allow && data.deny && data.allow.length > 0 && data.deny.length > 0),
    { message: 'Cannot specify both allow and deny lists simultaneously' }
);

export type AllowDenyConfig = z.infer<typeof AllowDenySchema>;

/** Check if a value is allowed by the rule. */
export function checkAllowDeny(value: string, rules: AllowDenyConfig): boolean {
    if (rules.deny?.includes(value)) return false;
    if (rules.allow && rules.allow.length > 0) return rules.allow.includes(value);
    return true;
}
