/** CoreBlow — Main Session Runtime */
let mainSessionId: string | null = null;
export function setMainSessionId(id: string): void { mainSessionId = id; }
export function getMainSessionId(): string | null { return mainSessionId; }
export function clearMainSession(): void { mainSessionId = null; }
