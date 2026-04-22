import { describe, beforeEach, expect, it } from "vitest";
import { PollManager } from "./polls.js";

let mgr: PollManager;

beforeEach(() => {
  mgr = new PollManager();
});

describe("PollManager — create()", () => {
  it("returns the poll id", () => {
    const id = mgr.create("p1", "Favorite color?", ["red", "blue"]);
    expect(id).toBe("p1");
  });

  it("initializes all options with zero votes", () => {
    mgr.create("p1", "Q?", ["yes", "no"]);
    const results = mgr.getResults("p1");
    expect(results?.results.yes).toBe(0);
    expect(results?.results.no).toBe(0);
  });
});

describe("PollManager — vote()", () => {
  beforeEach(() => {
    mgr.create("p1", "Q?", ["yes", "no"]);
  });

  it("returns true for valid option", () => {
    expect(mgr.vote("p1", "yes")).toBe(true);
  });

  it("increments vote count correctly", () => {
    mgr.vote("p1", "yes");
    mgr.vote("p1", "yes");
    expect(mgr.getResults("p1")?.results.yes).toBe(2);
  });

  it("returns false for invalid option", () => {
    expect(mgr.vote("p1", "maybe")).toBe(false);
  });

  it("returns false for unknown poll", () => {
    expect(mgr.vote("unknown", "yes")).toBe(false);
  });
});

describe("PollManager — getResults()", () => {
  it("returns null for unknown poll", () => {
    expect(mgr.getResults("unknown")).toBeNull();
  });

  it("returns question and all options", () => {
    mgr.create("p2", "Best lang?", ["ts", "js", "rust"]);
    const r = mgr.getResults("p2");
    expect(r?.question).toBe("Best lang?");
    expect(Object.keys(r?.results ?? {})).toEqual(["ts", "js", "rust"]);
  });
});
