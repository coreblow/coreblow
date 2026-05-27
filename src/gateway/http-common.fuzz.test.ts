import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayAuthResult } from "./auth.js";
import {
  readJsonBodyOrError,
  sendGatewayAuthFailure,
  sendInvalidRequest,
  sendJson,
  sendMethodNotAllowed,
  sendRateLimited,
  sendText,
  sendUnauthorized,
  setDefaultSecurityHeaders,
  setSseHeaders,
  watchClientDisconnect,
  writeDone,
} from "./http-common.js";
import { makeMockHttpResponse } from "./test-http-response.js";

const readJsonBodyMock = vi.hoisted(() => vi.fn());

vi.mock("./hooks.js", () => ({
  readJsonBody: readJsonBodyMock,
}));

const ITERATIONS = 200;

beforeEach(() => {
  readJsonBodyMock.mockReset();
});

function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng: () => number, loInclusive: number, hiInclusive: number): number {
  return Math.floor(rng() * (hiInclusive - loInclusive + 1)) + loInclusive;
}

function randString(rng: () => number, maxLen = 48): string {
  const len = randInt(rng, 0, maxLen);
  let out = "";
  for (let i = 0; i < len; i += 1) {
    const bucket = rng();
    if (bucket < 0.7) {
      out += String.fromCharCode(randInt(rng, 0x20, 0x7e));
    } else if (bucket < 0.85) {
      out += " \t\n\r"[randInt(rng, 0, 3)];
    } else {
      out += String.fromCharCode(randInt(rng, 0xa0, 0x2fff));
    }
  }
  return out;
}

function randBody(rng: () => number): unknown {
  const kind = randInt(rng, 0, 5);
  if (kind === 0) {
    return null;
  }
  if (kind === 1) {
    return randString(rng, 32);
  }
  if (kind === 2) {
    return randInt(rng, -1_000_000, 1_000_000);
  }
  if (kind === 3) {
    return rng() < 0.5;
  }
  if (kind === 4) {
    const n = randInt(rng, 0, 4);
    const arr: unknown[] = [];
    for (let i = 0; i < n; i += 1) {
      arr.push(randInt(rng, 0, 100));
    }
    return arr;
  }
  return { a: randString(rng, 12), b: randInt(rng, 0, 1000), c: rng() < 0.5 };
}

describe("fuzz: setDefaultSecurityHeaders", () => {
  it("always emits the three baseline headers regardless of opts", () => {
    const rng = makeRng(0xa11ce);
    for (let i = 0; i < ITERATIONS; i += 1) {
      const { res, setHeader } = makeMockHttpResponse();
      const shape = randInt(rng, 0, 3);
      if (shape === 0) {
        setDefaultSecurityHeaders(res);
      } else if (shape === 1) {
        setDefaultSecurityHeaders(res, undefined);
      } else if (shape === 2) {
        setDefaultSecurityHeaders(res, {});
      } else {
        setDefaultSecurityHeaders(res, { strictTransportSecurity: randString(rng) });
      }
      expect(setHeader).toHaveBeenCalledWith("X-Content-Type-Options", "nosniff");
      expect(setHeader).toHaveBeenCalledWith("Referrer-Policy", "no-referrer");
      expect(setHeader).toHaveBeenCalledWith(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=()",
      );
    }
  });

  it("sets Strict-Transport-Security iff opts.strictTransportSecurity is a non-empty string", () => {
    const rng = makeRng(0xb0b);
    for (let i = 0; i < ITERATIONS; i += 1) {
      const { res, setHeader } = makeMockHttpResponse();
      const value = randString(rng);
      setDefaultSecurityHeaders(res, { strictTransportSecurity: value });
      const stsCalls = setHeader.mock.calls.filter(
        (call) => call[0] === "Strict-Transport-Security",
      );
      if (value.length > 0) {
        expect(stsCalls).toHaveLength(1);
        expect(stsCalls[0]?.[1]).toBe(value);
      } else {
        expect(stsCalls).toHaveLength(0);
      }
    }
  });
});

