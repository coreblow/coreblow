import { LitElement, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { CoreBlowApp } from "../app.ts";

export const DEFAULT_COREHUB_REGISTRY_URL = "https://coreblow.com/corehub";

export function normalizeCoreHubRegistryUrl(value?: string): string {
  const trimmed = value?.trim();
  if (!trimmed) return DEFAULT_COREHUB_REGISTRY_URL;
  try {
    const url = new URL(trimmed);
    return url.toString().replace(/\/$/, "");
  } catch {
    return DEFAULT_COREHUB_REGISTRY_URL;
  }
}

export function coreHubApiUrl(registryUrl: string, path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizeCoreHubRegistryUrl(registryUrl)}/api/v2${cleanPath}`;
}

export function coreHubAdminUrl(registryUrl: string): string {
  return `${normalizeCoreHubRegistryUrl(registryUrl)}/admin`;
}

export function coreHubDirectoryUrl(registryUrl: string): string {
  return normalizeCoreHubRegistryUrl(registryUrl);
}

export function coreBlowGatewayHttpBaseUrl(gatewayUrl?: string): string {
  const fallback = globalThis.location?.origin ?? "http://127.0.0.1:18789";
  const trimmed = gatewayUrl?.trim();
  if (!trimmed) return fallback;
  try {
    const url = new URL(trimmed);
    if (url.protocol === "ws:") url.protocol = "http:";
    if (url.protocol === "wss:") url.protocol = "https:";
    url.pathname = "";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return fallback;
  }
}

export function coreHubGatewayProxyUrl(gatewayUrl: string | undefined, path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${coreBlowGatewayHttpBaseUrl(gatewayUrl)}/api/corehub/v2${cleanPath}`;
}

type CountMap = Record<string, number | undefined>;

type CoreHubAdminStatus = {
  status?: string;
  runtime?: {
    stateStore?: { kind?: string; path?: string; table?: string };
    objectStore?: { kind?: string; bucket?: string; root?: string };
    publicBaseUrl?: string;
  };
  readiness?: {
    status?: string;
    checks?: Array<{ id?: string; status?: string; detail?: string }>;
  };
  queues?: {
    submissions?: CountMap;
    reviews?: CountMap;
    ownershipTransfers?: CountMap;
  };
  analytics?: {
    installs?: number;
    downloads?: number;
    uniqueClients?: number;
  };
  audit?: {
    count?: number;
    valid?: boolean;
    behavior?: string;
    latestEventId?: string;
  };
};

type SupportBundle = {
  generatedAt?: string;
  summary?: Record<string, unknown>;
  readiness?: CoreHubAdminStatus["readiness"];
  audit?: CoreHubAdminStatus["audit"];
};

type SubmissionEntry = {
  id?: string;
  packageId?: string;
  version?: string;
  status?: string;
  publisherId?: string;
  createdAt?: string;
};

type ReviewEntry = {
  id?: string;
  submissionId?: string;
  status?: string;
  assignedTo?: string;
  moderationStatus?: string;
  createdAt?: string;
};

type CoreHubReviewAction = "approve" | "block";

type PendingReviewAction = {
  reviewId: string;
  action: CoreHubReviewAction;
  reason: string;
};

type ListResponse<T> = {
  data?: T[];
  items?: T[];
  submissions?: T[];
  reviews?: T[];
  meta?: { total?: number; count?: number };
};

@customElement("coreblow-corehub-view")
export class CoreHubView extends LitElement {
  @property({ attribute: false }) app!: CoreBlowApp;
  @state() private loading = false;
  @state() private error = "";
  @state() private status: CoreHubAdminStatus | null = null;
  @state() private supportBundle: SupportBundle | null = null;
  @state() private submissions: SubmissionEntry[] = [];
  @state() private reviews: ReviewEntry[] = [];
  @state() private pendingReviewAction: PendingReviewAction | null = null;
  @state() private reviewActionLoading = false;
  @state() private reviewActionError = "";
  @state() private reviewActionNotice = "";

  createRenderRoot() { return this; }

  connectedCallback() {
    super.connectedCallback();
    void this.loadCoreHub();
  }

  private get registryUrl(): string {
    return normalizeCoreHubRegistryUrl(this.app.settings.coreHubRegistryUrl);
  }

  private get actor(): string {
    return this.app.settings.coreHubActor?.trim() || "github:coreblow-admin";
  }

