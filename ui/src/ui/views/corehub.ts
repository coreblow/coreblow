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

type PublisherIdentity = {
  actor?: { id?: string; kind?: string };
  defaultPublisher?: PublisherAccount | null;
  memberships?: PublisherMembership[];
  permissions?: { admin?: boolean };
};

type PublisherAccount = {
  handle?: string;
  displayName?: string;
  kind?: string;
  status?: string;
};

type PublisherMembership = {
  publisherHandle?: string;
  role?: string;
  status?: string;
  publisher?: PublisherAccount | null;
  permissions?: string[];
};

type SubmissionEntry = {
  id?: string;
  packageId?: string;
  version?: string;
  status?: string;
  publisherId?: string;
  publisherHandle?: string;
  kind?: string;
  reviewId?: string;
  submittedAt?: string;
  createdAt?: string;
  submission?: SubmissionEntry;
};

type ReviewEntry = {
  id?: string;
  submissionId?: string;
  status?: string;
  assignee?: string;
  assignedTo?: string;
  moderationStatus?: string;
  createdAt?: string;
  evidence?: ReviewEvidenceEntry[];
};

type ReviewEvidenceEntry = {
  id?: string;
  type?: string;
  summary?: string;
  actor?: string | { id?: string };
  createdAt?: string;
};

type ReviewInspection = {
  moderationReview?: ReviewEntry;
  submission?: SubmissionEntry;
  artifactUpload?: { id?: string; checksum?: string; sha256?: string; status?: string };
  packageVersionPreview?: { id?: string; packageId?: string; version?: string };
  packageVersion?: { id?: string; packageId?: string; version?: string; status?: string } | null;
};

type CoreHubReviewAction = "approve" | "block" | "assign" | "evidence";

type PendingReviewAction = {
  reviewId: string;
  action: CoreHubReviewAction;
  reason: string;
  assignee: string;
  evidenceType: string;
  evidenceSummary: string;
};

/* B1: Audit log viewer */
type AuditEvent = {
  sequence?: number;
  action?: string;
  targetType?: string;
  targetId?: string;
  actor?: { id?: string; kind?: string } | string;
  eventHash?: string;
  previousHash?: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
};

type AuditVerifyResult = {
  valid?: boolean;
  count?: number;
  head?: string;
  behavior?: string;
  errors?: string[];
};

/* B2: Install analytics */
type InstallAnalyticsSummary = {
  totalInstalls?: number;
  totalDownloads?: number;
  uniqueClients?: number;
  byPackage?: Record<string, number>;
  byEvent?: Record<string, number>;
};

/* B3: Audit retention */
type AuditRetentionPlan = {
  status?: string;
  policy?: {
    retentionDays?: number;
    integrityFailureBehavior?: string;
  };
  pruneableCount?: number;
  retainedCount?: number;
  totalCount?: number;
  verification?: AuditVerifyResult;
};

type AuditPruneResult = {
  status?: string;
  prunedCount?: number;
  retainedCount?: number;
  dryRun?: boolean;
  exportHash?: string;
};

/* B5: Catalog browser */
type CatalogEntry = {
  id?: string;
  kind?: string;
  name?: string;
  summary?: string;
  source?: string;
  publisher?: { handle?: string; displayName?: string; verified?: boolean };
  versions?: CatalogVersion[];
  tags?: string[];
  score?: number;
};

type CatalogVersion = {
  version?: string;
  tag?: string;
  status?: string;
  publishedAt?: string;
  artifact?: {
    name?: string;
    size?: number;
    sha256?: string;
    downloadEnabled?: boolean;
  };
};

type ListResponse<T> = {
  data?: T[];
  items?: T[];
  submissions?: T[];
  reviews?: T[];
  transfers?: T[];
  meta?: { total?: number; count?: number };
};

type TransferEntry = {
  id?: string;
  packageId?: string;
  fromPublisherHandle?: string;
  toPublisherHandle?: string;
  status?: string;
  requestedAt?: string;
  reason?: string;
};

type ArtifactUploadPlan = {
  id?: string;
  uploadSlotId?: string;
  upload?: {
    method?: string;
    url?: string;
    headers?: Array<{ name?: string; value?: string }>;
  };
  artifactUpload?: { id?: string; status?: string; sha256?: string; size?: number };
};

type PackageSubmissionForm = {
  packageId: string;
  version: string;
  publisherHandle: string;
  kind: string;
  artifactUploadId: string;
  changelog: string;
  source: string;
  artifactName: string;
  artifactSha256: string;
  artifactSize: string;
  artifactMediaType: string;
};

type TransferRequestForm = {
  packageId: string;
  fromPublisherHandle: string;
  toPublisherHandle: string;
  reason: string;
};

@customElement("coreblow-corehub-view")
export class CoreHubView extends LitElement {
  @property({ attribute: false }) app!: CoreBlowApp;
  @state() private loading = false;
  @state() private error = "";
  @state() private status: CoreHubAdminStatus | null = null;
  @state() private publisherIdentity: PublisherIdentity | null = null;
  @state() private supportBundle: SupportBundle | null = null;
  @state() private submissions: SubmissionEntry[] = [];
  @state() private publisherSubmissions: SubmissionEntry[] = [];
  @state() private reviews: ReviewEntry[] = [];
  @state() private transfers: TransferEntry[] = [];
  @state() private selectedReviewId = "";
  @state() private reviewInspection: ReviewInspection | null = null;
  @state() private reviewDetailLoading = false;
  @state() private reviewDetailError = "";
  @state() private pendingReviewAction: PendingReviewAction | null = null;
  @state() private reviewActionLoading = false;
  @state() private reviewActionError = "";
  @state() private reviewActionNotice = "";
  @state() private publisherActionLoading = false;
  @state() private publisherActionError = "";
  @state() private publisherActionNotice = "";
  @state() private selectedArtifactFile: File | null = null;
  @state() private uploadPlan: ArtifactUploadPlan | null = null;
  @state() private packageForm: PackageSubmissionForm = {
    packageId: "plugin-lab",
    version: "0.1.0",
    publisherHandle: "coreblow",
    kind: "plugin",
    artifactUploadId: "",
    changelog: "CoreHub package submission.",
    source: "",
    artifactName: "",
    artifactSha256: "",
    artifactSize: "",
    artifactMediaType: "application/gzip",
  };
  @state() private transferForm: TransferRequestForm = {
    packageId: "plugin-lab",
    fromPublisherHandle: "coreblow",
    toPublisherHandle: "",
    reason: "",
  };
  /* B1: Audit log viewer */
  @state() private auditEvents: AuditEvent[] = [];
  @state() private auditVerify: AuditVerifyResult | null = null;
  @state() private auditLoading = false;
  @state() private auditError = "";
  @state() private auditFilterAction = "";
  @state() private auditFilterActor = "";
  @state() private auditFilterTarget = "";
  /* B2: Install analytics */
  @state() private analytics: InstallAnalyticsSummary | null = null;
  @state() private analyticsLoading = false;
  @state() private analyticsError = "";
  @state() private analyticsFilterPackage = "";
  /* B3: Audit retention */
  @state() private retention: AuditRetentionPlan | null = null;
  @state() private retentionLoading = false;
  @state() private retentionError = "";
  @state() private pruneResult: AuditPruneResult | null = null;
  /* B5: Catalog browser */
  @state() private catalogEntries: CatalogEntry[] = [];
  @state() private catalogLoading = false;
  @state() private catalogError = "";
  @state() private catalogSearchQuery = "";

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