describe("fuzz: response helpers", () => {
  it("sendJson propagates status, sets JSON content type, and serializes the body", () => {
    const rng = makeRng(0xdecaf);
    for (let i = 0; i < ITERATIONS; i += 1) {
      const { res, setHeader, end } = makeMockHttpResponse();
      const status = randInt(rng, 100, 599);
      const body = randBody(rng);
      sendJson(res, status, body);
      expect(res.statusCode).toBe(status);
      expect(setHeader).toHaveBeenCalledWith("Content-Type", "application/json; charset=utf-8");
      expect(end).toHaveBeenCalledWith(JSON.stringify(body));
    }
  });

  it("sendText propagates status, sets plain-text content type, and forwards the body", () => {
    const rng = makeRng(0xfeed);
    for (let i = 0; i < ITERATIONS; i += 1) {
      const { res, setHeader, end } = makeMockHttpResponse();
      const status = randInt(rng, 100, 599);
      const body = randString(rng, 64);
      sendText(res, status, body);
      expect(res.statusCode).toBe(status);
      expect(setHeader).toHaveBeenCalledWith("Content-Type", "text/plain; charset=utf-8");
      expect(end).toHaveBeenCalledWith(body);
    }
  });

  it("sendMethodNotAllowed always responds 405 with the supplied Allow header", () => {
    const rng = makeRng(0x405);
    for (let i = 0; i < ITERATIONS; i += 1) {
      const { res, setHeader, end } = makeMockHttpResponse();
      const useDefault = rng() < 0.3;
      const allow = useDefault ? undefined : randString(rng, 24);
      if (allow === undefined) {
        sendMethodNotAllowed(res);
        expect(setHeader).toHaveBeenCalledWith("Allow", "POST");
      } else {
        sendMethodNotAllowed(res, allow);
        expect(setHeader).toHaveBeenCalledWith("Allow", allow);
      }
      expect(res.statusCode).toBe(405);
      expect(end).toHaveBeenCalledWith("Method Not Allowed");
    }
  });

  it("sendUnauthorized is deterministic", () => {
    const expected = JSON.stringify({
      error: { message: "Unauthorized", type: "unauthorized" },
    });
    for (let i = 0; i < ITERATIONS; i += 1) {
      const { res, end } = makeMockHttpResponse();
      sendUnauthorized(res);
      expect(res.statusCode).toBe(401);
      expect(end).toHaveBeenCalledWith(expected);
    }
  });
});

describe("fuzz: auth and request helpers", () => {
  it("sendRateLimited sets Retry-After iff retryAfterMs is truthy and > 0", () => {
    const rng = makeRng(0x429);
    for (let i = 0; i < ITERATIONS; i += 1) {
      const { res, setHeader } = makeMockHttpResponse();
      const pick = randInt(rng, 0, 4);
      let retryAfterMs: number | undefined;
      if (pick === 0) {
        retryAfterMs = undefined;
      } else if (pick === 1) {
        retryAfterMs = 0;
      } else if (pick === 2) {
        retryAfterMs = -randInt(rng, 1, 100_000);
      } else if (pick === 3) {
        retryAfterMs = randInt(rng, 1, 3_600_000);
      } else {
        retryAfterMs = rng() * 5000 + 0.001;
      }
      sendRateLimited(res, retryAfterMs);
      expect(res.statusCode).toBe(429);
      const retryCalls = setHeader.mock.calls.filter((call) => call[0] === "Retry-After");
      if (typeof retryAfterMs === "number" && retryAfterMs > 0) {
        expect(retryCalls).toHaveLength(1);
        expect(retryCalls[0]?.[1]).toBe(String(Math.ceil(retryAfterMs / 1000)));
      } else {
        expect(retryCalls).toHaveLength(0);
      }
    }
  });

  it("sendGatewayAuthFailure delegates to rate-limited vs unauthorized", () => {
    const rng = makeRng(0xba5e);
    for (let i = 0; i < ITERATIONS; i += 1) {
      const { res, setHeader, end } = makeMockHttpResponse();
      const rateLimited = rng() < 0.5;
      const retryAfterMs = rateLimited && rng() < 0.7 ? randInt(rng, 1, 120_000) : undefined;
      const authResult = { ok: false, rateLimited, retryAfterMs } as GatewayAuthResult;
      sendGatewayAuthFailure(res, authResult);
      if (rateLimited) {
        expect(res.statusCode).toBe(429);
        const retryCalls = setHeader.mock.calls.filter((call) => call[0] === "Retry-After");
        if (typeof retryAfterMs === "number" && retryAfterMs > 0) {
          expect(retryCalls).toHaveLength(1);
        } else {
          expect(retryCalls).toHaveLength(0);
        }
      } else {
        expect(res.statusCode).toBe(401);
        expect(end).toHaveBeenCalledWith(
          JSON.stringify({ error: { message: "Unauthorized", type: "unauthorized" } }),
        );
      }
    }
  });

  it("sendInvalidRequest always responds 400 with supplied message", () => {
    const rng = makeRng(0xbad);
    for (let i = 0; i < ITERATIONS; i += 1) {
      const { res, end } = makeMockHttpResponse();
      const message = randString(rng, 64);
      sendInvalidRequest(res, message);
      expect(res.statusCode).toBe(400);
      expect(end).toHaveBeenCalledWith(
        JSON.stringify({ error: { message, type: "invalid_request_error" } }),
      );
    }
  });
});

