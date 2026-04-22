import { describe, expect, it } from "vitest";
import {
  M_POLL_END,
  M_POLL_RESPONSE,
  M_POLL_START,
  ORG_POLL_END,
  ORG_POLL_RESPONSE,
  ORG_POLL_START,
  POLL_END_TYPES,
  POLL_EVENT_TYPES,
  POLL_RESPONSE_TYPES,
  POLL_START_TYPES,
} from "./poll-types.js";

describe("poll event type constants", () => {
  it("defines correct M_ poll type strings", () => {
    expect(M_POLL_START).toBe("m.poll.start");
    expect(M_POLL_RESPONSE).toBe("m.poll.response");
    expect(M_POLL_END).toBe("m.poll.end");
  });

  it("defines correct ORG_ poll type strings", () => {
    expect(ORG_POLL_START).toBe("org.matrix.msc3381.poll.start");
    expect(ORG_POLL_RESPONSE).toBe("org.matrix.msc3381.poll.response");
    expect(ORG_POLL_END).toBe("org.matrix.msc3381.poll.end");
  });

  it("POLL_START_TYPES contains both variants", () => {
    expect(POLL_START_TYPES).toContain(M_POLL_START);
    expect(POLL_START_TYPES).toContain(ORG_POLL_START);
    expect(POLL_START_TYPES).toHaveLength(2);
  });

  it("POLL_RESPONSE_TYPES contains both variants", () => {
    expect(POLL_RESPONSE_TYPES).toContain(M_POLL_RESPONSE);
    expect(POLL_RESPONSE_TYPES).toContain(ORG_POLL_RESPONSE);
    expect(POLL_RESPONSE_TYPES).toHaveLength(2);
  });

  it("POLL_END_TYPES contains both variants", () => {
    expect(POLL_END_TYPES).toContain(M_POLL_END);
    expect(POLL_END_TYPES).toContain(ORG_POLL_END);
    expect(POLL_END_TYPES).toHaveLength(2);
  });

  it("POLL_EVENT_TYPES contains all 6 types", () => {
    expect(POLL_EVENT_TYPES).toHaveLength(6);
    expect(POLL_EVENT_TYPES).toContain(M_POLL_START);
    expect(POLL_EVENT_TYPES).toContain(M_POLL_RESPONSE);
    expect(POLL_EVENT_TYPES).toContain(M_POLL_END);
    expect(POLL_EVENT_TYPES).toContain(ORG_POLL_START);
    expect(POLL_EVENT_TYPES).toContain(ORG_POLL_RESPONSE);
    expect(POLL_EVENT_TYPES).toContain(ORG_POLL_END);
  });

  it("all types are unique strings", () => {
    const unique = new Set(POLL_EVENT_TYPES);
    expect(unique.size).toBe(6);
  });
});
