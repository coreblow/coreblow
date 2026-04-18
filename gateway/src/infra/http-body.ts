/** CoreBlow — HTTP Body Parsing */
export async function parseJsonBody<T = unknown>(request: Request, maxBytes = 1_048_576): Promise<T> {
  const text = await request.text();
  if (text.length > maxBytes) throw new Error("Request body too large");
  return JSON.parse(text) as T;
}
export function createJsonResponse(data: unknown, status = 200): Response { return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } }); }
export function createErrorResponse(message: string, status = 500): Response { return createJsonResponse({ error: message }, status); }
