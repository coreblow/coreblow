import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CoreBlowApp } from "../src/ui/app.ts";
import "../src/ui/views/corehub.ts";

const GATEWAY_TOKEN = "gateway-token";
const COREHUB_TOKEN = "corehub-token";

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function createMockApp(): CoreBlowApp {
  return {
    settings: {
      gatewayUrl: "ws://127.0.0.1:18789",
      token: GATEWAY_TOKEN,
      sessionKey: "",
      theme: "core",
      themeMode: "system",
      splitRatio: 0.5,
      coreHubRegistryUrl: "https://coreblow.com/corehub",
      coreHubActor: "github:coreblow-admin",
      coreHubToken: COREHUB_TOKEN,
    },
    applySettings(next: CoreBlowApp["settings"]) {
      this.settings = next;
    },
  } as CoreBlowApp;
}

async function waitFor(predicate: () => boolean): Promise<void> {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > 2_000) {
      throw new Error("Timed out waiting for CoreHub view smoke condition");
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function clickButton(label: string, position: "first" | "last" = "first"): void {
  const buttons = Array.from(document.querySelectorAll("button"));
  const matches = buttons.filter((candidate) => candidate.textContent?.trim() === label);
  const button = position === "last" ? matches.at(-1) : matches[0];
  if (!button) {
    throw new Error(`Missing button: ${label}`);
  }
  button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

describe("CoreHub view authenticated Gateway proxy smoke", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("loads CoreHub admin data through the CoreBlow Gateway proxy", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/corehub/v2/admin/status")) {
        return jsonResponse({
          status: "ready",
          readiness: { status: "ready" },
          runtime: {
            stateStore: { kind: "d1" },
            objectStore: { kind: "r2" },
          },
          queues: {
            submissions: { pending_review: 1 },
            reviews: { open: 1 },
            ownershipTransfers: { requested: 0 },
          },
          analytics: { installs: 7, downloads: 11 },
          audit: { valid: true, count: 42, latestEventId: "evt_42" },
        });
      }
      if (url.endsWith("/api/corehub/v2/admin/support-bundle?limit=5")) {
        return jsonResponse({
          generatedAt: "2026-05-23T00:00:00.000Z",
          readiness: { status: "ready" },
          audit: { valid: true, latestEventId: "evt_42" },
        });
      }
      if (url.endsWith("/api/corehub/v2/submissions?status=pending_review&limit=25")) {
        return jsonResponse({
          data: [
            {
              packageId: "plugin-lab",
              version: "0.1.0",
              publisherId: "github:coreblow",
              createdAt: "2026-05-23T00:00:00.000Z",
            },
          ],
        });
      }
      if (url.endsWith("/api/corehub/v2/reviews?status=open&limit=25")) {
        return jsonResponse({
          data: [
            {
              id: "review-plugin-lab-0-1-0",
              submissionId: "submission-plugin-lab-0-1-0",
              assignedTo: "github:coreblow-admin",
              createdAt: "2026-05-23T00:00:00.000Z",
            },
          ],
        });
      }
      if (url.endsWith("/api/corehub/v2/reviews/review-plugin-lab-0-1-0/approve")) {
        return jsonResponse({ ok: true, status: "approved" });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const view = document.createElement("coreblow-corehub-view") as HTMLElement & {
      app: CoreBlowApp;
      updateComplete: Promise<boolean>;
    };
    view.app = createMockApp();
    document.body.append(view);

    await waitFor(() => fetchMock.mock.calls.length === 4);
    await view.updateComplete;
    await waitFor(() => (document.body.textContent ?? "").includes("plugin-lab"));
    await view.updateComplete;

    const urls = fetchMock.mock.calls.map(([input]) => String(input));
    expect(urls).toEqual([
      "http://127.0.0.1:18789/api/corehub/v2/admin/status",
      "http://127.0.0.1:18789/api/corehub/v2/admin/support-bundle?limit=5",
      "http://127.0.0.1:18789/api/corehub/v2/submissions?status=pending_review&limit=25",
      "http://127.0.0.1:18789/api/corehub/v2/reviews?status=open&limit=25",
    ]);
    expect(urls.every((url) => !url.startsWith("https://coreblow.com"))).toBe(true);

    const [, init] = fetchMock.mock.calls[0]!;
    expect(init?.headers).toMatchObject({
      authorization: `Bearer ${GATEWAY_TOKEN}`,
      "x-corehub-token": COREHUB_TOKEN,
      "x-corehub-registry-url": "https://coreblow.com/corehub",
      "x-corehub-user": "github:coreblow-admin",
    });

    const text = document.body.textContent ?? "";
    expect(text).toContain("Readiness");
    expect(text).toContain("ready");
    expect(text).toContain("State Store");
    expect(text).toContain("d1");
    expect(text).toContain("Object Store");
    expect(text).toContain("r2");
    expect(text).toContain("Pending Submissions");
    expect(text).toContain("plugin-lab");
    expect(text).toContain("Open Reviews");
    expect(text).toContain("review-plugin-lab-0-1-0");

    clickButton("Approve");
    await view.updateComplete;
    await waitFor(() => (document.body.textContent ?? "").includes("Approve Review"));
    clickButton("Approve");
    await waitFor(() =>
      fetchMock.mock.calls.some(([input]) =>
        String(input).endsWith("/api/corehub/v2/reviews/review-plugin-lab-0-1-0/approve"),
      ),
    );

    const actionCall = fetchMock.mock.calls.find(([input]) =>
      String(input).endsWith("/api/corehub/v2/reviews/review-plugin-lab-0-1-0/approve"),
    );
    expect(actionCall?.[1]).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({
        authorization: `Bearer ${GATEWAY_TOKEN}`,
        "x-corehub-token": COREHUB_TOKEN,
        "content-type": "application/json",
      }),
      body: JSON.stringify({ reason: undefined }),
    });
  });

  it("shows a clean error state when Gateway/CoreHub authentication fails", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(
        { error: { type: "unauthorized", message: "Unauthorized" } },
        { status: 401, statusText: "Unauthorized" },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const view = document.createElement("coreblow-corehub-view") as HTMLElement & {
      app: CoreBlowApp;
      updateComplete: Promise<boolean>;
    };
    view.app = createMockApp();
    document.body.append(view);

    await waitFor(() => (document.body.textContent ?? "").includes("CoreHub admin API unavailable"));
    await view.updateComplete;

    expect(document.body.textContent).toContain("401 Unauthorized");
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init?.headers).toMatchObject({
      authorization: `Bearer ${GATEWAY_TOKEN}`,
      "x-corehub-token": COREHUB_TOKEN,
    });
  });
});
