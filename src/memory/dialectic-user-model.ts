/**
 * CoreBlow — Cory Dialectic Engine v2
 *
 * 100% local, zero-cloud user modeling, TrustZone-safe proposal staging queue,
 * and unified hybrid memory recall across Cory 4-Layer Memory + Dialectic Profile
 * + Unified Session Store.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  type CoryMemoryItem,
  type CoryMemoryLayer,
  type CoryScope,
  type CoryMemoryStore,
  resolveHomeStateDir,
} from "./cory.js";
import { loadUnifiedSessionStoreSync } from "../sessions/unified-session-store.js";

// ─── 1. Dialectic Data Contracts ──────────────────────────────────────────

export type DialecticDimension =
  | "communication_style"
  | "tech_stack"
  | "active_projects"
  | "hard_constraints";

export interface DialecticSignal {
  id: string;
  dimension: DialecticDimension;
  key: string;
  value: string;
  confidence: number;
  updatedAt: number;
  sourceSessionId?: string;
  supersededBy?: string;
}

export interface DialecticUserProfile {
  version: 2;
  updatedAt: number;
  signals: Record<string, DialecticSignal>;
}

export interface PendingMemoryProposal {
  id: string;
  content: string;
  targetLayer: CoryMemoryLayer;
  dimension?: DialecticDimension;
  source: string;
  createdAt: number;
  status: "pending" | "approved" | "dismissed";
  resolvedAt?: number;
}

export interface MemoryProposalStoreFile {
  version: 1;
  updatedAt: number;
  proposals: Record<string, PendingMemoryProposal>;
}

export interface HybridRecallHit {
  source: "cory_memory" | "dialectic_profile" | "session_store";
  layer?: string;
  dimension?: DialecticDimension;
  id: string;
  content: string;
  score: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface UnifiedHybridRecallParams {
  query: string;
  scope?: CoryScope;
  memoryStore?: CoryMemoryStore;
  dialecticModel?: DialecticUserModel;
  sessionStorePath?: string;
  topK?: number;
}

// ─── 2. Deterministic Signal Extraction ────────────────────────────────────

function normalizeKey(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * Deterministically extracts dialectic signals from conversation text across 4 dimensions:
 * - communication_style (language, brevity, format)
 * - tech_stack (languages, frameworks, runtimes, DBs)
 * - active_projects (repo names, paths, goals)
 * - hard_constraints ("never X", "always Y")
 */
