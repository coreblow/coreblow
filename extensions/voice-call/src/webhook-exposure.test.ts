import { describe, expect, it } from "vitest";
import { isLocalOnlyWebhookHost, isProviderUnreachableWebhookUrl } from "./webhook-exposure.js";

describe("webhook exposure host classification", () => {
  it.each([
    "http://[::]:3334/voice/webhook",
    "http://[::1]:3334/voice/webhook",
    "http://[fc00::1]/voice/webhook",
    "http://[fd00::1]/voice/webhook",
    "http://[::ffff:127.0.0.1]/voice/webhook",
    "http://[::ffff:10.0.0.1]/voice/webhook",
  ])("treats local/private webhook URL %s as provider-unreachable", (url) => {
    expect(isProviderUnreachableWebhookUrl(url)).toBe(true);
  });

  it("does not reject public webhook URL", () => {
    expect(isProviderUnreachableWebhookUrl("https://voice.example.com/voice/webhook")).toBe(false);
  });

  it.each(["[::1]", "[fc00::1]", "[fd00::1]"])(
    "normalizes local/private URL hostnames like %s",
    (host) => {
      expect(isLocalOnlyWebhookHost(host)).toBe(true);
    },
  );
});
