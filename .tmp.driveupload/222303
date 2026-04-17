/**
 * web/api-response.ts
 */
export function jsonResponse(data: unknown, status = 200) { return {status, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)}; } export function errorResponse(message: string, status = 500) { return jsonResponse({error: message}, status); }
