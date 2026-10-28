import { createHmac, randomBytes } from "node:crypto";
import type { GatewayService, ServiceHealth } from "../gateway/service-registry.js";

/**
 * CoreBlow Cryptographic Trust Zones (OWASP ASI01 / Architecture PRD 5.1).
 * Monotonically increasing privilege hierarchy:
 *  - Zone 0: PUBLIC_INGRESS (Untrusted channel ingress, public webhooks)
 *  - Zone 1: AUTHENTICATED_WORKSPACE (Paired / allowlisted workspace users)
 *  - Zone 2: OPERATOR_HOST (Local host operator, unix socket, admin control plane)
 */
export enum TrustZoneLevel {
  PUBLIC_INGRESS = 0,
  AUTHENTICATED_WORKSPACE = 1,
  OPERATOR_HOST = 2,
}

export interface TrustZoneTokenPayload {
  zone: TrustZoneLevel;
  contextId: string;
  issuedAt: number;
  expiresAt: number;
  metadata?: Record<string, unknown>;
}

export class TrustZoneViolationError extends Error {
  constructor(
    public readonly callerZone: TrustZoneLevel,
    public readonly requiredZone: TrustZoneLevel,
    public readonly resourceOrOp: string,
    detail?: string,
  ) {
    const callerName = TrustZoneLevel[callerZone];
    const requiredName = TrustZoneLevel[requiredZone];
    super(
      `[OWASP ASI01] Trust Zone Violation: ${callerName} (Zone ${callerZone}) denied access to ${resourceOrOp} requiring ${requiredName} (Zone ${requiredZone}).${detail ? ` ${detail}` : ""}`,
    );
    this.name = "TrustZoneViolationError";
  }
}

export interface TrustZoneEnforcerOptions {
  secretKey?: string;
  defaultTtlMs?: number;
}

export class TrustZoneEnforcer implements GatewayService {
  public readonly name = "trust-zone-enforcer";
  private readonly secretKey: string;
  private readonly defaultTtlMs: number;
  private isRunning = false;

  private readonly toolRequiredZones = new Map<string, TrustZoneLevel>([
    ["bash", TrustZoneLevel.OPERATOR_HOST],
    ["exec", TrustZoneLevel.OPERATOR_HOST],
    ["shell", TrustZoneLevel.OPERATOR_HOST],
    ["restart_gateway", TrustZoneLevel.OPERATOR_HOST],
    ["manage_plugin", TrustZoneLevel.OPERATOR_HOST],
    ["system_config", TrustZoneLevel.OPERATOR_HOST],
    ["read_file", TrustZoneLevel.AUTHENTICATED_WORKSPACE],
    ["write_file", TrustZoneLevel.AUTHENTICATED_WORKSPACE],
    ["edit_file", TrustZoneLevel.AUTHENTICATED_WORKSPACE],
    ["memory_search", TrustZoneLevel.AUTHENTICATED_WORKSPACE],
    ["ask_user", TrustZoneLevel.PUBLIC_INGRESS],
    ["send_message", TrustZoneLevel.PUBLIC_INGRESS],
  ]);

  constructor(options: TrustZoneEnforcerOptions = {}) {
    this.secretKey = options.secretKey ?? randomBytes(32).toString("hex");
    this.defaultTtlMs = options.defaultTtlMs ?? 3_600_000; // 1 hour default
  }

  public async start(): Promise<void> {
    this.isRunning = true;
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
  }

  public health(): ServiceHealth {
    if (!this.isRunning) {
      return { status: "down", detail: "Trust Zone Enforcer service is stopped." };
    }
    return {
      status: "healthy",
      detail: `Operating normally with HMAC-SHA256 token verification and ${this.toolRequiredZones.size} tool policies.`,
    };
  }

  public generateContextToken(
    zone: TrustZoneLevel,
    contextId: string,
    metadata?: Record<string, unknown>,
    ttlMs?: number,
  ): string {
    const now = Date.now();
    const payload: TrustZoneTokenPayload = {
      zone,
      contextId,
      issuedAt: now,
      expiresAt: now + (ttlMs ?? this.defaultTtlMs),
      metadata,
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = createHmac("sha256", this.secretKey)
      .update(encodedPayload)
      .digest("base64url");
    return `${encodedPayload}.${signature}`;
  }

  public verifyContextToken(token: string): TrustZoneTokenPayload {
    const parts = token.split(".");
    if (parts.length !== 2) {
      throw new Error("Invalid trust zone token format.");
    }
    const [encodedPayload, providedSignature] = parts;
    const expectedSignature = createHmac("sha256", this.secretKey)
      .update(encodedPayload)
      .digest("base64url");

    if (providedSignature !== expectedSignature) {
      throw new Error("Trust zone token cryptographic signature mismatch.");
    }

    const payloadJson = Buffer.from(encodedPayload, "base64url").toString("utf8");
    const payload = JSON.parse(payloadJson) as TrustZoneTokenPayload;

    if (Date.now() > payload.expiresAt) {
      throw new Error(`Trust zone token expired at ${new Date(payload.expiresAt).toISOString()}.`);
    }

    return payload;
  }

  public authorizeOperation(
    callerZone: TrustZoneLevel,
    requiredZone: TrustZoneLevel,
    operationName: string,
  ): void {
    if (callerZone < requiredZone) {
      throw new TrustZoneViolationError(callerZone, requiredZone, `operation '${operationName}'`);
    }
  }

  public authorizeMemoryRead(
    readerZone: TrustZoneLevel,
    targetZone: TrustZoneLevel,
    resourceKey: string,
  ): void {
    if (readerZone < targetZone) {
      throw new TrustZoneViolationError(
        readerZone,
        targetZone,
        `memory resource '${resourceKey}'`,
        "Cross-channel prompt injection or unauthorized context leakage blocked.",
      );
    }
  }

  public registerToolZoneRequirement(toolName: string, requiredZone: TrustZoneLevel): void {
    this.toolRequiredZones.set(toolName, requiredZone);
  }

  public authorizeToolExecution(
    callerZone: TrustZoneLevel,
    toolName: string,
  ): void {
    const requiredZone = this.toolRequiredZones.get(toolName) ?? TrustZoneLevel.AUTHENTICATED_WORKSPACE;
    if (callerZone < requiredZone) {
      throw new TrustZoneViolationError(
        callerZone,
        requiredZone,
        `tool execution '${toolName}'`,
        `Tool requires privilege level ${TrustZoneLevel[requiredZone]}.`,
      );
    }
  }

  public getToolRequiredZone(toolName: string): TrustZoneLevel {
    return this.toolRequiredZones.get(toolName) ?? TrustZoneLevel.AUTHENTICATED_WORKSPACE;
  }
}