  private updatePackageForm(patch: Partial<PackageSubmissionForm>) {
    this.packageForm = { ...this.packageForm, ...patch };
  }

  private updateTransferForm(patch: Partial<TransferRequestForm>) {
    this.transferForm = { ...this.transferForm, ...patch };
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

  private async putArtifact<T>(
    path: string,
    file: File,
    headers: Record<string, string>,
  ): Promise<T> {
    const response = await fetch(coreHubGatewayProxyUrl(this.app.settings.gatewayUrl, path), {
      method: "PUT",
      headers: {
        ...this.headers(),
        ...headers,
      },
      body: file,
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
      const [status, publisherIdentity, supportBundle, submissions, publisherSubmissions, reviews, transfers] = await Promise.all([
        this.fetchJson<CoreHubAdminStatus>("/admin/status"),
        this.fetchJson<PublisherIdentity | { data?: PublisherIdentity }>("/publishers/me"),
        this.fetchJson<SupportBundle>("/admin/support-bundle?limit=5"),
        this.fetchJson<ListResponse<SubmissionEntry>>("/submissions?status=pending_review&limit=25"),
        this.fetchJson<ListResponse<SubmissionEntry>>("/submissions?limit=25"),
        this.fetchJson<ListResponse<ReviewEntry>>("/reviews?status=open&limit=25"),
        this.fetchJson<ListResponse<TransferEntry>>("/transfers?status=requested&limit=25"),
      ]);
      this.status = this.extractData(status);
      this.publisherIdentity = this.extractData(publisherIdentity);
      this.supportBundle = this.extractData(supportBundle);
      this.submissions = this.extractList(submissions, "submissions");
      this.publisherSubmissions = this.extractList(publisherSubmissions, "submissions");
      this.reviews = this.extractList(reviews, "reviews");
      this.transfers = this.extractList(transfers, "transfers");
      this.applyPublisherDefaults();
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      this.status = null;
      this.publisherIdentity = null;
      this.supportBundle = null;
      this.submissions = [];
      this.publisherSubmissions = [];
      this.reviews = [];
      this.transfers = [];
    } finally {
      this.loading = false;
    }
  }

  private extractList<T>(response: ListResponse<T>, key: "submissions" | "reviews" | "transfers"): T[] {
    return response.data ?? response.items ?? response[key] ?? [];
  }

  private extractData<T>(response: T | { data?: T }): T {
    if (response && typeof response === "object" && "data" in response) {
      return ((response as { data?: T }).data ?? response) as T;
    }
    return response as T;
  }

  private applyPublisherDefaults() {
    const handle = this.publisherIdentity?.defaultPublisher?.handle?.trim();
    if (!handle) return;
    if (!this.packageForm.publisherHandle) {
      this.updatePackageForm({ publisherHandle: handle });
    }
    if (!this.transferForm.fromPublisherHandle) {
      this.updateTransferForm({ fromPublisherHandle: handle });
    }
  }

  private openAdmin() {
    window.open(coreHubAdminUrl(this.registryUrl), "_blank", "noopener,noreferrer");
  }

  /* ── B1: Audit log viewer ── */
  private async loadAuditEvents() {
    this.auditLoading = true;
    this.auditError = "";
    try {
      const params = new URLSearchParams();
      params.set("limit", "50");
      if (this.auditFilterAction) params.set("action", this.auditFilterAction);
      if (this.auditFilterActor) params.set("actor", this.auditFilterActor);
      if (this.auditFilterTarget) params.set("target", this.auditFilterTarget);
      const response = await this.fetchJson<{ data?: AuditEvent[]; items?: AuditEvent[] }>(
        `/audit/events?${params.toString()}`,
      );
      this.auditEvents = response.data ?? response.items ?? [];
    } catch (error) {
      this.auditError = error instanceof Error ? error.message : String(error);
    } finally {
      this.auditLoading = false;
    }
  }

  private async verifyAuditChain() {
    this.auditLoading = true;
    this.auditError = "";
    try {
      const response = await this.fetchJson<{ data?: AuditVerifyResult } | AuditVerifyResult>(
        "/audit/verify",
      );
      this.auditVerify = this.extractData(response) as AuditVerifyResult;
    } catch (error) {
      this.auditError = error instanceof Error ? error.message : String(error);
    } finally {
      this.auditLoading = false;
    }
  }

  /* ── B2: Install analytics ── */
  private async loadInstallAnalytics() {
    this.analyticsLoading = true;
    this.analyticsError = "";
    try {
      const params = new URLSearchParams();
      if (this.analyticsFilterPackage) params.set("packageId", this.analyticsFilterPackage);
      const response = await this.fetchJson<{ data?: InstallAnalyticsSummary } | InstallAnalyticsSummary>(
        `/install-events/summary?${params.toString()}`,
      );
      this.analytics = this.extractData(response) as InstallAnalyticsSummary;
    } catch (error) {
      this.analyticsError = error instanceof Error ? error.message : String(error);
    } finally {
      this.analyticsLoading = false;
    }
  }

  /* ── B3: Audit retention ── */
  private async loadRetention() {
    this.retentionLoading = true;
    this.retentionError = "";
    try {
      const response = await this.fetchJson<{ data?: AuditRetentionPlan } | AuditRetentionPlan>(
        "/audit/retention",
      );
      this.retention = this.extractData(response) as AuditRetentionPlan;
    } catch (error) {
      this.retentionError = error instanceof Error ? error.message : String(error);
    } finally {
      this.retentionLoading = false;
    }
  }

  private async pruneAuditRetention(dryRun: boolean) {
    this.retentionLoading = true;
    this.retentionError = "";
    this.pruneResult = null;
    try {
      const response = await this.postJson<{ data?: AuditPruneResult } | AuditPruneResult>(
        "/audit/retention/prune",
        { dryRun },
      );
      this.pruneResult = this.extractData(response) as AuditPruneResult;
      if (!dryRun) await this.loadRetention();
    } catch (error) {
      this.retentionError = error instanceof Error ? error.message : String(error);
    } finally {
      this.retentionLoading = false;
    }
  }

  /* ── B5: Catalog browser ── */
  private async loadCatalog() {
    this.catalogLoading = true;
    this.catalogError = "";
    try {
      const query = this.catalogSearchQuery.trim();
      // The gateway proxies /api/corehub/v2/* so we route catalog through v2 search or entries
      const path = query
        ? `/catalog/search?q=${encodeURIComponent(query)}&limit=50`
        : "/catalog/entries?limit=50";
      const response = await this.fetchJson<{ data?: CatalogEntry[]; entries?: CatalogEntry[]; items?: CatalogEntry[] }>(
        path,
      );
      this.catalogEntries = response.data ?? response.entries ?? response.items ?? [];
    } catch (error) {
      this.catalogError = error instanceof Error ? error.message : String(error);
    } finally {
      this.catalogLoading = false;
    }
  }

  private async validatePublisherSession() {
    this.publisherActionLoading = true;
    this.publisherActionError = "";
    this.publisherActionNotice = "";
    try {
      const response = await this.fetchJson<PublisherIdentity | { data?: PublisherIdentity }>(
        "/publishers/me",
      );
      this.publisherIdentity = this.extractData(response);
      this.applyPublisherDefaults();
      const actorId = this.publisherIdentity.actor?.id ?? this.actor;
      this.publisherActionNotice = `Publisher session valid for ${actorId}.`;
    } catch (error) {
      this.publisherActionError = this.formatAuthError(error);
    } finally {
      this.publisherActionLoading = false;
    }
  }

  private async handleArtifactFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.selectedArtifactFile = file;
    this.uploadPlan = null;
    if (!file) {
      this.updatePackageForm({ artifactName: "", artifactSha256: "", artifactSize: "" });
      return;
    }
    this.publisherActionLoading = true;
    this.publisherActionError = "";
    try {
      const sha256 = await this.hashFile(file);
      this.updatePackageForm({
        artifactName: file.name,
        artifactSha256: sha256,
        artifactSize: String(file.size),
        artifactMediaType: file.type || "application/gzip",
      });
    } catch (error) {
      this.publisherActionError = error instanceof Error ? error.message : String(error);
    } finally {
      this.publisherActionLoading = false;
    }
  }

  private async requestArtifactUpload() {
    const form = this.packageForm;
    if (!this.requirePublisherToken()) return;
    if (!form.packageId.trim() || !form.version.trim() || !form.publisherHandle.trim()) {
      this.publisherActionError = "Package id, version, and publisher are required.";
      return;
    }
    if (!form.artifactName.trim() || !form.artifactSha256.trim() || !form.artifactSize.trim()) {
      this.publisherActionError = "Select an artifact before requesting an upload slot.";
      return;
    }
    this.publisherActionLoading = true;
    this.publisherActionError = "";
    this.publisherActionNotice = "";
    try {
      const response = await this.postJson<{ data?: { uploadSlot?: ArtifactUploadPlan } }>(
        "/artifacts/uploads",
        {
          packageId: form.packageId.trim(),
          version: form.version.trim(),
          publisherHandle: form.publisherHandle.trim(),
          artifact: {
            name: form.artifactName.trim(),
            mediaType: form.artifactMediaType.trim() || "application/octet-stream",
            size: Number(form.artifactSize),
            sha256: form.artifactSha256.trim(),
          },
          maxBytes: Math.max(Number(form.artifactSize), 1),
        },
      );
      const uploadSlot = response.data?.uploadSlot;
      if (!uploadSlot?.id) {
        throw new Error("CoreHub did not return an upload slot.");
      }
      this.uploadPlan = uploadSlot;
      this.publisherActionNotice = `Upload slot ${uploadSlot.id} reserved.`;
    } catch (error) {
      this.publisherActionError = this.formatAuthError(error);
    } finally {
      this.publisherActionLoading = false;
    }
  }

  private async uploadAndVerifyArtifact() {
    const file = this.selectedArtifactFile;
    const plan = this.uploadPlan;
    const slotId = plan?.id ?? plan?.uploadSlotId;
    if (!this.requirePublisherToken()) return;
    if (!file || !slotId) {
      this.publisherActionError = "Select a file and request an upload slot first.";
      return;
    }
    this.publisherActionLoading = true;
    this.publisherActionError = "";
    this.publisherActionNotice = "";
    try {
      const uploadHeaders: Record<string, string> = {
        "content-type": this.packageForm.artifactMediaType || file.type || "application/octet-stream",
        "x-corehub-artifact-sha256": this.packageForm.artifactSha256,
        "x-corehub-artifact-size": String(file.size),
      };
      await this.putArtifact(`/artifacts/uploads/${encodeURIComponent(slotId)}`, file, uploadHeaders);
      const verified = await this.postJson<{ data?: { artifactUpload?: { id?: string; status?: string } } }>(
        `/artifacts/uploads/${encodeURIComponent(slotId)}/verify`,
        {},
      );
      const artifactUpload = verified.data?.artifactUpload;
      if (!artifactUpload?.id) {
        throw new Error("CoreHub did not return a verified artifact upload.");
      }
      this.updatePackageForm({ artifactUploadId: artifactUpload.id });
      this.publisherActionNotice = `Artifact ${artifactUpload.id} ${artifactUpload.status ?? "verified"}.`;
    } catch (error) {
      this.publisherActionError = this.formatAuthError(error);
    } finally {
      this.publisherActionLoading = false;
    }
  }

  private async submitPackage() {
    const form = this.packageForm;
    if (!this.requirePublisherToken()) return;
    if (!form.packageId.trim() || !form.version.trim() || !form.publisherHandle.trim() || !form.artifactUploadId.trim()) {
      this.publisherActionError = "Package id, version, publisher, and verified artifact upload are required.";
      return;
    }
    this.publisherActionLoading = true;
    this.publisherActionError = "";
    this.publisherActionNotice = "";
    try {
      const response = await this.postJson<{ data?: { submission?: SubmissionEntry } }>("/submissions", {
        packageId: form.packageId.trim(),
        version: form.version.trim(),
        publisherHandle: form.publisherHandle.trim(),
        kind: form.kind.trim() || "plugin",
        artifactUploadId: form.artifactUploadId.trim(),
        changelog: form.changelog.trim() || "CoreHub package submission.",
        source: form.source.trim() || undefined,
      });
      const submission = response.data?.submission;
      this.publisherActionNotice = `Submission ${submission?.id ?? form.packageId} created for review.`;
      await this.loadCoreHub();
    } catch (error) {
      this.publisherActionError = this.formatAuthError(error);
    } finally {
      this.publisherActionLoading = false;
    }
  }

  private async requestOwnershipTransfer() {
    const form = this.transferForm;
    if (!this.requirePublisherToken()) return;
    if (!form.packageId.trim() || !form.fromPublisherHandle.trim() || !form.toPublisherHandle.trim()) {
      this.publisherActionError = "Package, source publisher, and target publisher are required.";
      return;
    }
    this.publisherActionLoading = true;
    this.publisherActionError = "";
    this.publisherActionNotice = "";
    try {
      const response = await this.postJson<{ data?: { transfer?: TransferEntry } }>("/transfers", {
        packageId: form.packageId.trim(),
        fromPublisherHandle: form.fromPublisherHandle.trim(),
        toPublisherHandle: form.toPublisherHandle.trim(),
        reason: form.reason.trim() || undefined,
      });
      this.publisherActionNotice = `Transfer ${response.data?.transfer?.id ?? form.packageId} requested.`;
      await this.loadCoreHub();
    } catch (error) {
      this.publisherActionError = this.formatAuthError(error);
    } finally {
      this.publisherActionLoading = false;
    }
  }

  private async decideTransfer(transfer: TransferEntry, action: "accept" | "reject" | "cancel") {
    const transferId = transfer.id?.trim();
    if (!transferId) {
      this.publisherActionError = "Transfer id is missing.";
      return;
    }
    if (!this.requirePublisherToken()) return;
    this.publisherActionLoading = true;
    this.publisherActionError = "";
    this.publisherActionNotice = "";
    try {
      await this.postJson(`/transfers/${encodeURIComponent(transferId)}/${action}`, {
        notes: `${action} from CoreBlow Publisher Portal`,
      });
      this.publisherActionNotice = `Transfer ${transferId} ${action}ed.`;
      await this.loadCoreHub();
    } catch (error) {
      this.publisherActionError = this.formatAuthError(error);
    } finally {
      this.publisherActionLoading = false;
    }
  }

  private requirePublisherToken(): boolean {
    if (!this.app.settings.token?.trim()) {
      this.publisherActionError = "Gateway token is required before CoreHub publisher actions.";
      return false;
    }
    if (!this.token) {
      this.publisherActionError = "CoreHub publisher token is required before publisher actions.";
      return false;
    }
    return true;
  }

  private async hashFile(file: File): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  private formatAuthError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    if (/401|403|unauthorized|forbidden/i.test(message)) {
      return `${message}. Check the CoreHub token, publisher membership, and role.`;
    }
    return message;
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
      assignee: review.assignee ?? review.assignedTo ?? this.actor,
      evidenceType: "manual_note",
      evidenceSummary: "",
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

  private updateReviewActionAssignee(value: string) {
    if (!this.pendingReviewAction) return;
    this.pendingReviewAction = { ...this.pendingReviewAction, assignee: value };
  }

  private updateReviewActionEvidenceType(value: string) {
    if (!this.pendingReviewAction) return;
    this.pendingReviewAction = { ...this.pendingReviewAction, evidenceType: value };
  }

  private updateReviewActionEvidenceSummary(value: string) {
    if (!this.pendingReviewAction) return;
    this.pendingReviewAction = { ...this.pendingReviewAction, evidenceSummary: value };
  }

  private async loadReviewDetail(review: ReviewEntry) {
    const reviewId = review.id?.trim();
    if (!reviewId) {
      this.reviewDetailError = "Review id is missing.";
      return;
    }
    this.selectedReviewId = reviewId;
    this.reviewInspection = null;
    this.reviewDetailError = "";
    this.reviewDetailLoading = true;
    try {
      const response = await this.fetchJson<ReviewInspection | { data?: ReviewInspection }>(
        `/reviews/${encodeURIComponent(reviewId)}`,
      );
      this.reviewInspection = this.extractData(response);
    } catch (error) {
      this.reviewDetailError = error instanceof Error ? error.message : String(error);
    } finally {
      this.reviewDetailLoading = false;
    }
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
      if (pending.action === "assign") {
        const assignee = pending.assignee.trim();
        if (!assignee) {
          this.reviewActionError = "Assignee is required.";
          return;
        }
        await this.postJson(`/reviews/${encodeURIComponent(pending.reviewId)}/assign`, { assignee });
        this.reviewActionNotice = `Review ${pending.reviewId} assigned to ${assignee}.`;
      } else if (pending.action === "evidence") {
        const summary = pending.evidenceSummary.trim();
        if (!summary) {
          this.reviewActionError = "Evidence summary is required.";
          return;
        }
        await this.postJson(`/reviews/${encodeURIComponent(pending.reviewId)}/evidence`, {
          type: pending.evidenceType.trim() || "manual_note",
          summary,
        });
        this.reviewActionNotice = `Review evidence added to ${pending.reviewId}.`;
      } else {
        await this.postJson(`/reviews/${encodeURIComponent(pending.reviewId)}/${pending.action}`, {
          reason: pending.reason.trim() || undefined,
        });
        this.reviewActionNotice = `Review ${pending.reviewId} ${pending.action === "approve" ? "approved" : "blocked"}.`;
      }
      this.pendingReviewAction = null;
      await this.loadCoreHub();
      const selectedReview = this.reviews.find((review) => review.id === this.selectedReviewId);
      if (selectedReview) {
        await this.loadReviewDetail(selectedReview);
      }
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

        ${this.renderPublisherSession()}

        ${this.error ? html`
          <div class="card" style="border-color: rgba(239,68,68,0.35); background: rgba(239,68,68,0.08);">
            <div style="font-weight: 700;">CoreHub admin API unavailable</div>
            <div style="margin-top: 6px; color: var(--muted); font-size: 12px;">${this.error}</div>
            <div style="margin-top: 6px; color: var(--muted); font-size: 12px;">Check the Gateway token, CoreHub admin token, and registry URL above.</div>
          </div>
        ` : nothing}

        ${this.publisherActionNotice ? html`
          <div class="card" style="border-color: rgba(34,197,94,0.3); background: rgba(34,197,94,0.08);">
            <div style="font-weight: 700;">${this.publisherActionNotice}</div>
          </div>
        ` : nothing}

        ${this.publisherActionError ? html`
          <div class="card" style="border-color: rgba(239,68,68,0.35); background: rgba(239,68,68,0.08);">
            <div style="font-weight: 700;">CoreHub publisher action failed</div>
            <div style="margin-top: 6px; color: var(--muted); font-size: 12px;">${this.publisherActionError}</div>
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

        ${this.renderPublisherPortal()}
        ${this.renderReviewDetail()}

        ${this.renderAuditLogViewer()}
        ${this.renderInstallAnalytics()}
        ${this.renderAuditRetention()}
        ${this.renderCatalogBrowser()}

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

  private renderPublisherSession() {
    const identity = this.publisherIdentity;
    const memberships = identity?.memberships ?? [];
    const defaultPublisher = identity?.defaultPublisher?.handle ?? "none";
    return html`
      <div class="card">
        <div style="display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 240px;">
            <div class="card-title">Publisher Session</div>
            <div class="card-sub">Publisher identity, role status, and write permissions for CoreHub package workflows.</div>
          </div>
          <button
            style="background: var(--bg-elevated); border: 1px solid var(--border); padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; color: var(--foreground); font-size: 12px;"
            ?disabled=${this.publisherActionLoading}
            @click=${() => this.validatePublisherSession()}>
            Check Session
          </button>
        </div>
        <div style="margin-top: 12px; display: grid; gap: 8px;">
          ${this.renderKeyValue("Actor", identity?.actor?.id ?? this.actor)}
          ${this.renderKeyValue("Default publisher", defaultPublisher)}
          ${this.renderKeyValue("Admin role", identity?.permissions?.admin ? "yes" : "no")}
        </div>
        ${memberships.length === 0 ? html`
          <div style="margin-top: 12px; color: var(--muted); font-size: 12px;">No active publisher memberships returned for this token.</div>
        ` : html`
          <div style="margin-top: 12px; overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <thead>
                <tr>
                  ${["Publisher", "Role", "Status", "Permissions"].map((header) => html`
                    <th style="text-align: left; color: var(--muted); font-weight: 700; padding: 8px; border-bottom: 1px solid var(--border);">${header}</th>
                  `)}
                </tr>
              </thead>
              <tbody>
                ${memberships.map((entry) => html`
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.04);">${entry.publisherHandle ?? entry.publisher?.handle ?? "unknown"}</td>
                    <td style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.04);">${entry.role ?? "unknown"}</td>
                    <td style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.04);">${entry.status ?? entry.publisher?.status ?? "unknown"}</td>
                    <td style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.04);">${(entry.permissions ?? []).join(", ") || "none"}</td>
                  </tr>
                `)}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;
  }

  private renderPublisherPortal() {
    const tokenMissing = !this.token || !this.app.settings.token?.trim();
    return html`
      <div class="card">
        <div class="card-title">Publisher Portal</div>
        <div class="card-sub">Package submission, artifact upload, status tracking, and ownership transfer requests.</div>
        ${tokenMissing ? html`
          <div style="margin-top: 12px; color: var(--muted); font-size: 12px;">Configure both Gateway and CoreHub tokens before publisher write actions.</div>
        ` : nothing}
        <div style="margin-top: 14px; display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));">
          ${this.renderPackageSubmissionForm(tokenMissing)}
          ${this.renderOwnershipTransferForm(tokenMissing)}
        </div>
        <div style="margin-top: 16px; display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));">
          ${this.renderPublisherPackages()}
          ${this.renderTransferRequests()}
        </div>
      </div>
    `;
  }

  private renderPackageSubmissionForm(disabled: boolean) {
    const form = this.packageForm;
    return html`
      <div style="border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px; background: rgba(255,255,255,0.02);">
        <div style="font-size: 12px; font-weight: 700;">Package Submission</div>
        <div style="margin-top: 10px; display: grid; gap: 10px;">
          ${this.renderField("Package ID", form.packageId, (value) => this.updatePackageForm({ packageId: value }))}
          ${this.renderField("Version", form.version, (value) => this.updatePackageForm({ version: value }))}
          ${this.renderField("Publisher", form.publisherHandle, (value) => this.updatePackageForm({ publisherHandle: value }))}
          ${this.renderField("Kind", form.kind, (value) => this.updatePackageForm({ kind: value }))}
          ${this.renderField("Source URL", form.source, (value) => this.updatePackageForm({ source: value }))}
          <label style="display: grid; gap: 6px;">
            <span style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em;">Artifact</span>
            <input
              type="file"
              ?disabled=${disabled || this.publisherActionLoading}
              style="background: var(--bg-elevated); border: 1px solid var(--border); padding: 8px 10px; border-radius: var(--radius-sm); color: var(--foreground); font-size: 12px;"
              @change=${(event: Event) => this.handleArtifactFile(event)}
            />
          </label>
          ${this.renderKeyValue("Artifact SHA-256", form.artifactSha256 || "not selected")}
          ${this.renderField("Verified Artifact Upload", form.artifactUploadId, (value) => this.updatePackageForm({ artifactUploadId: value }))}
          <label style="display: grid; gap: 6px;">
            <span style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em;">Changelog</span>
            <textarea
              style="min-height: 72px; background: var(--bg-elevated); border: 1px solid var(--border); padding: 8px 10px; border-radius: var(--radius-sm); color: var(--foreground); font-family: var(--mono); font-size: 12px;"
              .value=${form.changelog}
              @input=${(event: Event) => this.updatePackageForm({ changelog: (event.target as HTMLTextAreaElement).value })}
            ></textarea>
          </label>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button
              style="background: var(--bg-elevated); border: 1px solid var(--border); padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; color: var(--foreground); font-size: 12px;"
              ?disabled=${disabled || this.publisherActionLoading}
              @click=${() => this.requestArtifactUpload()}>
              Request Upload
            </button>
            <button
              style="background: var(--bg-elevated); border: 1px solid var(--border); padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; color: var(--foreground); font-size: 12px;"
              ?disabled=${disabled || this.publisherActionLoading}
              @click=${() => this.uploadAndVerifyArtifact()}>
              Upload Artifact
            </button>
            <button
              style="background: var(--accent); border: 1px solid var(--accent); padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; color: var(--primary-foreground); font-size: 12px; font-weight: 700;"
              ?disabled=${disabled || this.publisherActionLoading}
              @click=${() => this.submitPackage()}>
              Submit Package
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private renderOwnershipTransferForm(disabled: boolean) {
    const form = this.transferForm;
    return html`
      <div style="border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px; background: rgba(255,255,255,0.02);">
        <div style="font-size: 12px; font-weight: 700;">Ownership Transfer</div>
        <div style="margin-top: 10px; display: grid; gap: 10px;">
          ${this.renderField("Package ID", form.packageId, (value) => this.updateTransferForm({ packageId: value }))}
          ${this.renderField("From Publisher", form.fromPublisherHandle, (value) => this.updateTransferForm({ fromPublisherHandle: value }))}
          ${this.renderField("To Publisher", form.toPublisherHandle, (value) => this.updateTransferForm({ toPublisherHandle: value }))}
          <label style="display: grid; gap: 6px;">
            <span style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em;">Reason</span>
            <textarea
              style="min-height: 72px; background: var(--bg-elevated); border: 1px solid var(--border); padding: 8px 10px; border-radius: var(--radius-sm); color: var(--foreground); font-family: var(--mono); font-size: 12px;"
              .value=${form.reason}
              @input=${(event: Event) => this.updateTransferForm({ reason: (event.target as HTMLTextAreaElement).value })}
            ></textarea>
          </label>
          <button
            style="background: var(--bg-elevated); border: 1px solid var(--border); padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; color: var(--foreground); font-size: 12px; justify-self: start;"
            ?disabled=${disabled || this.publisherActionLoading}
            @click=${() => this.requestOwnershipTransfer()}>
            Request Transfer
          </button>
        </div>
      </div>
    `;
  }

