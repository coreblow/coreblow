export function createZaloMonitorMocks() {
  return {
    fetcher: async () => new Response(JSON.stringify({ ok: true, result: [] })),
  };
}
