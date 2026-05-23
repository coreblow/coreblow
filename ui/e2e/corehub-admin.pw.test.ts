import { expect, test } from "@playwright/test";

const GATEWAY_TOKEN = "gateway-token";
const COREHUB_TOKEN = "corehub-token";
const SETTINGS_KEY = "coreblow.control.settings.v1";

test("CoreHub admin surface uses the Gateway proxy for review actions", async ({ page }) => {
  const seen: Array<{ url: string; method: string; headers: Record<string, string> }> = [];

  await page.route("http://127.0.0.1:18789/api/corehub/v2/**", async (route) => {
    const request = route.request();
    seen.push({
      url: request.url(),
      method: request.method(),
      headers: request.headers(),
    });
    const url = new URL(request.url());
    if (url.pathname.endsWith("/admin/status")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          status: "ready",
          readiness: { status: "ready" },
          runtime: { stateStore: { kind: "d1" }, objectStore: { kind: "r2" } },
          queues: {
            submissions: { pending_review: 1 },
            reviews: { open: 1 },
            ownershipTransfers: { requested: 0 },
          },
          analytics: { installs: 7, downloads: 11 },
          audit: { valid: true, count: 42, latestEventId: "evt_42" },
        }),
      });
      return;
    }
    if (url.pathname.endsWith("/admin/support-bundle")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          generatedAt: "2026-05-23T00:00:00.000Z",
          readiness: { status: "ready" },
          audit: { valid: true, latestEventId: "evt_42" },
        }),
      });
      return;
    }
    if (url.pathname.endsWith("/submissions")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              packageId: "plugin-lab",
              version: "0.1.0",
              publisherId: "github:coreblow",
              createdAt: "2026-05-23T00:00:00.000Z",
            },
          ],
        }),
      });
      return;
    }
    if (url.pathname.endsWith("/reviews")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              id: "review-plugin-lab-0-1-0",
              submissionId: "submission-plugin-lab-0-1-0",
              assignee: "github:coreblow-admin",
              createdAt: "2026-05-23T00:00:00.000Z",
            },
          ],
        }),
      });
      return;
    }
    if (url.pathname.endsWith("/reviews/review-plugin-lab-0-1-0")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            moderationReview: {
              id: "review-plugin-lab-0-1-0",
              submissionId: "submission-plugin-lab-0-1-0",
              status: "open",
              assignee: "github:coreblow-admin",
              evidence: [
                {
                  type: "source_scan",
                  summary: "Artifact checksum and publisher claim verified.",
                  actor: "github:coreblow-admin",
                  createdAt: "2026-05-23T00:00:00.000Z",
                },
              ],
            },
            submission: {
              id: "submission-plugin-lab-0-1-0",
              packageId: "plugin-lab",
              version: "0.1.0",
            },
            artifactUpload: { id: "upload-plugin-lab-0-1-0" },
          },
        }),
      });
      return;
    }
    if (url.pathname.endsWith("/reviews/review-plugin-lab-0-1-0/assign")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ok: true, status: "assigned" }),
      });
      return;
    }
    if (url.pathname.endsWith("/reviews/review-plugin-lab-0-1-0/evidence")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ok: true, status: "evidence_added" }),
      });
      return;
    }
    if (url.pathname.endsWith("/reviews/review-plugin-lab-0-1-0/approve")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ok: true, status: "approved" }),
      });
      return;
    }
    await route.fulfill({ status: 404, body: "not found" });
  });

  await page.addInitScript(
    ({ key, gatewayToken, coreHubToken }) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          gatewayUrl: "ws://127.0.0.1:18789",
          token: gatewayToken,
          sessionKey: "",
          theme: "core",
          themeMode: "system",
          splitRatio: 0.5,
          coreHubRegistryUrl: "https://coreblow.com/corehub",
          coreHubActor: "github:coreblow-admin",
          coreHubToken,
        }),
      );
    },
    { key: SETTINGS_KEY, gatewayToken: GATEWAY_TOKEN, coreHubToken: COREHUB_TOKEN },
  );

  await page.goto("/#coreHub");
  const main = page.getByRole("main");
  await expect(main.getByText("CoreHub", { exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "plugin-lab", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "review-plugin-lab-0-1-0", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Details" }).click();
  await expect(page.getByText("Review Detail")).toBeVisible();
  await expect(page.getByText("Artifact checksum and publisher claim verified.")).toBeVisible();

  await page.getByRole("button", { name: "Assign" }).first().click();
  await expect(page.getByText("Assign Review")).toBeVisible();
  await page.getByRole("button", { name: "Assign" }).first().click();
  await expect
    .poll(() => seen.some((entry) => entry.url.endsWith("/reviews/review-plugin-lab-0-1-0/assign")))
    .toBe(true);

  await page.getByRole("button", { name: "Evidence" }).first().click();
  await expect(page.getByText("Add Evidence Review")).toBeVisible();
  await page.getByLabel("Evidence Summary").fill("Manual security note added.");
  await page.getByRole("button", { name: "Add Evidence" }).click();
  await expect
    .poll(() => seen.some((entry) => entry.url.endsWith("/reviews/review-plugin-lab-0-1-0/evidence")))
    .toBe(true);

  await page.getByRole("button", { name: "Approve" }).first().click();
  await expect(page.getByText("Approve Review")).toBeVisible();
  await page.getByRole("button", { name: "Approve" }).first().click();

  await expect
    .poll(() => seen.some((entry) => entry.url.endsWith("/reviews/review-plugin-lab-0-1-0/approve")))
    .toBe(true);

  const action = seen.find((entry) =>
    entry.url.endsWith("/reviews/review-plugin-lab-0-1-0/approve"),
  );
  expect(action?.method).toBe("POST");
  expect(action?.headers.authorization).toBe(`Bearer ${GATEWAY_TOKEN}`);
  expect(action?.headers["x-corehub-token"]).toBe(COREHUB_TOKEN);
  expect(seen.every((entry) => !entry.url.startsWith("https://coreblow.com"))).toBe(true);
});