  private renderPublisherPackages() {
    const rows = this.publisherSubmissions.map((entry) => entry.submission ?? entry);
    return html`
      <div>
        <div style="font-size: 12px; font-weight: 700;">Publisher Packages</div>
        ${this.renderTable(
          ["Package", "Version", "Publisher", "Status"],
          rows,
          (entry) => [
            entry.packageId ?? entry.id ?? "unknown",
            entry.version ?? "unknown",
            entry.publisherHandle ?? entry.publisherId ?? "unknown",
            entry.status ?? "unknown",
          ],
        )}
      </div>
    `;
  }

  private renderTransferRequests() {
    if (this.loading) {
      return html`<div style="padding: 24px; color: var(--muted); font-size: 12px;">Loading...</div>`;
    }
    return html`
      <div>
        <div style="font-size: 12px; font-weight: 700;">Ownership Requests</div>
        ${this.transfers.length === 0 ? html`
          <div style="padding: 24px 0; color: var(--muted); font-size: 12px;">No transfer requests found.</div>
        ` : html`
          <div style="margin-top: 12px; overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <thead>
                <tr>
                  ${["Transfer", "Package", "Route", "Status", "Actions"].map((header) => html`
                    <th style="text-align: left; color: var(--muted); font-weight: 700; padding: 8px; border-bottom: 1px solid var(--border);">${header}</th>
                  `)}
                </tr>
              </thead>
              <tbody>
                ${this.transfers.map((entry) => html`
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.04);">${entry.id ?? "unknown"}</td>
                    <td style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.04);">${entry.packageId ?? "unknown"}</td>
                    <td style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.04);">${entry.fromPublisherHandle ?? "unknown"} -> ${entry.toPublisherHandle ?? "unknown"}</td>
                    <td style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.04);">${entry.status ?? "unknown"}</td>
                    <td style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.04);">
                      <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                        ${(["accept", "reject", "cancel"] as const).map((action) => html`
                          <button
                            style="background: var(--bg-elevated); border: 1px solid var(--border); padding: 4px 8px; border-radius: var(--radius-sm); cursor: pointer; color: var(--foreground); font-size: 11px;"
                            ?disabled=${this.publisherActionLoading}
                            @click=${() => this.decideTransfer(entry, action)}>
                            ${action}
                          </button>
                        `)}
                      </div>
                    </td>
                  </tr>
                `)}
              </tbody>
            </table>
          </div>
        `}
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
                <td style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.04); color: var(--foreground);">${entry.assignee ?? entry.assignedTo ?? "unassigned"}</td>
                <td style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.04); color: var(--foreground);">${this.formatDate(entry.createdAt)}</td>
                <td style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.04);">
                  <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                    <button
                      style="background: var(--bg-elevated); border: 1px solid var(--border); padding: 4px 8px; border-radius: var(--radius-sm); cursor: pointer; color: var(--foreground); font-size: 11px;"
                      ?disabled=${this.reviewDetailLoading}
                      @click=${() => this.loadReviewDetail(entry)}>
                      Details
                    </button>
                    <button
                      style="background: rgba(59,130,246,0.12); border: 1px solid rgba(59,130,246,0.35); padding: 4px 8px; border-radius: var(--radius-sm); cursor: pointer; color: var(--foreground); font-size: 11px;"
                      ?disabled=${this.reviewActionLoading}
                      @click=${() => this.requestReviewAction(entry, "assign")}>
                      Assign
                    </button>
                    <button
                      style="background: rgba(245,158,11,0.12); border: 1px solid rgba(245,158,11,0.35); padding: 4px 8px; border-radius: var(--radius-sm); cursor: pointer; color: var(--foreground); font-size: 11px;"
                      ?disabled=${this.reviewActionLoading}
                      @click=${() => this.requestReviewAction(entry, "evidence")}>
                      Evidence
                    </button>
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
    const actionLabel = this.reviewActionLabel(pending.action);
    const actionTone = pending.action === "approve"
      ? "rgba(34,197,94,0.85)"
      : pending.action === "block"
        ? "rgba(239,68,68,0.85)"
        : "rgba(59,130,246,0.85)";
    return html`
      <div class="card" style="border-color: ${pending.action === 'block' ? 'rgba(239,68,68,0.35)' : 'rgba(59,130,246,0.35)'};">
        <div class="card-title">${actionLabel} Review</div>
        <div class="card-sub">Confirm ${pending.action} for ${pending.reviewId}. This will call CoreHub through the CoreBlow Gateway proxy.</div>
        ${pending.action === "assign" ? html`
          <label style="margin-top: 12px; display: grid; gap: 6px;">
            <span style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em;">Assignee</span>
            <input
              style="background: var(--bg-elevated); border: 1px solid var(--border); padding: 8px 10px; border-radius: var(--radius-sm); color: var(--foreground); font-family: var(--mono); font-size: 12px;"
              .value=${pending.assignee}
              @input=${(event: Event) => this.updateReviewActionAssignee((event.target as HTMLInputElement).value)}
            />
          </label>
        ` : pending.action === "evidence" ? html`
          <div style="margin-top: 12px; display: grid; gap: 10px;">
            <label style="display: grid; gap: 6px;">
              <span style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em;">Evidence Type</span>
              <input
                style="background: var(--bg-elevated); border: 1px solid var(--border); padding: 8px 10px; border-radius: var(--radius-sm); color: var(--foreground); font-family: var(--mono); font-size: 12px;"
                .value=${pending.evidenceType}
                @input=${(event: Event) => this.updateReviewActionEvidenceType((event.target as HTMLInputElement).value)}
              />
            </label>
            <label style="display: grid; gap: 6px;">
              <span style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em;">Evidence Summary</span>
              <textarea
                aria-label="Evidence Summary"
                style="min-height: 72px; background: var(--bg-elevated); border: 1px solid var(--border); padding: 8px 10px; border-radius: var(--radius-sm); color: var(--foreground); font-family: var(--mono); font-size: 12px;"
                .value=${pending.evidenceSummary}
                @input=${(event: Event) => this.updateReviewActionEvidenceSummary((event.target as HTMLTextAreaElement).value)}
              ></textarea>
            </label>
          </div>
        ` : html`
          <label style="margin-top: 12px; display: grid; gap: 6px;">
            <span style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em;">Reason</span>
            <textarea
              style="min-height: 72px; background: var(--bg-elevated); border: 1px solid var(--border); padding: 8px 10px; border-radius: var(--radius-sm); color: var(--foreground); font-family: var(--mono); font-size: 12px;"
              .value=${pending.reason}
              @input=${(event: Event) => this.updateReviewActionReason((event.target as HTMLTextAreaElement).value)}
            ></textarea>
          </label>
        `}
        <div style="margin-top: 12px; display: flex; gap: 8px; justify-content: flex-end;">
          <button
            style="background: var(--bg-elevated); border: 1px solid var(--border); padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; color: var(--foreground); font-size: 12px;"
            ?disabled=${this.reviewActionLoading}
            @click=${() => this.cancelReviewAction()}>
            Cancel
          </button>
          <button
            style="background: ${actionTone}; border: 1px solid transparent; padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; color: white; font-size: 12px; font-weight: 700;"
            ?disabled=${this.reviewActionLoading}
            @click=${() => this.confirmReviewAction()}>
            ${this.reviewActionLoading ? "Working..." : actionLabel}
          </button>
        </div>
      </div>
    `;
  }

  private reviewActionLabel(action: CoreHubReviewAction): string {
    if (action === "approve") return "Approve";
    if (action === "block") return "Block";
    if (action === "assign") return "Assign";
    return "Add Evidence";
  }

  private renderReviewDetail() {
    if (!this.selectedReviewId && !this.reviewDetailError) return nothing;
    const inspection = this.reviewInspection;
    const review = inspection?.moderationReview;
    const evidence = review?.evidence ?? [];
    return html`
      <div class="card">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
          <div style="flex: 1;">
            <div class="card-title">Review Detail</div>
            <div class="card-sub">${this.selectedReviewId || "Select a review to inspect evidence and submission context."}</div>
          </div>
        </div>
        ${this.reviewDetailLoading ? html`
          <div style="padding: 24px; color: var(--muted); font-size: 12px;">Loading...</div>
        ` : this.reviewDetailError ? html`
          <div style="color: var(--muted); font-size: 12px;">${this.reviewDetailError}</div>
        ` : html`
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px;">
            ${this.renderKeyValue("Status", review?.status ?? "unknown")}
            ${this.renderKeyValue("Assignee", review?.assignee ?? review?.assignedTo ?? "unassigned")}
            ${this.renderKeyValue("Submission", review?.submissionId ?? inspection?.submission?.id ?? "unknown")}
            ${this.renderKeyValue("Package", inspection?.submission?.packageId ?? inspection?.packageVersionPreview?.packageId ?? "unknown")}
            ${this.renderKeyValue("Version", inspection?.submission?.version ?? inspection?.packageVersionPreview?.version ?? "unknown")}
            ${this.renderKeyValue("Artifact", inspection?.artifactUpload?.id ?? "unknown")}
          </div>
          <div style="margin-top: 14px;">
            <div style="font-size: 12px; font-weight: 700;">Evidence</div>
            ${evidence.length === 0 ? html`
              <div style="padding: 16px 0; color: var(--muted); font-size: 12px;">No evidence recorded.</div>
            ` : html`
              <div style="margin-top: 8px; display: grid; gap: 8px;">
                ${evidence.map((entry) => html`
                  <div style="border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px; background: rgba(255,255,255,0.02);">
                    <div style="display: flex; gap: 8px; flex-wrap: wrap; font-size: 12px;">
                      <span style="font-family: var(--mono);">${entry.type ?? "manual_note"}</span>
                      <span style="color: var(--muted);">${this.formatActor(entry.actor)}</span>
                      <span style="color: var(--muted);">${this.formatDate(entry.createdAt)}</span>
                    </div>
                    <div style="margin-top: 6px; font-size: 12px;">${entry.summary ?? entry.id ?? "No summary"}</div>
                  </div>
                `)}
              </div>
            `}
          </div>
        `}
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

  private formatActor(value?: string | { id?: string }) {
    if (!value) return "unknown";
    if (typeof value === "string") return value;
    return value.id ?? "unknown";
  }

  /* ── B1: Audit Log Viewer ── */
  private renderAuditLogViewer() {
    return html`
      <div class="card">
        <div style="display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 240px;">
            <div class="card-title">Audit Events</div>
            <div class="card-sub">Tamper-evident audit trail for all CoreHub write operations.</div>
          </div>
          <button
            style="background: var(--bg-elevated); border: 1px solid var(--border); padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; color: var(--foreground); font-size: 12px;"
            ?disabled=${this.auditLoading}
            @click=${() => this.verifyAuditChain()}>
            Verify Chain
          </button>
          <button
            style="background: var(--accent); border: 1px solid var(--accent); padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; color: var(--primary-foreground); font-size: 12px; font-weight: 600;"
            ?disabled=${this.auditLoading}
            @click=${() => this.loadAuditEvents()}>
            ${this.auditLoading ? "Loading..." : "Load Events"}
          </button>
        </div>

        ${this.auditVerify ? html`
          <div style="margin-top: 12px; padding: 10px; border-radius: var(--radius-sm); background: ${this.auditVerify.valid ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)'}; border: 1px solid ${this.auditVerify.valid ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}; font-size: 12px;">
            <div style="font-weight: 700;">Chain integrity: ${this.auditVerify.valid ? "✓ valid" : "✗ invalid"}</div>
            <div style="margin-top: 4px; color: var(--muted);">Events: ${this.auditVerify.count ?? 0} · Head: ${(this.auditVerify.head ?? "none").slice(0, 16)}…</div>
            ${(this.auditVerify.errors ?? []).length > 0 ? html`
              <div style="margin-top: 6px; color: rgba(239,68,68,0.9);">${(this.auditVerify.errors ?? []).join(", ")}</div>
            ` : nothing}
          </div>
        ` : nothing}

        <div style="margin-top: 12px; display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px;">
          ${this.renderField("Filter: action", this.auditFilterAction, (v) => { this.auditFilterAction = v; })}
          ${this.renderField("Filter: actor", this.auditFilterActor, (v) => { this.auditFilterActor = v; })}
          ${this.renderField("Filter: target", this.auditFilterTarget, (v) => { this.auditFilterTarget = v; })}
        </div>

        ${this.auditError ? html`
          <div style="margin-top: 12px; color: rgba(239,68,68,0.9); font-size: 12px;">${this.auditError}</div>
        ` : nothing}

        ${this.auditEvents.length > 0 ? html`
          <div style="margin-top: 12px; overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <thead>
                <tr>
                  ${["#", "Action", "Target", "Target ID", "Actor", "Time"].map((h) => html`
                    <th style="text-align: left; color: var(--muted); font-weight: 700; padding: 8px; border-bottom: 1px solid var(--border);">${h}</th>
                  `)}
                </tr>
              </thead>
              <tbody>
                ${this.auditEvents.map((ev) => html`
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.04); font-family: var(--mono);">${ev.sequence ?? ""}</td>
                    <td style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.04);">${ev.action ?? "unknown"}</td>
                    <td style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.04);">${ev.targetType ?? ""}</td>
                    <td style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.04); font-family: var(--mono);">${ev.targetId ?? ""}</td>
                    <td style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.04);">${this.formatActor(ev.actor)}</td>
                    <td style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.04);">${this.formatDate(ev.createdAt)}</td>
                  </tr>
                `)}
              </tbody>
            </table>
          </div>
        ` : this.auditEvents.length === 0 && !this.auditLoading && !this.auditError ? html`
          <div style="margin-top: 12px; padding: 24px 0; color: var(--muted); font-size: 12px;">Press "Load Events" to fetch audit log.</div>
        ` : nothing}
      </div>
    `;
  }

  /* ── B2: Install Analytics ── */
  private renderInstallAnalytics() {
    const data = this.analytics;
    return html`
      <div class="card">
        <div style="display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 240px;">
            <div class="card-title">Install Analytics</div>
            <div class="card-sub">Plugin install and download metrics from CoreHub telemetry.</div>
          </div>
          <button
            style="background: var(--accent); border: 1px solid var(--accent); padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; color: var(--primary-foreground); font-size: 12px; font-weight: 600;"
            ?disabled=${this.analyticsLoading}
            @click=${() => this.loadInstallAnalytics()}>
            ${this.analyticsLoading ? "Loading..." : "Load Analytics"}
          </button>
        </div>

        <div style="margin-top: 12px; display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px;">
          ${this.renderField("Filter: package", this.analyticsFilterPackage, (v) => { this.analyticsFilterPackage = v; })}
        </div>

        ${this.analyticsError ? html`
          <div style="margin-top: 12px; color: rgba(239,68,68,0.9); font-size: 12px;">${this.analyticsError}</div>
        ` : nothing}

        ${data ? html`
          <div style="margin-top: 14px; display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px;">
            ${this.renderMetric("Total Installs", String(data.totalInstalls ?? 0))}
            ${this.renderMetric("Total Downloads", String(data.totalDownloads ?? 0))}
            ${this.renderMetric("Unique Clients", String(data.uniqueClients ?? 0))}
          </div>
          ${data.byPackage && Object.keys(data.byPackage).length > 0 ? html`
            <div style="margin-top: 14px;">
              <div style="font-size: 12px; font-weight: 700; margin-bottom: 8px;">By Package</div>
              <div style="display: grid; gap: 6px;">
                ${Object.entries(data.byPackage).map(([pkg, count]) => html`
                  ${this.renderKeyValue(pkg, String(count))}
                `)}
              </div>
            </div>
          ` : nothing}
          ${data.byEvent && Object.keys(data.byEvent).length > 0 ? html`
            <div style="margin-top: 14px;">
              <div style="font-size: 12px; font-weight: 700; margin-bottom: 8px;">By Event Type</div>
              <div style="display: grid; gap: 6px;">
                ${Object.entries(data.byEvent).map(([evt, count]) => html`
                  ${this.renderKeyValue(evt, String(count))}
                `)}
              </div>
            </div>
          ` : nothing}
        ` : !this.analyticsLoading && !this.analyticsError ? html`
          <div style="margin-top: 12px; padding: 24px 0; color: var(--muted); font-size: 12px;">Press "Load Analytics" to fetch install metrics.</div>
        ` : nothing}
      </div>
    `;
  }

  /* ── B3: Audit Retention ── */
  private renderAuditRetention() {
    const plan = this.retention;
    const prune = this.pruneResult;
    return html`
      <div class="card">
        <div style="display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 240px;">
            <div class="card-title">Audit Retention</div>
            <div class="card-sub">Retention policy, pruneable event counts, and audit cleanup controls.</div>
          </div>
          <button
            style="background: var(--bg-elevated); border: 1px solid var(--border); padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; color: var(--foreground); font-size: 12px;"
            ?disabled=${this.retentionLoading}
            @click=${() => this.pruneAuditRetention(true)}>
            Dry-Run Prune
          </button>
          <button
            style="background: rgba(239,68,68,0.85); border: 1px solid transparent; padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; color: white; font-size: 12px; font-weight: 600;"
            ?disabled=${this.retentionLoading}
            @click=${() => { if (confirm("Permanently prune audit events beyond the retention window?")) this.pruneAuditRetention(false); }}>
            Live Prune
          </button>
          <button
            style="background: var(--accent); border: 1px solid var(--accent); padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; color: var(--primary-foreground); font-size: 12px; font-weight: 600;"
            ?disabled=${this.retentionLoading}
            @click=${() => this.loadRetention()}>
            ${this.retentionLoading ? "Loading..." : "Load Retention"}
          </button>
        </div>

        ${this.retentionError ? html`
          <div style="margin-top: 12px; color: rgba(239,68,68,0.9); font-size: 12px;">${this.retentionError}</div>
        ` : nothing}

        ${plan ? html`
          <div style="margin-top: 12px; display: grid; gap: 8px;">
            ${this.renderKeyValue("Status", plan.status ?? "unknown")}
            ${this.renderKeyValue("Retention days", String(plan.policy?.retentionDays ?? "unlimited"))}
            ${this.renderKeyValue("Integrity behavior", plan.policy?.integrityFailureBehavior ?? "unknown")}
            ${this.renderKeyValue("Pruneable events", String(plan.pruneableCount ?? 0))}
            ${this.renderKeyValue("Retained events", String(plan.retainedCount ?? 0))}
            ${this.renderKeyValue("Total events", String(plan.totalCount ?? 0))}
            ${this.renderKeyValue("Chain valid", plan.verification?.valid === true ? "yes" : plan.verification?.valid === false ? "no" : "unknown")}
          </div>
        ` : !this.retentionLoading && !this.retentionError ? html`
          <div style="margin-top: 12px; padding: 24px 0; color: var(--muted); font-size: 12px;">Press "Load Retention" to inspect the current retention policy.</div>
        ` : nothing}

        ${prune ? html`
          <div style="margin-top: 12px; padding: 10px; border-radius: var(--radius-sm); background: ${prune.dryRun ? 'rgba(59,130,246,0.08)' : 'rgba(34,197,94,0.08)'}; border: 1px solid ${prune.dryRun ? 'rgba(59,130,246,0.25)' : 'rgba(34,197,94,0.25)'}; font-size: 12px;">
            <div style="font-weight: 700;">${prune.dryRun ? "Dry-run result" : "Prune completed"}</div>
            <div style="margin-top: 4px; color: var(--muted);">Pruned: ${prune.prunedCount ?? 0} · Retained: ${prune.retainedCount ?? 0}</div>
          </div>
        ` : nothing}
      </div>
    `;
  }

  /* ── B5: Catalog Browser ── */
  private renderCatalogBrowser() {
    return html`
      <div class="card">
        <div style="display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 240px;">
            <div class="card-title">Catalog</div>
            <div class="card-sub">Browse and search the CoreHub package and skill directory.</div>
          </div>
          <button
            style="background: var(--accent); border: 1px solid var(--accent); padding: 8px 12px; border-radius: var(--radius-sm); cursor: pointer; color: var(--primary-foreground); font-size: 12px; font-weight: 600;"
            ?disabled=${this.catalogLoading}
            @click=${() => this.loadCatalog()}>
            ${this.catalogLoading ? "Searching..." : "Search"}
          </button>
        </div>

        <div style="margin-top: 12px;">
          ${this.renderField("Search", this.catalogSearchQuery, (v) => { this.catalogSearchQuery = v; })}
        </div>

        ${this.catalogError ? html`
          <div style="margin-top: 12px; color: rgba(239,68,68,0.9); font-size: 12px;">${this.catalogError}</div>
        ` : nothing}

        ${this.catalogEntries.length > 0 ? html`
          <div style="margin-top: 14px; display: grid; gap: 10px;">
            ${this.catalogEntries.map((entry) => html`
              <div style="border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px; background: rgba(255,255,255,0.02);">
                <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                  <span style="font-weight: 700; font-size: 13px;">${entry.name ?? entry.id ?? "unknown"}</span>
                  <span style="font-family: var(--mono); font-size: 11px; color: var(--muted);">${entry.id ?? ""}</span>
                  <span style="font-size: 11px; padding: 2px 8px; border-radius: 9999px; background: rgba(99,102,241,0.12); color: rgba(99,102,241,0.9);">${entry.kind ?? "unknown"}</span>
                  ${entry.publisher?.verified ? html`
                    <span style="font-size: 11px; padding: 2px 8px; border-radius: 9999px; background: rgba(34,197,94,0.12); color: rgba(34,197,94,0.9);">✓ verified</span>
                  ` : nothing}
                  ${entry.score != null ? html`
                    <span style="font-size: 11px; color: var(--muted);">score: ${entry.score.toFixed(2)}</span>
                  ` : nothing}
                </div>
                <div style="margin-top: 6px; font-size: 12px; color: var(--muted);">${entry.summary ?? "No summary"}</div>
                <div style="margin-top: 8px; display: flex; gap: 10px; flex-wrap: wrap; font-size: 11px; color: var(--muted);">
                  <span>Publisher: ${entry.publisher?.handle ?? "unknown"}</span>
                  ${(entry.versions ?? []).length > 0 ? html`
                    <span>Latest: ${entry.versions?.[0]?.version ?? "unknown"} (${entry.versions?.[0]?.status ?? "unknown"})</span>
                  ` : nothing}
                  ${(entry.tags ?? []).length > 0 ? html`
                    <span>Tags: ${(entry.tags ?? []).join(", ")}</span>
                  ` : nothing}
                </div>
              </div>
            `)}
          </div>
        ` : this.catalogEntries.length === 0 && !this.catalogLoading && !this.catalogError ? html`
          <div style="margin-top: 12px; padding: 24px 0; color: var(--muted); font-size: 12px;">Enter a search query or press "Search" to browse all entries.</div>
        ` : nothing}
      </div>
    `;
  }
}