  private get token(): string {
    return this.app.settings.coreHubToken?.trim() || "";
  }

  private updateRegistryUrl(value: string) {
    this.app.applySettings({ ...this.app.settings, coreHubRegistryUrl: value });
  }

  private updateActor(value: string) {
    this.app.applySettings({ ...this.app.settings, coreHubActor: value });
  }

  private updateToken(value: string) {
    this.app.applySettings({ ...this.app.settings, coreHubToken: value });
  }

  private headers(): HeadersInit {
    const headers: Record<string, string> = {
      accept: "application/json",
      "x-corehub-user": this.actor,
      "x-corehub-registry-url": this.registryUrl,
    };
    const gatewayToken = this.app.settings.token?.trim();
    if (gatewayToken) {
      headers.authorization = `Bearer ${gatewayToken}`;
    }
    if (this.token) {
      headers["x-corehub-token"] = this.token;
    }
    return headers;
  }

  private async fetchJson<T>(path: string): Promise<T> {
    const response = await fetch(coreHubGatewayProxyUrl(this.app.settings.gatewayUrl, path), {
      headers: this.headers(),
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<T>;
  }

  private async postJson<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(coreHubGatewayProxyUrl(this.app.settings.gatewayUrl, path), {
      method: "POST",
      headers: {
        ...this.headers(),
        "content-type": "application/json",
      },
      body: JSON.stringify(body ?? {}),
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<T>;
  }

  private async loadCoreHub() {
    this.loading = true;
    this.error = "";
    try {
      const [status, supportBundle, submissions, reviews] = await Promise.all([
        this.fetchJson<CoreHubAdminStatus>("/admin/status"),
        this.fetchJson<SupportBundle>("/admin/support-bundle?limit=5"),
        this.fetchJson<ListResponse<SubmissionEntry>>("/submissions?status=pending_review&limit=25"),
        this.fetchJson<ListResponse<ReviewEntry>>("/reviews?status=open&limit=25"),
      ]);
      this.status = status;
      this.supportBundle = supportBundle;
      this.submissions = this.extractList(submissions, "submissions");
      this.reviews = this.extractList(reviews, "reviews");
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      this.status = null;
      this.supportBundle = null;
      this.submissions = [];
      this.reviews = [];
    } finally {
      this.loading = false;
    }
  }

  private extractList<T>(response: ListResponse<T>, key: "submissions" | "reviews"): T[] {
    return response.data ?? response.items ?? response[key] ?? [];
  }

  private openAdmin() {
    window.open(coreHubAdminUrl(this.registryUrl), "_blank", "noopener,noreferrer");
  }

  private requestReviewAction(review: ReviewEntry, action: CoreHubReviewAction) {
    const reviewId = review.id?.trim();
    if (!reviewId) {
      this.reviewActionError = "Review id is missing.";
      return;
    }
    this.reviewActionError = "";
    this.reviewActionNotice = "";
    this.pendingReviewAction = {
      reviewId,
      action,
      reason: "",
    };
  }

  private cancelReviewAction() {
    this.pendingReviewAction = null;
    this.reviewActionError = "";
  }

  private updateReviewActionReason(value: string) {
    if (!this.pendingReviewAction) return;
    this.pendingReviewAction = { ...this.pendingReviewAction, reason: value };
  }

  private async confirmReviewAction() {
    const pending = this.pendingReviewAction;
    if (!pending) return;
    if (!this.app.settings.token?.trim()) {
      this.reviewActionError = "Gateway token is required before CoreHub admin actions.";
      return;
    }
    if (!this.token) {
      this.reviewActionError = "CoreHub admin token is required before review actions.";
      return;
    }

    this.reviewActionLoading = true;
    this.reviewActionError = "";
    this.reviewActionNotice = "";
    try {
      await this.postJson(`/reviews/${encodeURIComponent(pending.reviewId)}/${pending.action}`, {
        reason: pending.reason.trim() || undefined,
      });
      this.reviewActionNotice = `Review ${pending.reviewId} ${pending.action === "approve" ? "approved" : "blocked"}.`;
      this.pendingReviewAction = null;
      await this.loadCoreHub();
    } catch (error) {
      this.reviewActionError = error instanceof Error ? error.message : String(error);
    } finally {
      this.reviewActionLoading = false;
    }
  }

  render() {
    const status = this.status;
    const readiness = status?.readiness?.status ?? status?.status ?? "unknown";
    const stateStore = status?.runtime?.stateStore?.kind ?? "unknown";
    const objectStore = status?.runtime?.objectStore?.kind ?? "unknown";
    const auditStatus = status?.audit?.valid === false ? "invalid" : status?.audit?.valid === true ? "valid" : "unknown";
    const gatewayTokenConfigured = Boolean(this.app.settings.token?.trim());
    const coreHubTokenConfigured = Boolean(this.token);

    return html`
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div class="card">
          <div style="display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 260px;">
              <div class="card-title">CoreHub</div>
              <div class="card-sub">Marketplace, plugin trust, moderation, and operator status inside CoreBlow.</div>
            </div>
            <a href=${coreHubDirectoryUrl(this.registryUrl)} target="_blank" rel="noopener noreferrer"
               style="background: var(--bg-elevated); border: 1px solid var(--border); padding: 8px 12px; border-radius: var(--radius-sm); color: var(--foreground); font-size: 12px; text-decoration: none;">
              Directory
            </a>
            <button style="background: var(--bg-elevated); border: 1px solid var(--border); padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; color: var(--foreground); font-size: 12px;"
              @click=${() => this.openAdmin()}>
              Open Admin
            </button>
            <button style="background: var(--accent); border: 1px solid var(--accent); padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; color: var(--primary-foreground); font-size: 12px; font-weight: 600;"
              ?disabled=${this.loading}
              @click=${() => this.loadCoreHub()}>
              ${this.loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div style="margin-top: 14px; display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px;">
            ${this.renderField("Registry URL", this.app.settings.coreHubRegistryUrl ?? DEFAULT_COREHUB_REGISTRY_URL, (value) => this.updateRegistryUrl(value))}
            ${this.renderField("Admin Actor", this.actor, (value) => this.updateActor(value))}
            ${this.renderField("Admin Token", this.token, (value) => this.updateToken(value), true)}
          </div>
        </div>

        <div class="card" style="border-color: ${gatewayTokenConfigured && coreHubTokenConfigured ? 'rgba(34,197,94,0.25)' : 'rgba(245,158,11,0.35)'};">
          <div class="card-title">Admin Session</div>
          <div class="card-sub">CoreHub admin requests go through the local CoreBlow Gateway proxy.</div>
          <div style="margin-top: 12px; display: grid; gap: 8px;">
            ${this.renderKeyValue("Gateway token", gatewayTokenConfigured ? "configured" : "missing")}
            ${this.renderKeyValue("CoreHub token", coreHubTokenConfigured ? "configured" : "missing")}
            ${this.renderKeyValue("Gateway proxy", coreHubGatewayProxyUrl(this.app.settings.gatewayUrl, "/admin/status"))}
          </div>
        </div>

        ${this.error ? html`
          <div class="card" style="border-color: rgba(239,68,68,0.35); background: rgba(239,68,68,0.08);">
            <div style="font-weight: 700;">CoreHub admin API unavailable</div>
            <div style="margin-top: 6px; color: var(--muted); font-size: 12px;">${this.error}</div>
            <div style="margin-top: 6px; color: var(--muted); font-size: 12px;">Check the Gateway token, CoreHub admin token, and registry URL above.</div>
          </div>
        ` : nothing}

        ${this.reviewActionNotice ? html`
          <div class="card" style="border-color: rgba(34,197,94,0.3); background: rgba(34,197,94,0.08);">
            <div style="font-weight: 700;">${this.reviewActionNotice}</div>
          </div>
        ` : nothing}

        ${this.reviewActionError ? html`
          <div class="card" style="border-color: rgba(239,68,68,0.35); background: rgba(239,68,68,0.08);">
            <div style="font-weight: 700;">CoreHub review action failed</div>
            <div style="margin-top: 6px; color: var(--muted); font-size: 12px;">${this.reviewActionError}</div>
          </div>
        ` : nothing}

        ${this.renderReviewActionConfirmation()}

        <div style="display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
          ${this.renderMetric("Readiness", readiness)}
          ${this.renderMetric("State Store", stateStore)}
          ${this.renderMetric("Object Store", objectStore)}
          ${this.renderMetric("Audit Chain", auditStatus)}
        </div>

        <div style="display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));">
          ${this.renderStatusCard(status)}
          ${this.renderSupportBundle(this.supportBundle)}
        </div>

        <div style="display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));">
          ${this.renderSubmissions()}
          ${this.renderReviews()}
        </div>

        <div class="card">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            <div style="flex: 1;">
              <div class="card-title">Embedded Admin</div>
              <div class="card-sub">The CoreHub admin portal is framed here so operators stay inside CoreBlow.</div>
            </div>
          </div>
          <iframe
            title="CoreHub Admin"
            src=${coreHubAdminUrl(this.registryUrl)}
            sandbox="allow-forms allow-popups allow-same-origin allow-scripts"
            style="width: 100%; height: 520px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg-elevated);">
          </iframe>
        </div>
      </div>
    `;
  }

  private renderField(label: string, value: string, onInput: (value: string) => void, password = false) {
    return html`
      <label style="display: grid; gap: 6px;">
        <span style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em;">${label}</span>
        <input
          type=${password ? "password" : "text"}
          style="background: var(--bg-elevated); border: 1px solid var(--border); padding: 8px 10px; border-radius: var(--radius-sm); color: var(--foreground); font-family: var(--mono); font-size: 12px;"
          .value=${value}
          @input=${(event: Event) => onInput((event.target as HTMLInputElement).value)}
        />
      </label>
    `;
  }

  private renderMetric(label: string, value: string) {
    return html`
      <div class="card" style="padding: 16px;">
        <div style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em;">${label}</div>
        <div style="font-size: 18px; font-weight: 700; margin-top: 6px;">${value}</div>
      </div>
    `;
  }

  private renderStatusCard(status: CoreHubAdminStatus | null) {
    const queues = status?.queues;
    return html`
      <div class="card">
        <div class="card-title">Admin Status</div>
        <div style="margin-top: 12px; display: grid; gap: 8px;">
          ${this.renderKeyValue("Pending submissions", String(queues?.submissions?.pending_review ?? 0))}
          ${this.renderKeyValue("Open reviews", String(queues?.reviews?.open ?? 0))}
          ${this.renderKeyValue("Transfer requests", String(queues?.ownershipTransfers?.requested ?? 0))}
          ${this.renderKeyValue("Install events", String(status?.analytics?.installs ?? 0))}
          ${this.renderKeyValue("Download events", String(status?.analytics?.downloads ?? 0))}
          ${this.renderKeyValue("Audit events", String(status?.audit?.count ?? 0))}
        </div>
      </div>
    `;
  }

  private renderSupportBundle(bundle: SupportBundle | null) {
    return html`
      <div class="card">
        <div class="card-title">Support Bundle Summary</div>
        <div style="margin-top: 12px; display: grid; gap: 8px;">
          ${this.renderKeyValue("Generated", bundle?.generatedAt ? new Date(bundle.generatedAt).toLocaleString() : "unknown")}
          ${this.renderKeyValue("Readiness", bundle?.readiness?.status ?? "unknown")}
          ${this.renderKeyValue("Audit", bundle?.audit?.valid === false ? "invalid" : bundle?.audit?.valid === true ? "valid" : "unknown")}
          ${this.renderKeyValue("Latest audit event", bundle?.audit?.latestEventId ?? "none")}
        </div>
      </div>
    `;
  }

  private renderSubmissions() {
    return html`
      <div class="card">
        <div class="card-title">Pending Submissions</div>
        ${this.renderTable(
          ["Package", "Version", "Publisher", "Created"],
          this.submissions,
          (entry) => [
            entry.packageId ?? entry.id ?? "unknown",
            entry.version ?? "unknown",
            entry.publisherId ?? "unknown",
            this.formatDate(entry.createdAt),
          ],
        )}
      </div>
    `;
  }

  private renderReviews() {
    return html`
      <div class="card">
        <div class="card-title">Open Reviews</div>
        ${this.renderReviewsTable()}
      </div>
    `;
  }

  private renderReviewsTable() {
    if (this.loading) {
      return html`<div style="padding: 24px; color: var(--muted); font-size: 12px;">Loading...</div>`;
    }
    if (this.reviews.length === 0) {
      return html`<div style="padding: 24px; color: var(--muted); font-size: 12px;">No items found.</div>`;
    }
    return html`
      <div style="margin-top: 12px; overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr>
              ${["Review", "Submission", "Assigned", "Created", "Actions"].map((header) => html`
                <th style="text-align: left; color: var(--muted); font-weight: 700; padding: 8px; border-bottom: 1px solid var(--border);">${header}</th>
              `)}
            </tr>
          </thead>
          <tbody>
            ${this.reviews.map((entry) => html`
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.04); color: var(--foreground);">${entry.id ?? "unknown"}</td>
                <td style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.04); color: var(--foreground);">${entry.submissionId ?? "unknown"}</td>
                <td style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.04); color: var(--foreground);">${entry.assignedTo ?? "unassigned"}</td>
                <td style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.04); color: var(--foreground);">${this.formatDate(entry.createdAt)}</td>
                <td style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.04);">
                  <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                    <button
                      style="background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.35); padding: 4px 8px; border-radius: var(--radius-sm); cursor: pointer; color: var(--foreground); font-size: 11px;"
                      ?disabled=${this.reviewActionLoading}
                      @click=${() => this.requestReviewAction(entry, "approve")}>
                      Approve
                    </button>
                    <button
                      style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.35); padding: 4px 8px; border-radius: var(--radius-sm); cursor: pointer; color: var(--foreground); font-size: 11px;"
                      ?disabled=${this.reviewActionLoading}
                      @click=${() => this.requestReviewAction(entry, "block")}>
                      Block
                    </button>
                  </div>
                </td>
              </tr>
            `)}
          </tbody>
        </table>
      </div>
    `;
  }

  private renderReviewActionConfirmation() {
    const pending = this.pendingReviewAction;
    if (!pending) return nothing;
    const actionLabel = pending.action === "approve" ? "Approve" : "Block";
    return html`
      <div class="card" style="border-color: ${pending.action === 'approve' ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'};">
        <div class="card-title">${actionLabel} Review</div>
        <div class="card-sub">Confirm ${pending.action} for ${pending.reviewId}. This will call CoreHub through the CoreBlow Gateway proxy.</div>
        <label style="margin-top: 12px; display: grid; gap: 6px;">
          <span style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em;">Reason</span>
          <textarea
            style="min-height: 72px; background: var(--bg-elevated); border: 1px solid var(--border); padding: 8px 10px; border-radius: var(--radius-sm); color: var(--foreground); font-family: var(--mono); font-size: 12px;"
            .value=${pending.reason}
            @input=${(event: Event) => this.updateReviewActionReason((event.target as HTMLTextAreaElement).value)}
          ></textarea>
        </label>
        <div style="margin-top: 12px; display: flex; gap: 8px; justify-content: flex-end;">
          <button
            style="background: var(--bg-elevated); border: 1px solid var(--border); padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; color: var(--foreground); font-size: 12px;"
            ?disabled=${this.reviewActionLoading}
            @click=${() => this.cancelReviewAction()}>
            Cancel
          </button>
          <button
            style="background: ${pending.action === 'approve' ? 'rgba(34,197,94,0.85)' : 'rgba(239,68,68,0.85)'}; border: 1px solid transparent; padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; color: white; font-size: 12px; font-weight: 700;"
            ?disabled=${this.reviewActionLoading}
            @click=${() => this.confirmReviewAction()}>
            ${this.reviewActionLoading ? "Working..." : actionLabel}
          </button>
        </div>
      </div>
    `;
  }

  private renderTable<T>(headers: string[], rows: T[], mapRow: (row: T) => string[]) {
    if (this.loading) {
      return html`<div style="padding: 24px; color: var(--muted); font-size: 12px;">Loading...</div>`;
    }
    if (rows.length === 0) {
      return html`<div style="padding: 24px; color: var(--muted); font-size: 12px;">No items found.</div>`;
    }
    return html`
      <div style="margin-top: 12px; overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr>
              ${headers.map((header) => html`
                <th style="text-align: left; color: var(--muted); font-weight: 700; padding: 8px; border-bottom: 1px solid var(--border);">${header}</th>
              `)}
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => html`
              <tr>
                ${mapRow(row).map((value) => html`
                  <td style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.04); color: var(--foreground);">${value}</td>
                `)}
              </tr>
            `)}
          </tbody>
        </table>
      </div>
    `;
  }

  private renderKeyValue(label: string, value: string) {
    return html`
      <div style="display: flex; gap: 12px; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.04); padding-bottom: 8px;">
        <span style="color: var(--muted); font-size: 12px;">${label}</span>
        <span style="font-family: var(--mono); font-size: 12px;">${value}</span>
      </div>
    `;
  }

  private formatDate(value?: string) {
    if (!value) return "unknown";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  }
}