export function extractDialecticSignals(params: {
  text: string;
  sessionId?: string;
}): DialecticSignal[] {
  const text = (params.text ?? "").trim();
  if (!text) return [];

  const now = Date.now();
  const signals: DialecticSignal[] = [];

  const addSignal = (
    dimension: DialecticDimension,
    key: string,
    value: string,
    confidence: number,
  ) => {
    signals.push({
      id: `sig_${dimension}_${normalizeKey(key)}_${now}_${Math.random().toString(36).slice(2, 6)}`,
      dimension,
      key: normalizeKey(key),
      value: value.trim(),
      confidence: Math.min(1.0, Math.max(0.1, confidence)),
      updatedAt: now,
      sourceSessionId: params.sessionId,
    });
  };

  // 1. Dimension: communication_style
  const idMarkers = text.match(/\b(saya|kamu|kita|tolong|bisa|jangan|apakah|bagaimana|dan|atau|ini|itu|pakai|buat|kerjakan|menggunakan|mohon|terima\s*kasih|halo|selamat|ubah|tambahkan)\b/gi);
  const enMarkers = text.match(/\b(please|could|would|should|how|what|build|create|write|using|don't|thanks|thank\s+you|hello|make|fix|update|change)\b/gi);

  if (idMarkers && (!enMarkers || idMarkers.length >= enMarkers.length)) {
    addSignal("communication_style", "preferred_language", "Indonesian", 0.9);
  } else if (enMarkers && enMarkers.length > (idMarkers?.length ?? 0)) {
    addSignal("communication_style", "preferred_language", "English", 0.85);
  }

  if (/\b(terse|concise|singkat|padat|to the point|jangan bertele-tele|tanpa basa-basi)\b/i.test(text)) {
    addSignal("communication_style", "tone_preference", "Concise & Terse", 0.95);
  } else if (/\b(detailed?|rinci|lengkap|penjelasan lengkap|comprehensive)\b/i.test(text)) {
    addSignal("communication_style", "tone_preference", "Detailed & Comprehensive", 0.9);
  }

  if (/\b(bullet\s*points?|poin-poin|daftar list)\b/i.test(text)) {
    addSignal("communication_style", "formatting_preference", "Bullet Points", 0.85);
  }

  // 2. Dimension: tech_stack
  const frameworkMatch = /\b(?:switch|ganti|migrasi|move|change|use|pakai|using|with)?\s*(?:to|ke)?\s*\b(electron|flutter|tauri|nextjs|react|vue|svelte)\b/i.exec(text);
  if (frameworkMatch?.[1]) {
    const rawFw = frameworkMatch[1].toLowerCase();
    const fwName =
      rawFw === "electron" ? "Electron" :
      rawFw === "flutter" ? "Flutter" :
      rawFw === "tauri" ? "Tauri" :
      rawFw === "nextjs" ? "Next.js" :
      rawFw.charAt(0).toUpperCase() + rawFw.slice(1);
    addSignal("tech_stack", "desktop_framework", fwName, 0.92);
  }

  const langMatch = /\b(?:using|in|use|pakai|bahasa|code in)?\s*\b(typescript|javascript|python|golang|rust|dart|c\+\+|swift|kotlin)\b/i.exec(text);
  if (langMatch?.[1]) {
    const rawLang = langMatch[1].toLowerCase();
    const langName =
      rawLang === "typescript" ? "TypeScript" :
      rawLang === "javascript" ? "JavaScript" :
      rawLang === "python" ? "Python" :
      rawLang === "golang" ? "Go" :
      rawLang.charAt(0).toUpperCase() + rawLang.slice(1);
    addSignal("tech_stack", "primary_language", langName, 0.88);
  }

  if (/\b(bun|node\.?js|deno)\b/i.test(text)) {
    const runtime = /\bbun\b/i.test(text) ? "Bun" : /\bdeno\b/i.test(text) ? "Deno" : "Node.js";
    addSignal("tech_stack", "backend_runtime", runtime, 0.85);
  }

  if (/\b(sqlite|postgres(?:ql)?|mysql|redis|mongodb)\b/i.test(text)) {
    const db = /\bsqlite\b/i.test(text) ? "SQLite" : /\bpostgres/i.test(text) ? "PostgreSQL" : "Database";
    addSignal("tech_stack", "primary_database", db, 0.85);
  }

  // 3. Dimension: active_projects
  const projectMatch = /\b(?:working\s+on\s+(?:the\s+|a\s+|repo\s+|project\s+)?|project\s+|repo\s+|aplikasi\s+|workspace\s+)([a-zA-Z0-9_\-]+)\b/i.exec(text);
  if (projectMatch?.[1] && !["the", "a", "an", "this", "my", "our", "ini", "itu", "repo", "project"].includes(projectMatch[1].toLowerCase())) {
    addSignal("active_projects", "project_name", projectMatch[1], 0.88);
  }

  const pathMatch = /(?:\/Users|\/home|[A-Za-z]:\\)[a-zA-Z0-9_\-./]+/.exec(text);
  if (pathMatch?.[0]) {
    const cleanPath = pathMatch[0].replace(/[.,;:\s]+$/, "");
    addSignal("active_projects", "workspace_path", cleanPath, 0.85);
  }

  // 4. Dimension: hard_constraints
  const neverMatch = /(?:never|jangan pernah|do not|dilarang)\s+([^.,;\n]{4,60})/i.exec(text);
  if (neverMatch?.[1]) {
    const rule = neverMatch[1].trim();
    addSignal("hard_constraints", `never_${rule.slice(0, 20)}`, `Never ${rule}`, 0.95);
  }

  const alwaysMatch = /(?:always|selalu|harus selalu|wajib)\s+([^.,;\n]{4,60})/i.exec(text);
  if (alwaysMatch?.[1]) {
    const rule = alwaysMatch[1].trim();
    addSignal("hard_constraints", `always_${rule.slice(0, 20)}`, `Always ${rule}`, 0.95);
  }

  return signals;
}

// ─── 3. DialecticUserModel Store (Atomic Persistence & Contradiction Resolution)

export class DialecticUserModel {
  private readonly stateDir: string;
  private readonly profilePath: string;
  private profile: DialecticUserProfile;

  constructor(baseDir?: string) {
    this.stateDir = baseDir ? resolveHomeStateDir(baseDir) : resolveHomeStateDir();
    const memoryDir = path.join(this.stateDir, "memory");
    this.profilePath = path.join(memoryDir, "dialectic-profile.json");
    this.profile = this.loadProfile();
  }

  private loadProfile(): DialecticUserProfile {
    try {
      if (fs.existsSync(this.profilePath)) {
        const raw = fs.readFileSync(this.profilePath, "utf8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && parsed.version === 2) {
          return parsed as DialecticUserProfile;
        }
      }
    } catch {}

    return {
      version: 2,
      updatedAt: Date.now(),
      signals: {},
    };
  }

  private saveProfileAtomic(): void {
    try {
      const dir = path.dirname(this.profilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      }
      this.profile.updatedAt = Date.now();
      const tmpPath = `${this.profilePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 6)}`;
      fs.writeFileSync(tmpPath, JSON.stringify(this.profile, null, 2), "utf8");
      fs.renameSync(tmpPath, this.profilePath);
    } catch {}
  }

  public getStateDir(): string {
    return this.stateDir;
  }

  public getProfile(): DialecticUserProfile {
    return {
      version: 2,
      updatedAt: this.profile.updatedAt,
      signals: { ...this.profile.signals },
    };
  }

  public getAllSignals(): DialecticSignal[] {
    return Object.values(this.profile.signals);
  }

  /**
   * Returns active non-superseded traits.
   */
  public getActiveTraits(): DialecticSignal[] {
    return Object.values(this.profile.signals).filter((s) => !s.supersededBy);
  }

  /**
   * Ingest a single dialectic signal, resolving contradictions and superseding older values
   * that share the same dimension and key.
   */
  public ingestSignal(signal: DialecticSignal): {
    signal: DialecticSignal;
    superseded?: DialecticSignal;
  } {
    const existingActive = Object.values(this.profile.signals).find(
      (s) => s.dimension === signal.dimension && s.key === signal.key && !s.supersededBy,
    );

    let superseded: DialecticSignal | undefined;

    if (existingActive) {
      if (existingActive.value.toLowerCase() !== signal.value.toLowerCase()) {
        existingActive.supersededBy = signal.id;
        existingActive.updatedAt = Date.now();
        superseded = existingActive;
      } else {
        // Same value — refresh timestamp & update confidence
        existingActive.confidence = Math.max(existingActive.confidence, signal.confidence);
        existingActive.updatedAt = Date.now();
        this.saveProfileAtomic();
        return { signal: existingActive };
      }
    }

    this.profile.signals[signal.id] = signal;
    this.saveProfileAtomic();
    return { signal, superseded };
  }

  /**
   * Extract and ingest all signals from text, returning newly added/updated signals.
   */
  public ingestTurn(text: string, sessionId?: string): DialecticSignal[] {
    const signals = extractDialecticSignals({ text, sessionId });
    for (const sig of signals) {
      this.ingestSignal(sig);
    }
    return signals;
  }

  /**
   * Remove a trait by ID.
   */
  public removeSignal(id: string): boolean {
    if (this.profile.signals[id]) {
      delete this.profile.signals[id];
      this.saveProfileAtomic();
      return true;
    }
    return false;
  }
}

// ─── 4. MemoryProposalStore (TrustZone Staging Queue) ──────────────────────

export class MemoryProposalStore {
  private readonly stateDir: string;
  private readonly proposalsPath: string;
  private store: MemoryProposalStoreFile;

  constructor(baseDir?: string) {
    this.stateDir = baseDir ? resolveHomeStateDir(baseDir) : resolveHomeStateDir();
    const memoryDir = path.join(this.stateDir, "memory");
    this.proposalsPath = path.join(memoryDir, "proposals.json");
    this.store = this.loadStore();
  }

  private loadStore(): MemoryProposalStoreFile {
    try {
      if (fs.existsSync(this.proposalsPath)) {
        const raw = fs.readFileSync(this.proposalsPath, "utf8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && parsed.version === 1) {
          return parsed as MemoryProposalStoreFile;
        }
      }
    } catch {}

    return {
      version: 1,
      updatedAt: Date.now(),
      proposals: {},
    };
  }

  private saveStoreAtomic(): void {
    try {
      const dir = path.dirname(this.proposalsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      }
      this.store.updatedAt = Date.now();
      const tmpPath = `${this.proposalsPath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 6)}`;
      fs.writeFileSync(tmpPath, JSON.stringify(this.store, null, 2), "utf8");
      fs.renameSync(tmpPath, this.proposalsPath);
    } catch {}
  }

  public listAllProposals(): PendingMemoryProposal[] {
    return Object.values(this.store.proposals).sort((a, b) => b.createdAt - a.createdAt);
  }

  public listPendingProposals(): PendingMemoryProposal[] {
    return Object.values(this.store.proposals)
      .filter((p) => p.status === "pending")
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  public enqueueProposal(params: {
    content: string;
    targetLayer: CoryMemoryLayer;
    dimension?: DialecticDimension;
    source: string;
  }): PendingMemoryProposal {
    const id = `prop_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const proposal: PendingMemoryProposal = {
      id,
      content: params.content.trim(),
      targetLayer: params.targetLayer,
      dimension: params.dimension,
      source: params.source,
      createdAt: Date.now(),
      status: "pending",
    };

    this.store.proposals[id] = proposal;
    this.saveStoreAtomic();
    return proposal;
  }

  public resolveProposal(
    id: string,
    decision: "approve" | "dismiss",
    memoryStore?: CoryMemoryStore,
  ): PendingMemoryProposal | null {
    const proposal = this.store.proposals[id];
    if (!proposal) return null;

    if (decision === "approve") {
      proposal.status = "approved";
      proposal.resolvedAt = Date.now();

      // Write into target Cory canonical layer via Single-Brain Gateway authority
      if (memoryStore) {
        memoryStore.remember({
          layer: proposal.targetLayer,
          content: proposal.content,
          source: proposal.source,
        });
      }
    } else {
      proposal.status = "dismissed";
      proposal.resolvedAt = Date.now();
    }

    this.saveStoreAtomic();
    return proposal;
  }
}

// ─── 5. Unified Hybrid Recall Engine ──────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2);
}

/**
 * Searches across Cory 4-Layer Memory + Dialectic User Profile + Unified Session Store,
 * ranking results by BM25-style keyword coverage + recency decay while excluding superseded traits.
 */
export function unifiedHybridRecall(params: UnifiedHybridRecallParams): {
  query: string;
  hits: HybridRecallHit[];
  totalMatches: number;
} {
  const query = (params.query ?? "").trim();
  const topK = Math.max(1, params.topK ?? 8);
  if (!query) {
    return { query, hits: [], totalMatches: 0 };
  }

  const queryTerms = tokenize(query);
  const now = Date.now();
  const candidateHits: HybridRecallHit[] = [];

  // 1. Cory 4-Layer Memory
  if (params.memoryStore) {
    try {
      const canonicalItems = params.memoryStore.loadAllCanonicalItems();
      for (const item of canonicalItems) {
        const itemText = item.content;
        const itemTerms = new Set(tokenize(itemText));
        let matchCount = 0;
        for (const term of queryTerms) {
          if (itemTerms.has(term)) matchCount++;
        }

        const coverage = matchCount / Math.max(1, queryTerms.length);
        if (coverage > 0 || itemText.toLowerCase().includes(query.toLowerCase())) {
          const phraseBoost = itemText.toLowerCase().includes(query.toLowerCase()) ? 0.6 : 0;
          const ageDays = (now - item.updatedAt) / (1000 * 3600 * 24);
          const recency = Math.max(0.5, 1 / (1 + ageDays * 0.05));
          const layerWeight =
            item.layer === "constraint" ? 1.5 :
            item.layer === "identity" ? 1.3 :
            item.layer === "durable" ? 1.2 : 1.0;

          const score = (coverage * 1.5 + phraseBoost) * recency * layerWeight;
          candidateHits.push({
            source: "cory_memory",
            layer: item.layer,
            id: item.id,
            content: item.content,
            score: Number(score.toFixed(4)),
            timestamp: item.updatedAt,
            metadata: { userScope: item.userScope, workspaceId: item.workspaceId },
          });
        }
      }
    } catch {}
  }

  // 2. Dialectic User Profile (active traits only; exclude superseded)
  if (params.dialecticModel) {
    try {
      const activeTraits = params.dialecticModel.getActiveTraits();
      for (const trait of activeTraits) {
        const traitText = `${trait.key} ${trait.value}`;
        const traitTerms = new Set(tokenize(traitText));
        let matchCount = 0;
        for (const term of queryTerms) {
          if (traitTerms.has(term)) matchCount++;
        }

        const coverage = matchCount / Math.max(1, queryTerms.length);
        if (coverage > 0 || traitText.toLowerCase().includes(query.toLowerCase())) {
          const phraseBoost = traitText.toLowerCase().includes(query.toLowerCase()) ? 0.6 : 0;
          const ageDays = (now - trait.updatedAt) / (1000 * 3600 * 24);
          const recency = Math.max(0.6, 1 / (1 + ageDays * 0.03));
          const score = (coverage * 1.6 + phraseBoost) * recency * 1.35 * trait.confidence;

          candidateHits.push({
            source: "dialectic_profile",
            dimension: trait.dimension,
            id: trait.id,
            content: `${trait.key}: ${trait.value}`,
            score: Number(score.toFixed(4)),
            timestamp: trait.updatedAt,
            metadata: { confidence: trait.confidence, dimension: trait.dimension },
          });
        }
      }
    } catch {}
  }

  // 3. Unified Session Store
  try {
    const sessionFile = loadUnifiedSessionStoreSync(params.sessionStorePath);
    const sessions = Object.values(sessionFile.sessions ?? {});
    for (const sess of sessions.slice(-20)) {
      for (const msg of (sess.messages ?? []).slice(-10)) {
        if (!msg.content || msg.content.length < 5) continue;
        const msgTerms = new Set(tokenize(msg.content));
        let matchCount = 0;
        for (const term of queryTerms) {
          if (msgTerms.has(term)) matchCount++;
        }

        const coverage = matchCount / Math.max(1, queryTerms.length);
        if (coverage >= 0.5 || msg.content.toLowerCase().includes(query.toLowerCase())) {
          const phraseBoost = msg.content.toLowerCase().includes(query.toLowerCase()) ? 0.4 : 0;
          const ageDays = (now - msg.createdAt) / (1000 * 3600 * 24);
          const recency = Math.max(0.4, 1 / (1 + ageDays * 0.08));
          const score = (coverage * 1.2 + phraseBoost) * recency * 0.9;

          candidateHits.push({
            source: "session_store",
            id: `${sess.id}_${msg.id}`,
            content: `[${msg.role}] ${msg.content.slice(0, 200)}`,
            score: Number(score.toFixed(4)),
            timestamp: msg.createdAt,
            metadata: { sessionId: sess.id, surface: sess.surface },
          });
        }
      }
    }
  } catch {}

  // Sort by score descending and deduplicate by content
  const seenContent = new Set<string>();
  const uniqueHits: HybridRecallHit[] = [];

  candidateHits.sort((a, b) => b.score - a.score);

  for (const hit of candidateHits) {
    const norm = hit.content.toLowerCase().trim();
    if (!seenContent.has(norm)) {
      seenContent.add(norm);
      uniqueHits.push(hit);
    }
  }

  return {
    query,
    hits: uniqueHits.slice(0, topK),
    totalMatches: uniqueHits.length,
  };
}

// ─── 6. Global Singletons ─────────────────────────────────────────────────

const dialecticModelSingletons = new Map<string, DialecticUserModel>();
const proposalStoreSingletons = new Map<string, MemoryProposalStore>();

export function getGlobalDialecticUserModel(baseDir?: string): DialecticUserModel {
  const dirKey = baseDir ? resolveHomeStateDir(baseDir) : resolveHomeStateDir();
  let instance = dialecticModelSingletons.get(dirKey);
  if (!instance) {
    instance = new DialecticUserModel(dirKey);
    dialecticModelSingletons.set(dirKey, instance);
  }
  return instance;
}

export function getGlobalMemoryProposalStore(baseDir?: string): MemoryProposalStore {
  const dirKey = baseDir ? resolveHomeStateDir(baseDir) : resolveHomeStateDir();
  let instance = proposalStoreSingletons.get(dirKey);
  if (!instance) {
    instance = new MemoryProposalStore(dirKey);
    proposalStoreSingletons.set(dirKey, instance);
  }
  return instance;
}
