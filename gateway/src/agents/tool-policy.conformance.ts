/** Tool policy conformance checks. */ export { ToolPolicy } from './tool-policy.js'; export function isConformant(policy: unknown): boolean { return policy !== null && typeof policy === 'object'; }
