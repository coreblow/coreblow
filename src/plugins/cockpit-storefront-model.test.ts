import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CapabilityConsentLedger } from "./app-store-contract.js";
import {
  type StorefrontCatalogEntry,
  buildStorefrontCatalogView,
} from "./cockpit-storefront-model.js";
import { ExtensionTierPolicy } from "./extension-tier-policy.js";

describe("Cockpit Storefront Model (DOP View Transformer)", () => {
  let testDir: string;
  let consentLedger: CapabilityConsentLedger;
  let tierPolicy: ExtensionTierPolicy;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `coreblow-storefront-test-${crypto.randomUUID()}`);
    fs.mkdirSync(testDir, { recursive: true });
    consentLedger = new CapabilityConsentLedger({ baseDir: testDir });
    tierPolicy = new ExtensionTierPolicy();
    await tierPolicy.start();
  });

  afterEach(async () => {
    await tierPolicy.stop();
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  const mockCatalogEntries: StorefrontCatalogEntry[] = [
    {
      id: "@coreblow/discord",
      name: "Discord Bot",
      summary: "Discord Bot channel connector with gateway websocket support.",
      version: "1.0.0",
      capabilities: ["network", "credentials"],
      publisher: { displayName: "CoreBlow Team" },
      hotReloadSafe: false,
    },
    {
      id: "@coreblow/feishu",
      name: "Feishu / Lark",
      summary: "Feishu enterprise webhook bot.",
      version: "1.0.0",
      capabilities: ["network", "webhook"],
      publisher: { displayName: "CoreBlow Team" },
      hotReloadSafe: true,
    },
    {
      id: "@coreblow/telegram",
      name: "Telegram Bot",
      summary: "Core built-in Telegram Bot channel.",
      version: "1.0.0",
      capabilities: ["network", "credentials"],
      publisher: { displayName: "CoreBlow Core" },
      hotReloadSafe: true,
    },
  ];

  it("transforms catalog entries into rich storefront cards with resolved tiers and install specs", () => {
    const cards = buildStorefrontCatalogView({
      catalogEntries: mockCatalogEntries,
      consentLedger,
      tierPolicy,
      installedStates: {
        "@coreblow/discord": "installed_disabled",
        telegram: "active",
      },
      backupVersions: {
        discord: ["0.9.0"],
      },
    });

    expect(cards).toHaveLength(3);

    const discordCard = cards.find((c) => c.id === "@coreblow/discord")!;
    expect(discordCard.label).toBe("Discord Bot");
    expect(discordCard.tier).toBe("corehub_on_demand");
    expect(discordCard.isKernel).toBe(false);
    expect(discordCard.lifecycleState).toBe("installed_disabled");
    expect(discordCard.requiredCapabilities).toEqual(["network", "credentials"]);
    expect(discordCard.consentGranted).toBe(false);
    expect(discordCard.hotReloadSafe).toBe(false);
    expect(discordCard.canRollback).toBe(true);
    expect(discordCard.installSpec).toBe("corehub:@coreblow/discord");

    const telegramCard = cards.find((c) => c.id === "@coreblow/telegram")!;
    expect(telegramCard.tier).toBe("core");
    expect(telegramCard.isKernel).toBe(true);
    expect(telegramCard.lifecycleState).toBe("active");
    expect(telegramCard.installSpec).toBe("");
    expect(telegramCard.canRollback).toBe(false);
  });

  it("reflects granted capability consent from CapabilityConsentLedger", () => {
    consentLedger.grantConsent("discord", ["network", "credentials"], "admin");

    const cards = buildStorefrontCatalogView({
      catalogEntries: mockCatalogEntries,
      consentLedger,
      tierPolicy,
    });

    const discordCard = cards.find((c) => c.id === "@coreblow/discord")!;
    expect(discordCard.consentGranted).toBe(true);

    const feishuCard = cards.find((c) => c.id === "@coreblow/feishu")!;
    expect(feishuCard.consentGranted).toBe(false);
  });

  it("filters catalog cards by tierFilter", () => {
    const coreOnly = buildStorefrontCatalogView({
      catalogEntries: mockCatalogEntries,
      tierPolicy,
      tierFilter: "core",
    });

    expect(coreOnly).toHaveLength(1);
    expect(coreOnly[0].id).toBe("@coreblow/telegram");

    const onDemandOnly = buildStorefrontCatalogView({
      catalogEntries: mockCatalogEntries,
      tierPolicy,
      tierFilter: "corehub_on_demand",
    });

    expect(onDemandOnly).toHaveLength(2);
    expect(onDemandOnly.map((c) => c.id)).toEqual(["@coreblow/discord", "@coreblow/feishu"]);
  });

  it("searches catalog cards by keyword matching title, description, or capability", () => {
    const searchLark = buildStorefrontCatalogView({
      catalogEntries: mockCatalogEntries,
      tierPolicy,
      searchQuery: "lark",
    });
    expect(searchLark).toHaveLength(1);
    expect(searchLark[0].id).toBe("@coreblow/feishu");

    const searchWebhook = buildStorefrontCatalogView({
      catalogEntries: mockCatalogEntries,
      tierPolicy,
      searchQuery: "webhook",
    });
    expect(searchWebhook).toHaveLength(1);
    expect(searchWebhook[0].id).toBe("@coreblow/feishu");

    const searchNone = buildStorefrontCatalogView({
      catalogEntries: mockCatalogEntries,
      tierPolicy,
      searchQuery: "nonexistent-keyword",
    });
    expect(searchNone).toHaveLength(0);
  });
});
