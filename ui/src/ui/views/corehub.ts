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

  render() {
    const status = this.status;
    const readiness = status?.readiness?.status ?? status?.status ?? "unknown";
    const stateStore = status?.runtime?.stateStore?.kind ?? "unknown";
    const objectStore = status?.runtime?.objectStore?.kind ?? "unknown";
    const auditStatus = status?.audit?.valid === false ? "invalid" : status?.audit?.valid === true ? "valid" : "unknown";

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

        ${this.error ? html`
          <div class="card" style="border-color: rgba(239,68,68,0.35); background: rgba(239,68,68,0.08);">
            <div style="font-weight: 700;">CoreHub admin API unavailable</div>
            <div style="margin-top: 6px; color: var(--muted); font-size: 12px;">${this.error}</div>
          </div>
        ` : nothing}

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
        ${this.renderTable(
          ["Review", "Submission", "Assigned", "Created"],
          this.reviews,
          (entry) => [
            entry.id ?? "unknown",
            entry.submissionId ?? "unknown",
            entry.assignedTo ?? "unassigned",
            this.formatDate(entry.createdAt),
          ],
        )}
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
