import { describe, expect, it } from "vitest";
import {
  isIpv4Address,
  isIpv6Address,
  parseCanonicalIpAddress,
  parseLooseIpAddress,
  normalizeIpAddress,
  isCanonicalDottedDecimalIPv4,
  isLegacyIpv4Literal,
  isLoopbackIpAddress,
  isPrivateOrLoopbackIpAddress,
} from "./ip.js";
import { blockedIpv6MulticastLiterals } from "./ip-test-fixtures.js";

describe("shared ip helpers", () => {
  it("distinguishes canonical dotted IPv4 from legacy forms", () => {
    expect(isCanonicalDottedDecimalIPv4("192.168.1.1")).toBe(true);
    expect(isCanonicalDottedDecimalIPv4("0x7f000001")).toBe(false);
    expect(isCanonicalDottedDecimalIPv4(undefined)).toBe(false);
  });

  it("detects legacy IPv4 literal formats", () => {
    expect(isLegacyIpv4Literal("0177.0.0.1")).toBe(true);
    expect(isLegacyIpv4Literal("192.168.1.1")).toBe(false);
    expect(isLegacyIpv4Literal(undefined)).toBe(false);
  });

  it("parses canonical IP addresses", () => {
    const v4 = parseCanonicalIpAddress("192.168.1.1");
    expect(v4).toBeDefined();
    if (v4) expect(isIpv4Address(v4)).toBe(true);

    const v6 = parseCanonicalIpAddress("::1");
    expect(v6).toBeDefined();
    if (v6) expect(isIpv6Address(v6)).toBe(true);

    expect(parseCanonicalIpAddress("not-an-ip")).toBeUndefined();
    expect(parseCanonicalIpAddress(undefined)).toBeUndefined();
  });

  it("normalizes canonical IP strings", () => {
    expect(normalizeIpAddress("192.168.1.1")).toBe("192.168.1.1");
    expect(normalizeIpAddress("::1")).toBeDefined();
    expect(normalizeIpAddress(undefined)).toBeUndefined();
    expect(normalizeIpAddress("garbage")).toBeUndefined();
  });

  it("detects loopback addresses", () => {
    expect(isLoopbackIpAddress("127.0.0.1")).toBe(true);
    expect(isLoopbackIpAddress("::1")).toBe(true);
    expect(isLoopbackIpAddress("8.8.8.8")).toBe(false);
    expect(isLoopbackIpAddress(undefined)).toBe(false);
  });

  it("classifies private and loopback addresses", () => {
    expect(isPrivateOrLoopbackIpAddress("127.0.0.1")).toBe(true);
    expect(isPrivateOrLoopbackIpAddress("192.168.1.1")).toBe(true);
    expect(isPrivateOrLoopbackIpAddress("10.0.0.1")).toBe(true);
    expect(isPrivateOrLoopbackIpAddress("8.8.8.8")).toBe(false);
  });

  it("parses loose legacy IPv4 literals", () => {
    const parsed = parseLooseIpAddress("0177.0.0.1");
    expect(parsed).toBeDefined();
  });

  it("exports blocked IPv6 multicast test fixtures", () => {
    expect(blockedIpv6MulticastLiterals).toBeDefined();
    expect(blockedIpv6MulticastLiterals.length).toBeGreaterThan(0);
  });
});
