import { describe, expect, it } from "vitest";
import { mattermostPlugin } from "./channel.js";
import { mattermostSetupPlugin } from "./channel.setup.js";

describe("mattermost plugin contract surfaces", () => {
  it("exposes actions, setup, and status on the main plugin", () => {
    expect(mattermostPlugin.actions?.supportsAction?.({ action: "send" })).toBe(true);
    expect(mattermostPlugin.actions?.supportsAction?.({ action: "react" })).toBe(true);
    expect(mattermostPlugin.setup).toBeTruthy();
    expect(mattermostPlugin.status).toBeTruthy();
  });

  it("keeps a setup-only plugin seam", () => {
    expect(mattermostSetupPlugin.id).toBe("mattermost");
    expect(mattermostSetupPlugin.setup).toBeTruthy();
    expect(mattermostSetupPlugin.setupWizard).toBeTruthy();
    expect(mattermostSetupPlugin.config?.isConfigured).toBeTypeOf("function");
  });
});
