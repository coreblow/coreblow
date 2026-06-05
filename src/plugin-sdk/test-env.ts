export function createMockServerResponse() {
  const chunks: string[] = [];
  return {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: chunks,
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
    },
    end(chunk?: string) {
      if (chunk) {
        chunks.push(chunk);
      }
    },
  };
}
