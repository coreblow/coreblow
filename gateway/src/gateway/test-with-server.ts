/** CoreBlow — Test With Server */ export async function withTestServer(fn: (url: string) => Promise<void>): Promise<void> { await fn("http://localhost:3000"); }
