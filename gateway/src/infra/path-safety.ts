/** CoreBlow — Path Safety */ export function isSafePath(p: string): boolean { return !p.includes("..") && !p.includes("\0"); }
