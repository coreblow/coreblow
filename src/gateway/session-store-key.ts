import { listAgentIds, resolveDefaultAgentId } from "../agents/agent-scope.js";
import {
  canonicalizeMainSessionAlias,
  resolveMainSessionKey,
} from "../config/sessions/main-session.js";
import type { CoreBlowConfig, CoreBlowConfig as OpenClawConfig } from "../config/types.coreblow.js";
import {
  DEFAULT_AGENT_ID,
  normalizeAgentId,
  normalizeMainKey,
  parseAgentSessionKey,
  type ParsedAgentSessionKey,
} from "../routing/session-key.js";
import { normalizeSessionKeyPreservingOpaquePeerIds } from "../sessions/session-key-utils.js";
import {
  normalizeLowercaseStringOrEmpty,
  normalizeOptionalString,
} from "../shared/string-coerce.js";

export class SessionStoreKeyResolver {
  public static canonicalizeKeyForAgent(agentId: string, key: string): string {
    const lowered = normalizeLowercaseStringOrEmpty(key);
    if (lowered === "global" || lowered === "unknown") {
      return lowered;
    }
    const normalized = normalizeSessionKeyPreservingOpaquePeerIds(key);
    if (normalized.startsWith("agent:")) {
      return normalized;
    }
    return `agent:${normalizeAgentId(agentId)}:${normalized}`;
  }

  public static resolveDefaultStoreAgentId(cfg: CoreBlowConfig): string {
    return normalizeAgentId(resolveDefaultAgentId(cfg));
  }

  private static shouldRemapLegacyDefaultMainAlias(
    cfg: CoreBlowConfig,
    parsed: ParsedAgentSessionKey,
    options?: { storeAgentId?: string },
  ): boolean {
    const agentId = normalizeAgentId(parsed.agentId);
    if (agentId !== DEFAULT_AGENT_ID || listAgentIds(cfg).includes(DEFAULT_AGENT_ID)) {
      return false;
    }
    const defaultAgentId = this.resolveDefaultStoreAgentId(cfg);
    if (options?.storeAgentId && normalizeAgentId(options.storeAgentId) !== defaultAgentId) {
      return false;
    }
    const rest = normalizeLowercaseStringOrEmpty(parsed.rest);
    const mainKey = normalizeMainKey(cfg.session?.mainKey);
    return rest === "main" || rest === mainKey;
  }

  private static resolveParsedSessionStoreKey(
    cfg: CoreBlowConfig,
    raw: string,
    parsed: ParsedAgentSessionKey,
    options?: { storeAgentId?: string },
  ): { agentId: string; sessionKey: string } {
    if (!this.shouldRemapLegacyDefaultMainAlias(cfg, parsed, options)) {
      return {
        agentId: normalizeAgentId(parsed.agentId),
        sessionKey: normalizeSessionKeyPreservingOpaquePeerIds(raw),
      };
    }
    const agentId = this.resolveDefaultStoreAgentId(cfg);
    const rest = normalizeLowercaseStringOrEmpty(parsed.rest);
    return { agentId, sessionKey: `agent:${agentId}:${rest}` };
  }

  public static resolveStoreKey(params: {
    cfg: CoreBlowConfig;
    sessionKey: string;
    storeAgentId?: string;
  }): string {
    const raw = normalizeOptionalString(params.sessionKey) ?? "";
    if (!raw) {
      return raw;
    }
    const rawLower = normalizeLowercaseStringOrEmpty(raw);
    if (rawLower === "global" || rawLower === "unknown") {
      return rawLower;
    }

    const parsed = parseAgentSessionKey(raw);
    if (parsed) {
      const resolved = this.resolveParsedSessionStoreKey(params.cfg, raw, parsed, {
        storeAgentId: params.storeAgentId,
      });
      const canonical = canonicalizeMainSessionAlias({
        cfg: params.cfg,
        agentId: resolved.agentId,
        sessionKey: resolved.sessionKey,
      });
      if (canonical !== resolved.sessionKey) {
        return canonical;
      }
      return resolved.sessionKey;
    }

    const lowered = normalizeLowercaseStringOrEmpty(raw);
    const rawMainKey = normalizeMainKey(params.cfg.session?.mainKey);
    if (lowered === "main" || lowered === rawMainKey) {
      return resolveMainSessionKey(params.cfg);
    }
    const agentId = this.resolveDefaultStoreAgentId(params.cfg);
    return this.canonicalizeKeyForAgent(agentId, raw);
  }

