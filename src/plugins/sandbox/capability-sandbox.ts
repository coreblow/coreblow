import * as path from "node:path";
import type { GatewayService, ServiceHealth } from "../../gateway/service-registry.js";
import { resolveBoundaryPathSync } from "../../infra/boundary-path.js";

export type PluginCapability =
  | "filesystem:read"
  | "filesystem:write"
  | "network:egress"
  | "env:read"
  | "process:exec";

export interface PluginCapabilityManifest {
  pluginId: string;
  capabilities: PluginCapability[];
  allowedRoots?: string[];
  allowedDomains?: string[];
  allowedEnvVars?: string[];
}

export class PluginCapabilityViolationError extends Error {
  constructor(
    public readonly pluginId: string,
    public readonly requiredCapability: PluginCapability,
    public readonly resource: string,
    detail?: string,
  ) {
    super(
      `[OWASP ASI04] Plugin Capability Violation: plugin '${pluginId}' denied access to ${resource}. Required capability '${requiredCapability}' not granted.${
        detail ? ` ${detail}` : ""
      }`,
    );
    this.name = "PluginCapabilityViolationError";
  }
}

export class PluginCapabilitySandbox implements GatewayService {
  public readonly name = "plugin-capability-sandbox";
  private isRunning = false;
  private readonly manifests = new Map<string, PluginCapabilityManifest>();

  private static readonly BLOCKED_SENSITIVE_ENV_PREFIXES = [
    "COREBLOW_GATEWAY_",
    "COREBLOW_AUTH_",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GEMINI_API_KEY",
    "AWS_SECRET_",
    "PRIVATE_KEY",
  ];

  public async start(): Promise<void> {
    this.isRunning = true;
  }

  public async stop(): Promise<void> {
    this.manifests.clear();
    this.isRunning = false;
  }

  public health(): ServiceHealth {
    if (!this.isRunning) {
      return { status: "down", detail: "Plugin Capability Sandbox is stopped." };
    }
    return {
      status: "healthy",
      detail: `Sandbox active with ${this.manifests.size} sandboxed plugin manifests.`,
    };
  }

  public registerPlugin(manifest: PluginCapabilityManifest): void {
    this.manifests.set(manifest.pluginId, {
      ...manifest,
      allowedRoots: (manifest.allowedRoots ?? []).map((r) => path.resolve(r)),
      allowedDomains: (manifest.allowedDomains ?? []).map((d) => d.toLowerCase().trim()),
      allowedEnvVars: (manifest.allowedEnvVars ?? []).map((e) => e.trim()),
    });
  }

  public unregisterPlugin(pluginId: string): boolean {
    return this.manifests.delete(pluginId);
  }

  public getPluginManifest(pluginId: string): PluginCapabilityManifest | undefined {
    return this.manifests.get(pluginId);
  }

  public validateFilesystemAccess(
    pluginId: string,
    requestedPath: string,
    mode: "read" | "write",
  ): string {
    const manifest = this.getManifestOrThrow(pluginId);
    const requiredCapability: PluginCapability =
      mode === "read" ? "filesystem:read" : "filesystem:write";

    if (!manifest.capabilities.includes(requiredCapability)) {
      throw new PluginCapabilityViolationError(
        pluginId,
        requiredCapability,
        `filesystem ${mode} on '${requestedPath}'`,
      );
    }

    const absoluteTarget = path.resolve(requestedPath);
    const roots = manifest.allowedRoots ?? [];

    if (roots.length === 0) {
      throw new PluginCapabilityViolationError(
        pluginId,
        requiredCapability,
        `filesystem ${mode} on '${requestedPath}'`,
        "No allowedRoots designated in plugin manifest.",
      );
    }

    let isInsideAnyRoot = false;
    for (const root of roots) {
      try {
        resolveBoundaryPathSync({
          absolutePath: absoluteTarget,
          rootPath: root,
          boundaryLabel: `plugin '${pluginId}' sandbox root`,
          intent: mode === "read" ? "read" : "write",
        });
        isInsideAnyRoot = true;
        break;
      } catch {
        // Path does not resolve inside this root, continue to next root
      }
    }

    if (!isInsideAnyRoot) {
      throw new PluginCapabilityViolationError(
        pluginId,
        requiredCapability,
        `path '${requestedPath}'`,
        `Path resolves outside all permitted roots: [${roots.join(", ")}].`,
      );
    }

    return absoluteTarget;
  }

  public validateNetworkEgress(pluginId: string, urlString: string): URL {
    const manifest = this.getManifestOrThrow(pluginId);

    if (!manifest.capabilities.includes("network:egress")) {
      throw new PluginCapabilityViolationError(
        pluginId,
        "network:egress",
        `outbound network request to '${urlString}'`,
      );
    }

    let parsed: URL;
    try {
      parsed = new URL(urlString);
    } catch {
      throw new Error(`Invalid URL format: '${urlString}'.`);
    }

    const hostname = parsed.hostname.toLowerCase();
    const allowed = manifest.allowedDomains ?? [];

    const isDomainAllowed = allowed.some((domainPattern) => {
      if (domainPattern === "*") return true;
      if (domainPattern.startsWith("*.")) {
        const rootDomain = domainPattern.slice(2);
        return hostname === rootDomain || hostname.endsWith(`.${rootDomain}`);
      }
      return hostname === domainPattern;
    });

    if (!isDomainAllowed) {
      throw new PluginCapabilityViolationError(
        pluginId,
        "network:egress",
        `host '${hostname}'`,
        `Host is not in the plugin egress allowlist: [${allowed.join(", ")}].`,
      );
    }

    return parsed;
  }

  public validateEnvAccess(pluginId: string, envVarName: string): void {
    const manifest = this.getManifestOrThrow(pluginId);

    if (!manifest.capabilities.includes("env:read")) {
      throw new PluginCapabilityViolationError(
        pluginId,
        "env:read",
        `environment variable '${envVarName}'`,
      );
    }

    const trimmedVar = envVarName.trim();
    const isSensitive = PluginCapabilitySandbox.BLOCKED_SENSITIVE_ENV_PREFIXES.some((prefix) =>
      trimmedVar.toUpperCase().startsWith(prefix),
    );

    const allowed = manifest.allowedEnvVars ?? [];
    const isExplicitlyAllowed = allowed.includes(trimmedVar);

    if (isSensitive && !isExplicitlyAllowed) {
      throw new PluginCapabilityViolationError(
        pluginId,
        "env:read",
        `sensitive system environment variable '${envVarName}'`,
        "Blocked by default security guardrail.",
      );
    }

    if (!isExplicitlyAllowed) {
      throw new PluginCapabilityViolationError(
        pluginId,
        "env:read",
        `environment variable '${envVarName}'`,
        `Variable not listed in plugin allowedEnvVars: [${allowed.join(", ")}].`,
      );
    }
  }

  public validateProcessExec(pluginId: string, command: string): void {
    const manifest = this.getManifestOrThrow(pluginId);
    if (!manifest.capabilities.includes("process:exec")) {
      throw new PluginCapabilityViolationError(
        pluginId,
        "process:exec",
        `execution of command '${command}'`,
      );
    }
  }

  private getManifestOrThrow(pluginId: string): PluginCapabilityManifest {
    const manifest = this.manifests.get(pluginId);
    if (!manifest) {
      throw new Error(`Plugin '${pluginId}' is not registered with the capability sandbox.`);
    }
    return manifest;
  }
}
