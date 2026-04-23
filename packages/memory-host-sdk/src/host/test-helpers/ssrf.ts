/**
 * Test helper for mocking SSRF hostname resolution.
 *
 * Provides a mock that resolves any hostname to a dummy
 * public IP address, bypassing real DNS lookups in tests
 * that exercise HTTP batch/embedding code paths.
 */

import { vi } from "vitest";
import * as ssrf from "../../../../../src/infra/net/ssrf.js";

/**
 * Mocks `resolvePinnedHostnameWithPolicy` to resolve any hostname
 * to a stable public IP (`93.184.216.34`) without performing
 * real DNS lookups.
 *
 * @returns The vitest spy instance for assertion/cleanup
 */
export function mockPublicPinnedHostname() {
  return vi.spyOn(ssrf, "resolvePinnedHostnameWithPolicy").mockImplementation(async (hostname) => {
    const normalized = hostname.trim().toLowerCase().replace(/\.$/, "");
    const addresses = ["93.184.216.34"];
    return {
      hostname: normalized,
      addresses,
      lookup: ssrf.createPinnedLookup({ hostname: normalized, addresses }),
    };
  });
}
