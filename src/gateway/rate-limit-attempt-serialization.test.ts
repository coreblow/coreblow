import { describe, expect, it } from "vitest";
import { withSerializedRateLimitAttempt } from "./rate-limit-attempt-serialization.js";

function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("withSerializedRateLimitAttempt", () => {
  it("serializes attempts for the same normalized IP and scope", async () => {
    const firstStarted = createDeferred();
    const releaseFirst = createDeferred();
    const order: string[] = [];

    const first = withSerializedRateLimitAttempt({
      ip: "::ffff:127.0.0.1",
      scope: "shared-secret",
      run: async () => {
        order.push("first:start");
        firstStarted.resolve();
        await releaseFirst.promise;
        order.push("first:end");
        return "first";
      },
    });

    await firstStarted.promise;
    let secondSettled = false;
    const second = withSerializedRateLimitAttempt({
      ip: "127.0.0.1",
      scope: "shared-secret",
      run: async () => {
        order.push("second:start");
        return "second";
      },
    }).then((value) => {
      secondSettled = true;
      return value;
    });

    await Promise.resolve();
    expect(secondSettled).toBe(false);
    expect(order).toEqual(["first:start"]);

    releaseFirst.resolve();
    await expect(first).resolves.toBe("first");
    await expect(second).resolves.toBe("second");
    expect(order).toEqual(["first:start", "first:end", "second:start"]);
  });

  it("keeps independent scopes concurrent", async () => {
    const releaseFirst = createDeferred();
    const order: string[] = [];

    const first = withSerializedRateLimitAttempt({
      ip: "10.0.0.5",
      scope: "shared-secret",
      run: async () => {
        order.push("first:start");
        await releaseFirst.promise;
        order.push("first:end");
      },
    });

    const second = withSerializedRateLimitAttempt({
      ip: "10.0.0.5",
      scope: "device-token",
      run: async () => {
        order.push("second:start");
      },
    });

    await second;
    expect(order).toEqual(["first:start", "second:start"]);

    releaseFirst.resolve();
    await first;
    expect(order).toEqual(["first:start", "second:start", "first:end"]);
  });
});
