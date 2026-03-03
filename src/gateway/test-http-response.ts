import type { ServerResponse } from "node:http";
import { vi , Mock } from "vitest";

export function makeMockHttpResponse(): {
  res: ServerResponse;
  setHeader: Mock;
  end: Mock;
} {
  const setHeader = vi.fn();
  const end = vi.fn();
  const res = {
    headersSent: false,
    statusCode: 200,
    setHeader,
    end,
  } as unknown as ServerResponse;
  return { res, setHeader, end };
}
