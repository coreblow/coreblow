import { afterEach, describe, expect, it, vi } from "vitest";

const fetchWithSsrFGuard = vi.hoisted(() => vi.fn());
vi.mock("../runtime-api.js", async (importOriginal) => ({ ...(await importOriginal<typeof import("../runtime-api.js")>()), fetchWithSsrFGuard }));
const { probeNextcloudTalkBotResponseFeature } = await import("./bot-preflight.js");

afterEach(() => fetchWithSsrFGuard.mockReset());

describe("nextcloud-talk bot preflight", () => {
  it("detects a bot without the response feature", async () => {
    fetchWithSsrFGuard.mockResolvedValue({
      response: new Response(JSON.stringify({ ocs: { data: [{ id: 1, name: "CoreBlow", url: "https://gateway.example/hook", features: 1 }] } }), { status: 200 }),
      release: vi.fn(),
    });
    const result = await probeNextcloudTalkBotResponseFeature({
      account: { accountId: "default", enabled: true, baseUrl: "https://cloud.example", secret: "secret", secretSource: "config", config: { apiUser: "admin", apiPassword: "password", webhookPublicUrl: "https://gateway.example/hook" } },
    });
    expect(result).toMatchObject({ ok: false, code: "missing_response_feature", botId: "1", features: 1 });
  });
});
