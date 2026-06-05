import { expect } from "vitest";

export function expectExplicitVideoGenerationCapabilities(provider: {
  capabilities?: unknown;
}): void {
  expect(provider.capabilities).toBeTruthy();
}

export function expectExplicitMusicGenerationCapabilities(provider: {
  capabilities?: unknown;
}): void {
  expect(provider.capabilities).toBeTruthy();
}