describe("fuzz: readJsonBodyOrError", () => {
  const makeRequest = () => ({}) as IncomingMessage;

  it("maps readJsonBody results to the documented status/body contract", async () => {
    const rng = makeRng(0xc0de);
    for (let i = 0; i < ITERATIONS; i += 1) {
      const { res, end } = makeMockHttpResponse();
      const pick = randInt(rng, 0, 3);
      let expectedStatus: number | undefined;
      let expectedBody: string | undefined;
      let expectedValue: unknown;

      if (pick === 0) {
        const value = randBody(rng);
        expectedValue = value;
        readJsonBodyMock.mockResolvedValueOnce({ ok: true, value });
      } else if (pick === 1) {
        expectedStatus = 413;
        expectedBody = JSON.stringify({
          error: { message: "Payload too large", type: "invalid_request_error" },
        });
        readJsonBodyMock.mockResolvedValueOnce({ ok: false, error: "payload too large" });
      } else if (pick === 2) {
        expectedStatus = 408;
        expectedBody = JSON.stringify({
          error: { message: "Request body timeout", type: "invalid_request_error" },
        });
        readJsonBodyMock.mockResolvedValueOnce({ ok: false, error: "request body timeout" });
      } else {
        const text = `err-${randString(rng, 24)}`;
        expectedStatus = 400;
        expectedBody = JSON.stringify({
          error: { message: text, type: "invalid_request_error" },
        });
        readJsonBodyMock.mockResolvedValueOnce({ ok: false, error: text });
      }

      const maxBytes = randInt(rng, 1, 1 << 20);
      const req = makeRequest();
      const result = await readJsonBodyOrError(req, res, maxBytes);
      if (pick === 0) {
        expect(result).toEqual(expectedValue);
      } else {
        expect(result).toBeUndefined();
        expect(res.statusCode).toBe(expectedStatus);
        expect(end).toHaveBeenCalledWith(expectedBody);
      }
      expect(readJsonBodyMock).toHaveBeenLastCalledWith(req, maxBytes);
    }
  });
});

describe("fuzz: streaming and disconnect helpers", () => {
  it("writeDone always writes the DONE sentinel exactly once per call", () => {
    for (let i = 0; i < ITERATIONS; i += 1) {
      const { res } = makeMockHttpResponse();
      const write = vi.fn();
      (res as unknown as { write: (chunk: string) => boolean }).write = write;
      writeDone(res);
      expect(write).toHaveBeenCalledTimes(1);
      expect(write).toHaveBeenCalledWith("data: [DONE]\n\n");
    }
  });

  it("setSseHeaders sets SSE headers and invokes flushHeaders when present", () => {
    const rng = makeRng(0x55e);
    for (let i = 0; i < ITERATIONS; i += 1) {
      const { res, setHeader } = makeMockHttpResponse();
      const hasFlush = rng() < 0.5;
      const flushHeaders = vi.fn();
      if (hasFlush) {
        (res as unknown as { flushHeaders: () => void }).flushHeaders = flushHeaders;
      }
      setSseHeaders(res);
      expect(res.statusCode).toBe(200);
      expect(setHeader).toHaveBeenCalledWith("Content-Type", "text/event-stream; charset=utf-8");
      expect(setHeader).toHaveBeenCalledWith("Cache-Control", "no-cache");
      expect(setHeader).toHaveBeenCalledWith("Connection", "keep-alive");
      if (hasFlush) {
        expect(flushHeaders).toHaveBeenCalledTimes(1);
      } else {
        expect(flushHeaders).not.toHaveBeenCalled();
      }
    }
  });

  it("watchClientDisconnect invariants hold for arbitrary socket/controller shapes", () => {
    const rng = makeRng(0xc105e);
    for (let i = 0; i < ITERATIONS; i += 1) {
      const shape = randInt(rng, 0, 3);
      const same = rng() < 0.4;
      let reqSocket: EventEmitter | null = null;
      let resSocket: EventEmitter | null = null;
      if (shape === 1) {
        reqSocket = new EventEmitter();
      } else if (shape === 2) {
        resSocket = new EventEmitter();
      } else if (shape === 3 && same) {
        reqSocket = new EventEmitter();
        resSocket = reqSocket;
      } else if (shape === 3) {
        reqSocket = new EventEmitter();
        resSocket = new EventEmitter();
      }

      const preAborted = rng() < 0.25;
      const onDisconnect = rng() < 0.5 ? vi.fn() : undefined;
      const controller = new AbortController();
      if (preAborted) {
        controller.abort();
      }
      const req = { socket: reqSocket } as unknown as IncomingMessage;
      const res = { socket: resSocket } as unknown as ServerResponse;
      const cleanup = watchClientDisconnect(req, res, controller, onDisconnect);

      const uniqueSockets = new Set<EventEmitter>();
      if (reqSocket) {
        uniqueSockets.add(reqSocket);
      }
      if (resSocket) {
        uniqueSockets.add(resSocket);
      }
      for (const socket of uniqueSockets) {
        expect(socket.listenerCount("close")).toBe(1);
      }

      let expectedCallbackCalls = 0;
      for (const socket of uniqueSockets) {
        socket.emit("close");
        expectedCallbackCalls += 1;
      }
      if (uniqueSockets.size > 0) {
        expect(controller.signal.aborted).toBe(true);
        if (onDisconnect) {
          expect(onDisconnect).toHaveBeenCalledTimes(expectedCallbackCalls);
        }
      } else {
        expect(controller.signal.aborted).toBe(preAborted);
      }

      cleanup();
      for (const socket of uniqueSockets) {
        expect(socket.listenerCount("close")).toBe(0);
      }
    }
  });
});
