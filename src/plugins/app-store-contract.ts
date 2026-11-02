import child_process from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// ============================================================================
// Pillar 1: DOP Manifest Schema & Pure Validation
// ============================================================================

export const COREHUB_CAPABILITIES = [
  "network",
  "filesystem",
  "shell",
  "credentials",
  "webhook",
] as const;

export type CoreHubCapability = (typeof COREHUB_CAPABILITIES)[number];

export interface CoreHubPublisherInfo {
  readonly name: string;
  readonly url?: string;
  readonly email?: string;
}

export interface CoreHubAppManifest {
  readonly id: string;
  readonly version: string;
  readonly minGatewayVersion: string;
  readonly capabilities: readonly CoreHubCapability[];
  readonly publisher: CoreHubPublisherInfo;
  readonly hotReloadSafe: boolean;
  readonly integrity: string;
  readonly entrypoint?: string;
  readonly description?: string;
}

export type ManifestValidationResult =
  | { readonly valid: true; readonly manifest: CoreHubAppManifest }
  | { readonly valid: false; readonly errors: readonly string[] };

export function isCoreHubCapability(value: unknown): value is CoreHubCapability {
  return typeof value === "string" && (COREHUB_CAPABILITIES as readonly string[]).includes(value);
}

export function validateCoreHubAppManifest(raw: unknown): ManifestValidationResult {
  const errors: string[] = [];

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { valid: false, errors: ["Manifest must be a non-null object"] };
  }

  const obj = raw as Record<string, unknown>;

  // id validation
  if (typeof obj.id !== "string" || !/^[a-z0-9-_]+$/i.test(obj.id.trim())) {
    errors.push("Invalid 'id': must be a non-empty alphanumeric string (with hyphens/underscores)");
  }

  // version validation
  if (typeof obj.version !== "string" || !/^\d+\.\d+\.\d+/.test(obj.version.trim())) {
    errors.push("Invalid 'version': must follow semantic versioning (e.g. 1.0.0)");
  }

  // minGatewayVersion validation
  if (typeof obj.minGatewayVersion !== "string" || obj.minGatewayVersion.trim().length === 0) {
    errors.push("Missing 'minGatewayVersion': must be a valid version range string");
  }

  // capabilities validation
  if (!Array.isArray(obj.capabilities)) {
    errors.push("Invalid 'capabilities': must be an array of CoreHub capabilities");
  } else {
    for (const cap of obj.capabilities) {
      if (!isCoreHubCapability(cap)) {
        errors.push(`Unknown capability '${String(cap)}'; supported: ${COREHUB_CAPABILITIES.join(", ")}`);
      }
    }
  }

  // publisher validation
  if (!obj.publisher || typeof obj.publisher !== "object" || Array.isArray(obj.publisher)) {
    errors.push("Missing 'publisher': must be an object containing publisher details");
  } else {
    const pub = obj.publisher as Record<string, unknown>;
    if (typeof pub.name !== "string" || pub.name.trim().length === 0) {
      errors.push("Missing 'publisher.name'");
    }
  }

  // hotReloadSafe validation
  if (typeof obj.hotReloadSafe !== "boolean") {
    errors.push("Missing or invalid 'hotReloadSafe': must be a boolean");
  }

  // integrity validation (SHA-256)
  if (typeof obj.integrity !== "string" || obj.integrity.trim().length === 0) {
    errors.push("Missing 'integrity': must be a valid SHA-256 digest string");
  } else {
    const cleanDigest = obj.integrity.replace(/^sha256-/, "");
    if (!/^[a-f0-9]{64}$/i.test(cleanDigest) && !/^[A-Za-z0-9+/=]{43,44}$/.test(cleanDigest)) {
      errors.push("Invalid 'integrity': must be a valid hex or base64 SHA-256 digest");
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const manifest: CoreHubAppManifest = {
    id: (obj.id as string).trim(),
    version: (obj.version as string).trim(),
    minGatewayVersion: (obj.minGatewayVersion as string).trim(),
    capabilities: Object.freeze([...(obj.capabilities as CoreHubCapability[])]),
    publisher: Object.freeze({
      name: ((obj.publisher as Record<string, unknown>).name as string).trim(),
      ...(typeof (obj.publisher as Record<string, unknown>).url === "string"
        ? { url: ((obj.publisher as Record<string, unknown>).url as string).trim() }
        : {}),
      ...(typeof (obj.publisher as Record<string, unknown>).email === "string"
        ? { email: ((obj.publisher as Record<string, unknown>).email as string).trim() }
        : {}),
    }),
    hotReloadSafe: obj.hotReloadSafe as boolean,
    integrity: (obj.integrity as string).trim(),
    ...(typeof obj.entrypoint === "string" ? { entrypoint: obj.entrypoint.trim() } : {}),
    ...(typeof obj.description === "string" ? { description: obj.description.trim() } : {}),
  };

  return { valid: true, manifest: Object.freeze(manifest) };
}

// ============================================================================
// Pillar 2: OOP Atomic Staging Installer
// ============================================================================

export interface AtomicStageManagerOptions {
  baseDir?: string;
}

export class AtomicPluginStageManager {
  private readonly baseDir: string;
  private readonly tmpDir: string;
  private readonly extensionsDir: string;

  constructor(options: AtomicStageManagerOptions = {}) {
    this.baseDir = options.baseDir ?? path.join(os.homedir(), ".coreblow");
    this.tmpDir = path.join(this.baseDir, "tmp");
    this.extensionsDir = path.join(this.baseDir, "extensions");
  }

  public stageArchive(
    pluginId: string,
    archiveBuffer: Buffer | Uint8Array,
    manifest: CoreHubAppManifest,
  ): { stageDir: string; verifiedSha256: string } {
    // 1. Verify SHA-256 integrity
    const computedHex = crypto.createHash("sha256").update(archiveBuffer).digest("hex");
    const computedBase64 = crypto.createHash("sha256").update(archiveBuffer).digest("base64");
    if (typeof manifest.integrity !== "string" || manifest.integrity.trim().length === 0) {
      throw new Error(`Integrity check failed for '${pluginId}': missing integrity in manifest`);
    }
    const expected = manifest.integrity.replace(/^sha256-/, "").trim();

    const matches =
      computedHex.toLowerCase() === expected.toLowerCase() ||
      computedBase64 === expected;

    if (!matches) {
      throw new Error(
        `Integrity check failed for '${pluginId}': expected '${expected}', computed '${computedHex}'`,
      );
    }

    // 2. Stage into ~/.coreblow/tmp/<uuid>
    const stageId = crypto.randomUUID();
    const stageDir = path.join(this.tmpDir, stageId);
    fs.mkdirSync(stageDir, { recursive: true });

    // Write manifest and bundle
    fs.writeFileSync(
      path.join(stageDir, "corehub.artifact.json"),
      JSON.stringify(manifest, null, 2),
      "utf8",
    );
    const packageTarPath = path.join(stageDir, "package.tar");
    fs.writeFileSync(packageTarPath, archiveBuffer);

    // Extract archive contents if valid tarball
    try {
      child_process.execFileSync("tar", ["-xf", packageTarPath, "-C", stageDir], {
        stdio: "ignore",
      });
    } catch {
      // Non-tar or simulated test buffer; proceed with package.tar
    }

    return { stageDir, verifiedSha256: computedHex };
  }

  public commitStagedPlugin(stageDir: string, pluginId: string): string {
    const targetDir = path.join(this.extensionsDir, pluginId);

    fs.mkdirSync(this.extensionsDir, { recursive: true });

    // Atomic swap: if target exists, replace cleanly
    if (fs.existsSync(targetDir)) {
      const backupDir = path.join(this.tmpDir, `swap-old-${crypto.randomUUID()}`);
      fs.renameSync(targetDir, backupDir);
      try {
        fs.renameSync(stageDir, targetDir);
        fs.rmSync(backupDir, { recursive: true, force: true });
      } catch (err) {
        fs.renameSync(backupDir, targetDir);
        throw err;
      }
    } else {
      fs.renameSync(stageDir, targetDir);
    }

    return targetDir;
  }
}

// ============================================================================
// Pillar 3: Capability Consent Ledger
// ============================================================================

export interface PluginConsentRecord {
  readonly pluginId: string;
  readonly approvedCapabilities: readonly CoreHubCapability[];
  readonly approvedAt: string;
  readonly operator: string;
}

export interface CapabilityConsentLedgerOptions {
  ledgerPath?: string;
  baseDir?: string;
}

export class CapabilityConsentLedger {
  private readonly ledgerPath: string;

  constructor(options: CapabilityConsentLedgerOptions = {}) {
    if (options.ledgerPath) {
      this.ledgerPath = options.ledgerPath;
    } else {
      const base = options.baseDir ?? path.join(os.homedir(), ".coreblow");
      this.ledgerPath = path.join(base, "plugins", "consent-ledger.json");
    }
  }

  private readRecords(): Record<string, PluginConsentRecord> {
    try {
      if (!fs.existsSync(this.ledgerPath)) {
        return {};
      }
      const raw = fs.readFileSync(this.ledgerPath, "utf8");
      return JSON.parse(raw) as Record<string, PluginConsentRecord>;
    } catch {
      return {};
    }
  }

  private writeRecords(records: Record<string, PluginConsentRecord>): void {
    const dir = path.dirname(this.ledgerPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.ledgerPath, JSON.stringify(records, null, 2), "utf8");
  }

  public getConsent(pluginId: string): PluginConsentRecord | null {
    const records = this.readRecords();
    return records[pluginId] ?? null;
  }

  public grantConsent(
    pluginId: string,
    capabilities: readonly CoreHubCapability[],
    operator = "operator",
  ): PluginConsentRecord {
    const records = this.readRecords();
    const record: PluginConsentRecord = {
      pluginId,
      approvedCapabilities: Object.freeze([...capabilities]),
      approvedAt: new Date().toISOString(),
      operator,
    };
    records[pluginId] = record;
    this.writeRecords(records);
    return record;
  }

  public revokeConsent(pluginId: string): void {
    const records = this.readRecords();
    delete records[pluginId];
    this.writeRecords(records);
  }

  public checkConsent(manifest: CoreHubAppManifest): {
    readonly allowed: boolean;
    readonly missingCapabilities: readonly CoreHubCapability[];
  } {
    if (manifest.capabilities.length === 0) {
      return { allowed: true, missingCapabilities: [] };
    }

    const consent = this.getConsent(manifest.id);
    if (!consent) {
      return { allowed: false, missingCapabilities: manifest.capabilities };
    }

    const approved = new Set(consent.approvedCapabilities);
    const missing = manifest.capabilities.filter((cap) => !approved.has(cap));

    return {
      allowed: missing.length === 0,
      missingCapabilities: Object.freeze(missing),
    };
  }
}

// ============================================================================
// Pillar 4: OOP 6-State Lifecycle & Rollback
// ============================================================================

export type PluginLifecycleState =
  | "uninstalled"
  | "installed_disabled"
  | "active"
  | "degraded"
  | "updating"
  | "rolled_back";

export interface LifecycleManagerOptions {
  baseDir?: string;
}

export class PluginLifecycleManager {
  private readonly baseDir: string;
  private readonly extensionsDir: string;
  private readonly backupsDir: string;
  private readonly states = new Map<string, PluginLifecycleState>();

  constructor(options: LifecycleManagerOptions = {}) {
    this.baseDir = options.baseDir ?? path.join(os.homedir(), ".coreblow");
    this.extensionsDir = path.join(this.baseDir, "extensions");
    this.backupsDir = path.join(this.baseDir, "backups");
  }

  public getState(pluginId: string): PluginLifecycleState {
    return this.states.get(pluginId) ?? "uninstalled";
  }

  public transitionTo(pluginId: string, newState: PluginLifecycleState): void {
    this.states.set(pluginId, newState);
  }

  public snapshotBeforeUpdate(pluginId: string, currentVersion: string): string {
    const srcDir = path.join(this.extensionsDir, pluginId);
    if (!fs.existsSync(srcDir)) {
      throw new Error(`Cannot snapshot plugin '${pluginId}': source directory does not exist`);
    }

    const snapshotDir = path.join(this.backupsDir, `${pluginId}@${currentVersion}`);
    fs.mkdirSync(snapshotDir, { recursive: true });
    fs.cpSync(srcDir, snapshotDir, { recursive: true });

    return snapshotDir;
  }

  public rollbackPlugin(pluginId: string, targetVersion?: string): boolean {
    const targetDir = path.join(this.extensionsDir, pluginId);
    let snapshotDir: string | undefined;

    if (targetVersion) {
      snapshotDir = path.join(this.backupsDir, `${pluginId}@${targetVersion}`);
    } else {
      if (!fs.existsSync(this.backupsDir)) {
        return false;
      }
      const matching = fs
        .readdirSync(this.backupsDir)
        .filter((dir) => dir.startsWith(`${pluginId}@`))
        .sort()
        .reverse();

      if (matching.length > 0) {
        snapshotDir = path.join(this.backupsDir, matching[0]);
      }
    }

    if (!snapshotDir || !fs.existsSync(snapshotDir)) {
      return false;
    }

    fs.mkdirSync(this.extensionsDir, { recursive: true });
    fs.rmSync(targetDir, { recursive: true, force: true });
    fs.cpSync(snapshotDir, targetDir, { recursive: true });

    this.transitionTo(pluginId, "rolled_back");
    return true;
  }

  public getInstalledPluginIds(): string[] {
    const ids: string[] = [];
    for (const [id, state] of this.states) {
      if (state !== "uninstalled") {
        ids.push(id);
      }
    }
    return ids.sort();
  }

  public getActivatedPluginIds(): string[] {
    const ids: string[] = [];
    for (const [id, state] of this.states) {
      if (state === "active") {
        ids.push(id);
      }
    }
    return ids.sort();
  }

  public getLoadedPluginIds(): string[] {
    const ids: string[] = [];
    for (const [id, state] of this.states) {
      if (state === "active") {
        ids.push(id);
      }
    }
    return ids.sort();
  }
}

// ============================================================================
// Pillar 5 & 6: Fault Domain Isolation & Pragmatic Activation Gate
// ============================================================================

export type ActivationMode = "hot_reload" | "staged_restart_required";

export interface SafeActivationResult {
  readonly success: boolean;
  readonly state: PluginLifecycleState;
  readonly activationMode: ActivationMode;
  readonly error?: string;
}

export interface SafeActivatePluginOptions {
  manifest: CoreHubAppManifest;
  activateFn?: () => Promise<void> | void;
  lifecycle?: PluginLifecycleManager;
  onDegraded?: (err: Error) => void;
  forceImmediate?: boolean;
}

export async function safeActivatePlugin(
  options: SafeActivatePluginOptions,
): Promise<SafeActivationResult> {
  const { manifest, activateFn, lifecycle, onDegraded } = options;

  // Pillar 6: Pragmatic activation gate check
  if (!manifest.hotReloadSafe && !options.forceImmediate) {
    if (lifecycle) {
      lifecycle.transitionTo(manifest.id, "installed_disabled");
    }
    return {
      success: true,
      state: "installed_disabled",
      activationMode: "staged_restart_required",
    };
  }

  // Pillar 5: Fault domain isolation wrapper
  try {
    if (activateFn) {
      await activateFn();
    }
    if (lifecycle) {
      lifecycle.transitionTo(manifest.id, "active");
    }
    return {
      success: true,
      state: "active",
      activationMode: "hot_reload",
    };
  } catch (rawError) {
    const error = rawError instanceof Error ? rawError : new Error(String(rawError));
    if (lifecycle) {
      lifecycle.transitionTo(manifest.id, "degraded");
    }
    if (onDegraded) {
      onDegraded(error);
    }
    return {
      success: false,
      state: "degraded",
      activationMode: "hot_reload",
      error: error.message,
    };
  }
}

// Re-export unified coordinator
export {
  CoreHubAppStoreRuntime,
  type AppStatusReport,
  type CoreHubAppStoreRuntimeOptions,
  type InstallAppFromBufferParams,
} from "./app-store-runtime.js";