  public static resolveStoreAgentId(cfg: CoreBlowConfig, canonicalKey: string): string {
    if (canonicalKey === "global" || canonicalKey === "unknown") {
      return this.resolveDefaultStoreAgentId(cfg);
    }
    const parsed = parseAgentSessionKey(canonicalKey);
    if (parsed?.agentId) {
      return normalizeAgentId(parsed.agentId);
    }
    return this.resolveDefaultStoreAgentId(cfg);
  }

  public static resolveStoredKeyForAgentStore(params: {
    cfg: CoreBlowConfig;
    agentId: string;
    sessionKey: string;
  }): string {
    const raw = normalizeOptionalString(params.sessionKey) ?? "";
    if (!raw) {
      return raw;
    }
    const lowered = normalizeLowercaseStringOrEmpty(raw);
    if (lowered === "global" || lowered === "unknown") {
      return lowered;
    }
    const key = parseAgentSessionKey(raw)
      ? raw
      : this.canonicalizeKeyForAgent(params.agentId, raw);
    return this.resolveStoreKey({
      cfg: params.cfg,
      sessionKey: key,
      storeAgentId: params.agentId,
    });
  }

  public static resolveStoredOwnerAgentId(params: {
    cfg: CoreBlowConfig;
    agentId: string;
    sessionKey: string;
  }): string | null {
    const canonicalKey = this.resolveStoredKeyForAgentStore(params);
    if (canonicalKey === "global" || canonicalKey === "unknown") {
      return null;
    }
    return this.resolveStoreAgentId(params.cfg, canonicalKey);
  }

  public static canonicalizeSpawnedBy(
    cfg: CoreBlowConfig,
    agentId: string,
    spawnedBy?: string,
  ): string | undefined {
    const raw = normalizeOptionalString(spawnedBy) ?? "";
    if (!raw) {
      return undefined;
    }
    const lower = normalizeLowercaseStringOrEmpty(raw);
    if (lower === "global" || lower === "unknown") {
      return lower;
    }
    let result: string;
    const normalized = normalizeSessionKeyPreservingOpaquePeerIds(raw);
    if (normalized.startsWith("agent:")) {
      result = normalized;
    } else {
      result = `agent:${normalizeAgentId(agentId)}:${normalized}`;
    }
    const parsed = parseAgentSessionKey(result);
    const resolvedAgent = parsed?.agentId ? normalizeAgentId(parsed.agentId) : agentId;
    return canonicalizeMainSessionAlias({ cfg, agentId: resolvedAgent, sessionKey: result });
  }
}

export const canonicalizeSessionKeyForAgent = SessionStoreKeyResolver.canonicalizeKeyForAgent.bind(SessionStoreKeyResolver);
export const resolveSessionStoreKey = SessionStoreKeyResolver.resolveStoreKey.bind(SessionStoreKeyResolver);
export const resolveSessionStoreAgentId = SessionStoreKeyResolver.resolveStoreAgentId.bind(SessionStoreKeyResolver);
export const resolveStoredSessionKeyForAgentStore = SessionStoreKeyResolver.resolveStoredKeyForAgentStore.bind(SessionStoreKeyResolver);
export const resolveStoredSessionOwnerAgentId = SessionStoreKeyResolver.resolveStoredOwnerAgentId.bind(SessionStoreKeyResolver);
export const canonicalizeSpawnedByForAgent = SessionStoreKeyResolver.canonicalizeSpawnedBy.bind(SessionStoreKeyResolver);
