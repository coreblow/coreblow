import { describe, expect, it } from "vitest";
import {
  isPrivateIpAddress,
  isBlockedHostname,
  isBlockedHostnameOrIp,
  isPrivateNetworkAllowedByPolicy,
} from "./ssrf.js";
import { blockedIpv6MulticastLiterals } from "../../shared/net/ip-test-fixtures.js";

describe("SSRF protection", () => {
  it("blocks private IPv4 addresses by default", () => {
    expect(isPrivateIpAddress("127.0.0.1")).toBe(true);
    expect(isPrivateIpAddress("10.0.0.1")).toBe(true);
    expect(isPrivateIpAddress("192.168.1.1")).toBe(true);
    expect(isPrivateIpAddress("172.16.0.1")).toBe(true);
  });

  it("allows public IPv4 addresses", () => {
    expect(isPrivateIpAddress("8.8.8.8")).toBe(false);
    expect(isPrivateIpAddress("1.1.1.1")).toBe(false);
  });

  it("blocks localhost hostnames", () => {
    expect(isBlockedHostname("localhost")).toBe(true);
    expect(isBlockedHostnameOrIp("localhost")).toBe(true);
  });

  it("allows public hostnames", () => {
    expect(isBlockedHostname("example.com")).toBe(false);
  });

  it("denies private networks by default policy", () => {
    expect(isPrivateNetworkAllowedByPolicy()).toBe(false);
    expect(isPrivateNetworkAllowedByPolicy(undefined)).toBe(false);
  });

  it("treats blocked IPv6 multicast literals as blocked", () => {
    for (const literal of blockedIpv6MulticastLiterals) {
      const cleaned = literal.replace(/[\[\]]/g, "");
      expect(isBlockedHostnameOrIp(cleaned)).toBe(true);
    }
  });
});
