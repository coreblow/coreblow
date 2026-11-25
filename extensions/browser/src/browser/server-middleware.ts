import type { Express } from "express";
import express from "express";
import { browserMutationGuardMiddleware } from "./csrf.js";
import { isAuthorizedBrowserRequest } from "./http-auth.js";

export function installBrowserCommonMiddleware(app: Express) {
  app.use((req, res, next) => {
    // Node 24+ exposes a read-only IncomingMessage.signal getter; preserve it when present.
    const existingSignal = (req as unknown as { signal?: AbortSignal }).signal;
    if (!existingSignal) {
      const ctrl = new AbortController();
      const abort = () => ctrl.abort(new Error("request aborted"));
      req.once("aborted", abort);
      res.once("close", () => {
        if (!res.writableEnded) {
          abort();
        }
      });
      // Make the signal available to browser route handlers (best-effort).
      try {
        Object.defineProperty(req, "signal", {
          value: ctrl.signal,
          configurable: true,
          enumerable: true,
          writable: true,
        });
      } catch {
        // Ignore non-configurable signal properties on custom request objects.
      }
    }
    next();
  });
  app.use(express.json({ limit: "1mb" }));
  app.use(browserMutationGuardMiddleware());
}

export function installBrowserAuthMiddleware(
  app: Express,
  auth: { token?: string; password?: string },
) {
  if (!auth.token && !auth.password) {
    return;
  }
  app.use((req, res, next) => {
    if (isAuthorizedBrowserRequest(req, auth)) {
      return next();
    }
    res.status(401).send("Unauthorized");
  });
}
