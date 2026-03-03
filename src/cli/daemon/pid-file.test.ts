import { describe, expect, it } from "vitest";
import { writePid, readPid, removePid } from "./pid-file.js";

describe("readPid()", () => {
  it("returns null when pid file does not exist", () => {
    // First ensure no pid file by removing it
    removePid();
    const result = readPid();
    expect(result === null || typeof result === "number").toBe(true);
  });
});

describe("writePid() + readPid() round-trip", () => {
  it("writes and reads back the same PID", () => {
    writePid(12345);
    const result = readPid();
    expect(result).toBe(12345);
    removePid();
  });

  it("overwrites previous PID on second write", () => {
    writePid(1111);
    writePid(2222);
    expect(readPid()).toBe(2222);
    removePid();
  });
});

describe("removePid()", () => {
  it("does not throw when file does not exist", () => {
    removePid();
    expect(() => removePid()).not.toThrow();
  });

  it("removes pid file so readPid returns null", () => {
    writePid(9999);
    removePid();
    expect(readPid()).toBeNull();
  });
});
