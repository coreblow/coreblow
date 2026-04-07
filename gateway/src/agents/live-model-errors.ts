/** Live model error tracking. */
const errors: Array<{ model: string; error: string; timestamp: number }> = [];
export function recordModelError(model: string, error: string): void { errors.push({ model, error, timestamp: Date.now() }); if (errors.length > 100) errors.splice(0, errors.length - 100); }
export function getRecentErrors(n = 10) { return errors.slice(-n); }
export function clearModelErrors() { errors.length = 0; }
