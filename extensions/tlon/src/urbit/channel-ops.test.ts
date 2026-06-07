import { describe, expect, it } from "vitest";
import { scryUrbitPath } from "./channel-ops.js";

describe("tlon urbit channel ops", () => {
  it("scries through the Urbit scry path", async () => {
    const response = new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
    });
    const result = await scryUrbitPath(
      {
        baseUrl: "https://groups.tlon.network",
        cookie: "urbauth=fake",
        fetchImpl: async (input) => {
          expect(String(input)).toContain("/~/scry/storage/configuration.json");
          return response;
        },
      },
      { path: "/storage/configuration.json", auditContext: "test" },
    );

    expect(result).toEqual({ ok: true });
  });
});
