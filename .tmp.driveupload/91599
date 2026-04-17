/** Tool policy pipeline — chain multiple policies. */
import { ToolPolicy, type ToolPolicyResult } from './tool-policy.js';
export function evaluatePipeline(policies: ToolPolicy[], toolName: string): ToolPolicyResult {
    for (const policy of policies) { const result = policy.evaluate(toolName); if (result.decision !== 'allow') return result; }
    return { decision: 'allow' };
}
