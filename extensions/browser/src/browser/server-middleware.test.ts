import { EventEmitter } from "node:events";
import type { AddressInfo } from "node:net";
import express from "express";
import { afterEach, describe, expect, it } from "vitest";
import { installBrowserCommonMiddleware } from "./server-middleware.js";

function getSignalMiddleware() {
  const handlers: Array<(req: unknown, res: unknown, next: (err?: unknown) => void) => void> = [];
  const fakeApp = {
    use(fn: (req: unknown, res: unknown, next: (err?: unknown) => void) => void) {
      if (fn.length === 3) {
        handlers.push(fn);
      }
    },
  } as unknown as express.Express;

  installBrowserCommonMiddleware(fakeApp);
  expect(handlers[0]).toBeDefined();
  return handlers[0];
}

function createReqWithGetterSignal(getter: () => AbortSignal | undefined) {
  const proto = Object.create(EventEmitter.prototype) as object;
  Object.defineProperty(proto, "signal", {
    get: getter,
    enumerable: true,
    configurable: true,
  });
  const req = new EventEmitter();
  Object.setPrototypeOf(req, proto);
  return req;
}

describe("installBrowserCommonMiddleware", () => {
  const servers: Array<{ close: (cb: () => void) => void }> = [];

  afterEach(async () => {
    while (servers.length > 0) {
      const server = servers.pop();
      if (server) {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    }
  });

  it("attaches an abort signal when request has no signal (Node 22 path)", async () => {
    const app = express();
    installBrowserCommonMiddleware(app);
    let observedSignal: AbortSignal | undefined;
    app.get("/check", (req, res) => {
      observedSignal = (req as unknown as { signal?: AbortSignal }).signal;
      res.status(200).json({ hasSignal: observedSignal instanceof AbortSignal });
    });

    const server = app.listen(0, "127.0.0.1");
    servers.push(server);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const { port } = server.address() as AddressInfo;

    const res = await fetch(`http://127.0.0.1:${port}/check`);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ hasSignal: true });
  });

  it("preserves a read-only getter signal without throwing (Node 24 path)", () => {
    const signalMiddleware = getSignalMiddleware();
    const nativeCtrl = new AbortController();
    const req = createReqWithGetterSignal(() => nativeCtrl.signal);
    const res = Object.assign(new EventEmitter(), { writableEnded: false });

    let nextErr: unknown;
    signalMiddleware(req, res, (err?: unknown) => {
      nextErr = err;
    });

    expect(nextErr).toBeUndefined();
    expect((req as unknown as { signal?: AbortSignal }).signal).toBe(nativeCtrl.signal);
  });

  it("does not throw if a prototype exposes a getter-only undefined signal", () => {
    const signalMiddleware = getSignalMiddleware();
    const req = createReqWithGetterSignal(() => undefined);
    const res = Object.assign(new EventEmitter(), { writableEnded: false });

    signalMiddleware(req, res, () => {});
    const attached = (req as unknown as { signal?: AbortSignal }).signal;
    expect(attached).toBeInstanceOf(AbortSignal);
    expect(attached?.aborted).toBe(false);

    res.emit("close");
    expect(attached?.aborted).toBe(true);
  });
});
